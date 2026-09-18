import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { hasServerCapability, requireCapability } from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { getAccountNames } from "@/lib/server-users";
import { welcomeLetter } from "@/lib/letters";
import { isRecord } from "@/lib/validation";
import { consumeRateLimit } from "@/lib/rate-limit";
import { ok, fail } from "@/lib/api";
import { logError } from "@/lib/logger";

const APPLICATION_STATUSES = new Set([
  "pending",
  "approved",
  "rejected",
  "reapplied",
]);
const MAX_REASON_LENGTH = 2000;
const MEMBERSHIP_NUMBER_ATTEMPTS = 5;

function membershipNumber(): string {
  // Collision-resistant rather than merely random: the previous
  // `MM-YYYY-NNNN` scheme had a four-digit space shared by every member, with no
  // uniqueness constraint behind it.
  const suffix = crypto
    .randomUUID()
    .replace(/-/g, "")
    .slice(0, 6)
    .toUpperCase();

  return `MM-${new Date().getFullYear()}-${suffix}`;
}

/**
 * Membership applications, joined with the applicant's profile and membership.
 *
 * One request serves all three screens (pending, approved, rejected) via the
 * `status` parameter. Previously each screen read the applications table with
 * the browser SDK and then issued one profile query per applicant.
 */
export async function GET(request: NextRequest) {
  const authenticated = await requireCapability(
    request,
    "membership.view_applications",
  );

  if (!authenticated.user) return authenticated.response;

  try {
    const requested = (request.nextUrl.searchParams.get("status") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => APPLICATION_STATUSES.has(value));

    const { databases } = createServerDatabases();
    const applicationQueries = [
      Query.orderDesc("submittedAt"),
      Query.limit(300),
    ];

    if (requested.length > 0)
      applicationQueries.unshift(Query.equal("status", requested));

    const [applications, departments, counts] = await Promise.all([
      databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.APPLICATIONS,
        applicationQueries,
      ),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.DEPARTMENTS, [
        Query.orderAsc("displayOrder"),
        Query.limit(200),
      ]),
      (async () => {
        const [pending, approved, rejected] = await Promise.all([
          databases.listDocuments(DATABASE_ID, COLLECTIONS.APPLICATIONS, [
            Query.equal("status", ["pending"]),
            Query.limit(1),
          ]),
          databases.listDocuments(DATABASE_ID, COLLECTIONS.APPLICATIONS, [
            Query.equal("status", ["approved"]),
            Query.limit(1),
          ]),
          databases.listDocuments(DATABASE_ID, COLLECTIONS.APPLICATIONS, [
            Query.equal("status", ["rejected"]),
            Query.limit(1),
          ]),
        ]);

        return {
          pending: pending.total,
          approved: approved.total,
          rejected: rejected.total,
        };
      })(),
    ]);

    const userIds = [
      ...new Set(
        applications.documents
          .map((application) => String(application.userId ?? ""))
          .filter(Boolean),
      ),
    ];
    const empty = { documents: [] as Array<Record<string, unknown>> };
    const [profiles, memberships] = userIds.length
      ? await Promise.all([
          databases.listDocuments(DATABASE_ID, COLLECTIONS.PROFILES, [
            Query.equal("userId", userIds),
            Query.limit(300),
          ]),
          databases.listDocuments(DATABASE_ID, COLLECTIONS.MEMBERSHIPS, [
            Query.equal("userId", userIds),
            Query.limit(300),
          ]),
        ])
      : [empty, empty];

    // Account names live on the auth record, not on any table. Resolve them
    // best-effort: a lookup failure must never fail the whole queue.
    const accountNames = await getAccountNames(userIds).then(
      (names) => Object.fromEntries(names) as Record<string, string>,
      () => ({}) as Record<string, string>,
    );

    return ok({
      applications: applications.documents,
      profiles: profiles.documents,
      memberships: memberships.documents,
      departments: departments.documents,
      counts,
      accountNames,
    });
  } catch (error) {
    logError("Membership lookup error:", error);

    return fail("INTERNAL", "Unable to load membership data", 500);
  }
}

