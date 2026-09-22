import { NextRequest } from "next/server";
import { Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import {
  getMembershipStatus,
  requireAuthenticatedUser,
} from "@/lib/server-auth";
import { ok, fail } from "@/lib/api";
import { safe } from "@/lib/server-safe";
import { getAccessSummary, hasServerCapability } from "@/lib/access-control";
import { logError } from "@/lib/logger";

const RESTRICTED = new Set(["banned", "suspended", "deactivated"]);

export async function GET(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);

  if (!authenticated.user) return authenticated.response;

  try {
    const { databases } = createServerDatabases();
    const userId = authenticated.user.$id;
    const membershipStatus = await getMembershipStatus(authenticated.user);

    // Restricted accounts get no dashboard payload (prevents banned/suspended
    // from retaining base events/tickets/notifications view-model).
    if (RESTRICTED.has(membershipStatus)) {
      return fail("FORBIDDEN", "Forbidden", 403);
    }
    const [
      upcoming,
      tickets,
      registrations,
      departments,
      designations,
      notifications,
      access,
    ] = await Promise.all([
      safe(
        "upcomingEvents",
        () =>
          databases.listDocuments(DATABASE_ID, COLLECTIONS.EVENTS, [
            Query.equal("status", ["published", "active"]),
            Query.orderAsc("date"),
            Query.limit(5),
          ]),
        { documents: [], total: 0 },
      ),
      safe(
        "tickets",
        () =>
          databases.listDocuments(DATABASE_ID, COLLECTIONS.TICKETS, [
            Query.equal("userId", [userId]),
            Query.orderDesc("$createdAt"),
            Query.limit(100),
          ]),
        { documents: [], total: 0 },
      ),
      safe(
        "registrations",
        () =>
          databases.listDocuments(DATABASE_ID, COLLECTIONS.REGISTRATIONS, [
            Query.equal("userId", [userId]),
            Query.orderDesc("registeredAt"),
            Query.limit(100),
          ]),
        { documents: [], total: 0 },
      ),
      safe(
        "departments",
        () =>
          databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_DEPARTMENTS, [
            Query.equal("userId", [userId]),
            Query.equal("isActive", [true]),
            Query.limit(100),
          ]),
        { documents: [], total: 0 },
      ),
      safe(
        "designations",
        () =>
          databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_DESIGNATIONS, [
            Query.equal("userId", [userId]),
            Query.equal("isActive", [true]),
            Query.limit(100),
          ]),
        { documents: [], total: 0 },
      ),
      safe(
        "notifications",
        () =>
          databases.listDocuments(DATABASE_ID, COLLECTIONS.NOTIFICATIONS, [
            Query.equal("userId", [userId]),
            Query.orderDesc("createdAt"),
            Query.limit(10),
          ]),
        { documents: [], total: 0 },
      ),
      // Nothing in the repo reads `access` from this payload (capability
      // routing happens via /api/permissions), so a summary failure costs
      // nothing: null, not a 500.
      safe(
        "access",
        () =>
          getAccessSummary(
            userId,
            membershipStatus,
            authenticated.user.email,
          ),
        null,
      ),
    ]);

    const eventIds = [
      ...new Set(
        registrations.documents
          .map((registration) => String(registration.eventId))
          .filter(Boolean),
      ),
    ];
    // Bounded-concurrency lookups, not one round-trip per registration fired
    // all at once: this is the most-hit authenticated endpoint and histories
    // only grow. ($id-equality queries have no precedent in this codebase, so
    // per-ID reads in small batches instead of one clever query.)
    const eventDocuments: Array<Record<string, unknown> | null> = [];

    for (let index = 0; index < eventIds.length; index += 10) {
      const page = eventIds.slice(index, index + 10);
      const rows = await Promise.all(
        page.map((eventId) =>
          databases
            .getDocument(DATABASE_ID, COLLECTIONS.EVENTS, eventId)
            .catch(() => null),
        ),
      );

      eventDocuments.push(...(rows as Array<Record<string, unknown> | null>));
    }
    const eventsById = new Map(
      eventDocuments
        .filter(Boolean)
        .map((event) => [String(event!.$id), event]),
    );
    const myEvents = registrations.documents
      .map((registration) => ({
        registration,
        event: eventsById.get(String(registration.eventId)) || null,
      }))
      .filter((item) => item.event);

    const result: Record<string, unknown> = {
      membershipStatus,
      upcomingEvents: upcoming.documents,
      tickets: tickets.documents,
      registrations: registrations.documents,
      myEvents,
      departments: departments.documents,
      designations: designations.documents,
      notifications: notifications.documents,
      access,
    };

    // Option B: capability-gated view-models, not lead/head tiers.
    // Admin passes every check via "*" wildcard. The caller's verified email
    // is threaded through so an ADMIN_EMAILS bootstrap admin (no user_roles
    // row yet) still resolves to "*" here instead of an empty set.
    const callerEmail = authenticated.user.email;
    const [canLead, canGovern] = await Promise.all([
      Promise.all([
        hasServerCapability(userId, "events.create", undefined, callerEmail),
        hasServerCapability(
          userId,
          "membership.view_applications",
          undefined,
          callerEmail,
        ),
        hasServerCapability(userId, "departments.view", undefined, callerEmail),
      ]).then((r) => r.some(Boolean)),
      Promise.all([
        hasServerCapability(userId, "governance.manage", undefined, callerEmail),
        hasServerCapability(userId, "audit.view", undefined, callerEmail),
        hasServerCapability(userId, "users.view", undefined, callerEmail),
      ]).then((r) => r.some(Boolean)),
    ]);

    if (canLead) {
      const ownEvents = await safe(
        "lead.ownEvents",
        () =>
          databases.listDocuments(DATABASE_ID, COLLECTIONS.EVENTS, [
            Query.equal("ownerId", [userId]),
            Query.orderDesc("$createdAt"),
            Query.limit(100),
          ]),
        { documents: [], total: 0 },
      );
      const departmentIds = departments.documents.map((department) =>
        String((department as Record<string, unknown>).departmentId),
      );
      const [departmentDocs, memberAssignments, scopedPending] =
        await Promise.all([
          // Resolve the lead's departments from the small catalogue in
          // memory rather than querying by `$id`, keeping enrichment
          // independent of system-attribute indexing.
          safe(
            "lead.departments",
            () =>
              databases
                .listDocuments(DATABASE_ID, COLLECTIONS.DEPARTMENTS, [
                  Query.limit(100),
                ])
                .then((catalogue) => ({
                  documents: catalogue.documents.filter((department) =>
                    departmentIds.includes(department.$id),
                  ),
                })),
            { documents: [] },
          ),
          departmentIds.length
            ? safe(
                "lead.memberAssignments",
                () =>
                  databases.listDocuments(
                    DATABASE_ID,
                    COLLECTIONS.USER_DEPARTMENTS,
                    [
                      Query.equal("departmentId", departmentIds),
                      Query.equal("isActive", [true]),
                      Query.limit(500),
                    ],
                  ),
                { documents: [], total: 0 },
              )
            : Promise.resolve({ documents: [], total: 0 }),
          // Scope pending queue to caller's departments: applications carry
          // preferredDepartments, so filter server-side instead of leaking the
          // global queue to every lead.
          safe(
            "lead.pendingApplications",
            () =>
              databases.listDocuments(DATABASE_ID, COLLECTIONS.APPLICATIONS, [
                Query.equal("status", ["pending"]),
                Query.limit(100),
              ]),
            { documents: [], total: 0 },
          ),
        ]);
      const scopedApplications = (
        scopedPending as { documents: Array<Record<string, unknown>> }
      ).documents.filter((app) => {
        const prefs = (app as Record<string, unknown>).preferredDepartments;

        if (!Array.isArray(prefs) || departmentIds.length === 0) return false;

        return prefs.some((d) => departmentIds.includes(String(d)));
      });
      const deptDocs = (
        departmentDocs as {
          documents: Array<
            Record<string, unknown> & { $id: string; name?: unknown }
          >;
        }
      ).documents;
      const memberRows = (
        memberAssignments as { documents: Array<Record<string, unknown>> }
      ).documents;

      result.lead = {
        events: ownEvents.documents,
        pendingApplications: scopedApplications,
        departments: deptDocs.map((department) => ({
          ...departments.documents.find(
            (assignment) =>
              String((assignment as Record<string, unknown>).departmentId) ===
              department.$id,
          ),
          departmentName: department.name,
          memberCount: memberRows.filter(
            (assignment) => String(assignment.departmentId) === department.$id,
          ).length,
          // Events carry no departmentId — report 0 rather than repeating the
          // lead's global pipeline total on every department card.
          eventCount: 0,
        })),
        departmentMemberCounts: Object.fromEntries(
          deptDocs.map((department) => [
            department.$id,
            memberRows.filter(
              (assignment) =>
                String(assignment.departmentId) === department.$id,
            ).length,
          ]),
        ),
      };
    }

    // Global dumps require governance/audit/users capability.
    // Admin passes via "*"; heads without capability get nothing extra.
    if (canGovern) {
      const [
        allDepartments,
        allMembers,
        allMemberships,
        allEvents,
        pendingApplications,
        allApplications,
      ] = await Promise.all([
        safe(
          "admin.departments",
          () =>
            databases.listDocuments(DATABASE_ID, COLLECTIONS.DEPARTMENTS, [
              Query.equal("isActive", [true]),
              Query.limit(100),
            ]),
          { documents: [], total: 0 },
        ),
        safe(
          "admin.members",
          () =>
            databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_DEPARTMENTS, [
              Query.equal("isActive", [true]),
              Query.limit(500),
            ]),
          { documents: [], total: 0 },
        ),
        // Full membership scan (all statuses) so active/inactive/banned can
        // be counted from the same rows; capped at 500 with statsApproximate.
        safe(
          "admin.memberships",
          () =>
            databases.listDocuments(DATABASE_ID, COLLECTIONS.MEMBERSHIPS, [
              Query.limit(500),
            ]),
          { documents: [], total: 0 },
        ),
        safe(
          "admin.events",
          () =>
            databases.listDocuments(DATABASE_ID, COLLECTIONS.EVENTS, [
              Query.limit(100),
            ]),
          { documents: [], total: 0 },
        ),
        safe(
          "admin.pendingApplications",
          () =>
            databases.listDocuments(DATABASE_ID, COLLECTIONS.APPLICATIONS, [
              Query.equal("status", ["pending"]),
              Query.limit(100),
            ]),
          { documents: [], total: 0 },
        ),
        safe(
          "admin.allApplications",
          () =>
            databases.listDocuments(DATABASE_ID, COLLECTIONS.APPLICATIONS, [
              Query.limit(500),
            ]),
          { documents: [], total: 0 },
        ),
      ]);
      const countByStatus = (
        documents: Array<Record<string, unknown>>,
        status: string,
      ) => documents.filter((document) => document.status === status).length;

      result.admin = {
        stats: {
          // Pending/approved/rejected come from full-table totals where the
          // query used total; active/banned/inactive still need status scans
          // (limit 500 — documented as approximate for very large clubs).
          activeMembers: countByStatus(allMemberships.documents, "active"),
          inactiveMembers: countByStatus(allMemberships.documents, "inactive"),
          bannedMembers: countByStatus(allMemberships.documents, "banned"),
          pendingApplications: countByStatus(
            allApplications.documents,
            "pending",
          ),
          approvedApplications: countByStatus(
            allApplications.documents,
            "approved",
          ),
          rejectedApplications: countByStatus(
            allApplications.documents,
            "rejected",
          ),
        },
        departments: allDepartments.documents,
        events: allEvents.documents,
        pendingApplications: pendingApplications.documents,
        // True when a status scan hit the query cap and counts may be low.
        statsApproximate:
          allMemberships.documents.length >= 500 ||
          allApplications.documents.length >= 500,
      };
      const memberCountByDepartment = Object.fromEntries(
        allDepartments.documents.map((department) => {
          const d = department as Record<string, unknown> & { $id: string };

          return [
            d.$id,
            allMembers.documents.filter(
              (member) =>
                String((member as Record<string, unknown>).departmentId) ===
                d.$id,
            ).length,
          ];
        }),
      );
      const reviewEvents = allEvents.documents.filter(
        (event) =>
          String((event as Record<string, unknown>).status) === "review",
      );

      result.head = {
        stats: {
          totalDepartments: allDepartments.total,
          // Active membership rows ≈ people with a club membership (dept
          // assignment rows would double-count multi-department members).
          totalMembers: countByStatus(allMemberships.documents, "active"),
          pendingApprovals: reviewEvents.length,
          totalEvents: allEvents.total,
          inactiveMembers: countByStatus(allMemberships.documents, "inactive"),
          bannedMembers: countByStatus(allMemberships.documents, "banned"),
        },
        statsApproximate: allMemberships.documents.length >= 500,
        pendingApprovalEvents: reviewEvents,
        pendingApplications: pendingApplications.total,
        departments: allDepartments.documents,
        events: allEvents.documents,
        pendingApplicationRows: pendingApplications.documents,
        departmentMemberCounts: memberCountByDepartment,
        departmentHealth: allDepartments.documents.map((department) => {
          const d = department as Record<string, unknown> & {
            $id: string;
            name?: unknown;
          };

          return {
            name: d.name,
            memberCount: memberCountByDepartment[d.$id] ?? 0,
            // Events carry no departmentId in schema, so per-department counts
            // are unavailable. Report 0 rather than repeating the owner's total.
            eventCount: 0,
          };
        }),
      };
    }

    return ok(result);
  } catch (error) {
    logError("Dashboard data error:", error);

    return fail("INTERNAL", "Unable to load dashboard", 500);
  }
}