/**
 * Approve or reject an application.
 *
 * This is the one flow that grants membership, so it is server-owned end to
 * end: it validates the transition, creates the membership, assigns the
 * applicant's chosen departments, notifies the applicant, and records an audit
 * entry. Running it in the browser meant none of those writes could succeed —
 * and the audit entry named a client-supplied actor.
 */
export async function POST(request: NextRequest) {
  const authenticated = await requireCapability(
    request,
    "membership.view_applications",
  );

  if (!authenticated.user) return authenticated.response;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION", "Invalid request body", 400);
  }
  if (!isRecord(body)) return fail("VALIDATION", "Invalid request body", 400);

  const action = typeof body.action === "string" ? body.action : "";
  const applicationId =
    typeof body.applicationId === "string" ? body.applicationId.trim() : "";

  if (!applicationId)
    return fail("VALIDATION", "applicationId is required", 400);
  if (action !== "approve" && action !== "reject") {
    return fail("VALIDATION", "Unsupported action", 400);
  }

  // Action-specific gate: viewing the queue (GET) needs view_applications,
  // but approve/reject need their own capabilities. Admin passes via "*".
  const required =
    action === "approve" ? "membership.approve" : "membership.reject";

  if (!(await hasServerCapability(authenticated.user.$id, required))) {
    return fail("FORBIDDEN", "Forbidden", 403);
  }
  // Approval fans out to membership + departments + notification writes:
  // throttle per actor so a stuck client cannot duplicate the fan-out.
  if (
    !consumeRateLimit(
      `membership-review:${authenticated.user.$id}`,
      60,
      10 * 60 * 1000,
    ).allowed
  ) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }

  const reason =
    typeof body.reason === "string"
      ? body.reason.trim().slice(0, MAX_REASON_LENGTH)
      : "";

  if (action === "reject" && !reason) {
    return fail("VALIDATION", "A rejection reason is required", 400);
  }

  try {
    const { databases } = createServerDatabases();
    const application = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.APPLICATIONS,
      applicationId,
    );
    const applicantId = String(application.userId ?? "");

    if (!applicantId)
      return fail("CONFLICT", "Application has no applicant", 409);
    const currentStatus = String(application.status ?? "");

    // State-machine guard: only pending/reapplied transition.
    // alreadyApproved still falls through to the membership check below: a
    // creation blip can leave approved-app/no-membership limbo, and a no-op
    // here would make it unrepairable (re-approve no-ops, onboarding 409s).
    if (action === "approve" && currentStatus === "approved") {
      const repairCheck = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.MEMBERSHIPS,
        [Query.equal("userId", [applicantId]), Query.limit(1)],
      );

      if (repairCheck.documents.length > 0) {
        return ok({ application, alreadyApproved: true });
      }
    }
    if (action === "reject" && currentStatus === "rejected") {
      return ok({ application, alreadyRejected: true });
    }
    if (action === "approve" && currentStatus === "rejected") {
      return fail(
        "CONFLICT",
        "Application must be resubmitted before approval",
        409,
      );
    }

    const now = new Date().toISOString();
    const nameMap = await getAccountNames([applicantId]);
    const applicantName = nameMap.get(applicantId) || "Member";

    if (action === "reject") {
      const updated = await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.APPLICATIONS,
        applicationId,
        {
          status: "rejected",
          reviewedBy: authenticated.user.$id,
          reviewedAt: now,
          rejectionReason: reason,
        },
      );

      // Reject-after-approve must deactivate membership, otherwise user remains member.
      let departmentsRevoked = 0;
      let powersRevoked = 0;
      let designationsRevoked = 0;

      if (currentStatus === "approved") {
        const mems = await databases.listDocuments(
          DATABASE_ID,
          COLLECTIONS.MEMBERSHIPS,
          [Query.equal("userId", [applicantId]), Query.limit(10)],
        );

        await Promise.all(
          mems.documents.map((m) =>
            databases
              .updateDocument(DATABASE_ID, COLLECTIONS.MEMBERSHIPS, m.$id, {
                status: "inactive",
              })
              .catch(() => null),
          ),
        );

        const deptRows = await databases.listDocuments(
          DATABASE_ID,
          COLLECTIONS.USER_DEPARTMENTS,
          [
            Query.equal("userId", [applicantId]),
            Query.equal("isActive", [true]),
            Query.limit(100),
          ],
        );

        await Promise.all(
          deptRows.documents.map((row) =>
            databases
              .updateDocument(
                DATABASE_ID,
                COLLECTIONS.USER_DEPARTMENTS,
                row.$id,
                {
                  isActive: false,
                },
              )
              .then(() => {
                departmentsRevoked += 1;
              })
              .catch(() => null),
          ),
        );
        // Powers and designations are explicit grants, but a rejected
        // ex-member must not keep them: revocation is recorded in the audit
        // entry below, which preserves the provenance.
        const [powerRows, desigRows] = await Promise.all([
          databases
            .listDocuments(DATABASE_ID, COLLECTIONS.USER_POWERS, [
              Query.equal("userId", [applicantId]),
              Query.equal("isActive", [true]),
              Query.limit(500),
            ])
            .catch(() => ({ documents: [] as unknown[] })),
          databases
            .listDocuments(DATABASE_ID, COLLECTIONS.USER_DESIGNATIONS, [
              Query.equal("userId", [applicantId]),
              Query.equal("isActive", [true]),
              Query.limit(500),
            ])
            .catch(() => ({ documents: [] as unknown[] })),
        ]);

        await Promise.all([
          ...(powerRows as { documents: Array<{ $id: string }> }).documents.map(
            (row) =>
              databases
                .updateDocument(DATABASE_ID, COLLECTIONS.USER_POWERS, row.$id, {
                  isActive: false,
                })
                .then(() => {
                  powersRevoked += 1;
                })
                .catch(() => null),
          ),
          ...(desigRows as { documents: Array<{ $id: string }> }).documents.map(
            (row) =>
              databases
                .updateDocument(
                  DATABASE_ID,
                  COLLECTIONS.USER_DESIGNATIONS,
                  row.$id,
                  { isActive: false },
                )
                .then(() => {
                  designationsRevoked += 1;
                })
                .catch(() => null),
          ),
        ]);
      }

      await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.NOTIFICATIONS,
        ID.unique(),
        {
          userId: applicantId,
          type: "membership_rejected",
          title: "Application not approved",
          body: `Your membership application was not approved at this time. Reason: ${reason}`,
          read: false,
          createdAt: now,
        },
      );

      await recordAudit({
        request,
        actor: authenticated.user,
        action: "reject_application",
        entityType: "application",
        entityId: applicationId,
        details: {
          applicantId,
          reason,
          departmentsRevoked,
          powersRevoked,
          designationsRevoked,
        },
      });

      return ok({ application: updated });
    }

    // Approve. An application that was already approved would otherwise create a
    // second membership for the same account on a double click or a retry.
    const existingMemberships = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.MEMBERSHIPS,
      [Query.equal("userId", [applicantId]), Query.limit(1)],
    );

    const preferredDepartments = Array.isArray(application.preferredDepartments)
      ? (application.preferredDepartments as unknown[]).filter(
          (value): value is string => typeof value === "string",
        )
      : [];

    // Validate department IDs to avoid orphan user_departments rows. The
    // small catalogue is read once and filtered in memory rather than
    // querying by `$id`, keeping validation independent of
    // system-attribute indexing.
    let validDeptIds: string[] = preferredDepartments;
    let departmentNames: string[] = [];

    if (preferredDepartments.length > 0) {
      const catalogue = await databases
        .listDocuments(DATABASE_ID, COLLECTIONS.DEPARTMENTS, [
          Query.equal("isActive", [true]),
          Query.limit(100),
        ])
        .catch(() => ({ documents: [] as unknown[] }));
      const byId = new Map(
        (
          catalogue as { documents: Array<{ $id: string; name?: unknown }> }
        ).documents.map((d) => [d.$id, String(d.name ?? "")]),
      );

      validDeptIds = preferredDepartments.filter((id) => byId.has(id));
      departmentNames = validDeptIds.map((id) => byId.get(id) ?? "");
    }

    let membership = existingMemberships.documents[0] ?? null;
    let issuedNumber: string | null = membership
      ? String(membership.membershipNumber ?? "")
      : null;

    if (!membership) {
      for (
        let attempt = 0;
        attempt < MEMBERSHIP_NUMBER_ATTEMPTS && !membership;
        attempt += 1
      ) {
        const candidate = membershipNumber();
        const clash = await databases.listDocuments(
          DATABASE_ID,
          COLLECTIONS.MEMBERSHIPS,
          [Query.equal("membershipNumber", [candidate]), Query.limit(1)],
        );

        if (clash.documents.length > 0) continue;

        membership = await databases.createDocument(
          DATABASE_ID,
          COLLECTIONS.MEMBERSHIPS,
          ID.unique(),
          {
            userId: applicantId,
            applicationId,
            status: "active",
            membershipNumber: candidate,
            approvedBy: authenticated.user.$id,
            approvedAt: now,
            department: validDeptIds[0] ?? undefined,
            joinedAt: now,
          },
        );
        issuedNumber = candidate;
      }

      if (!membership) {
        return fail(
          "INTERNAL",
          "Could not allocate a unique membership number. Please retry.",
          503,
        );
      }
    } else if (membership.status !== "active") {
      membership = await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.MEMBERSHIPS,
        membership.$id,
        {
          status: "active",
          approvedBy: authenticated.user.$id,
          approvedAt: now,
        },
      );
    }

    const updated = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.APPLICATIONS,
      applicationId,
      {
        status: "approved",
        reviewedBy: authenticated.user.$id,
        reviewedAt: now,
      },
    );

    // Department assignment is idempotent: re-approving must not stack duplicate
    // active rows for the same pairing.
    let assignedDepartments = 0;

    if (validDeptIds.length > 0) {
      const existing = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.USER_DEPARTMENTS,
        [
          Query.equal("userId", [applicantId]),
          Query.equal("departmentId", validDeptIds),
          Query.equal("isActive", [true]),
          Query.limit(100),
        ],
      );
      const alreadyAssigned = new Set(
        existing.documents.map((row) => String(row.departmentId ?? "")),
      );

      for (const departmentId of validDeptIds) {
        if (alreadyAssigned.has(departmentId)) continue;
        await databases.createDocument(
          DATABASE_ID,
          COLLECTIONS.USER_DEPARTMENTS,
          ID.unique(),
          {
            userId: applicantId,
            departmentId,
            role: "member",
            assignedBy: authenticated.user.$id,
            assignedAt: now,
            isActive: true,
          },
        );
        assignedDepartments += 1;
      }
    }

    // The welcome letter previously greeted the applicant with the *administrator's*
    // name and a literal "Generated on approval" in place of a membership id.
    const letter = welcomeLetter({
      name: applicantName,
      membershipId: issuedNumber || "pending",
      department: departmentNames[0],
    });

    await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.NOTIFICATIONS,
      ID.unique(),
      {
        userId: applicantId,
        type: "membership_approved",
        title: "Application approved",
        body: "Your membership application has been approved. Welcome to the club!",
        letter: JSON.stringify(letter),
        read: false,
        createdAt: now,
      },
    );

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "approve_application",
      entityType: "application",
      entityId: applicationId,
      details: {
        applicantId,
        membershipNumber: issuedNumber,
        assignedDepartments,
      },
    });

    return ok({
      application: updated,
      membership,
      assignedDepartments,
      membershipCreated: existingMemberships.documents.length === 0,
    });
  } catch (error) {
    logError("Membership action error:", error);

    return fail("INTERNAL", "Unable to complete the action", 500);
  }
}
