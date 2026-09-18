import type { Metadata } from "next";
import Link from "next/link";
import { Query } from "appwrite";
import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { getAccountNames } from "@/lib/server-users";
import { TeamDirectory, type TeamGroup } from "@/components/team/TeamDirectory";
import { Alert, Button, Card, Chip } from "@heroui/react";

export const metadata: Metadata = {
  title: "Leadership",
  description:
    "The students who run Greymens Club — officers and leads as recorded in the club's designation register.",
};

/**
 * Leadership is read from the governance tables at request time.
 *
 * This page previously rendered a hardcoded list of invented people — names,
 * biographies and awards (\"Forbes 30 Under 30\", \"TEDx Speaker\") that had no
 * relationship to anyone in the club, alongside invented statistics. Presenting
 * fabricated officers and achievements on a public site is a trust problem, not
 * a placeholder. Everything below comes from `designations` and `user_designations`,
 * so it reflects the club's actual structure.
 *
 * Rendered per request rather than at build time: the build must not depend on
 * database availability or credentials.
 */
export const dynamic = "force-dynamic";

interface DesignationRow {
  $id: string;
  name: string;
  slug: string;
  level: number;
  badgeIcon?: string;
}

interface UserDesignationRow {
  userId: string;
  designationId: string;
}

interface ProfileRow {
  userId: string;
  avatar?: string;
  bio?: string;
  skills?: string[];
  githubUrl?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  profileVisibility?: string;
  showOnAboutPage?: boolean;
}

/**
 * A profile is public here only if its owner opted in. `profileVisibility` was
 * stored by onboarding but never actually honoured by any read path, so a member
 * who chose "private" was still exposed.
 */
function isPubliclyVisible(profile: ProfileRow): boolean {
  if (profile.profileVisibility === "private") return false;
  return profile.showOnAboutPage === true || profile.profileVisibility === "public";
}

async function loadLeadership(): Promise<TeamGroup[]> {
  const { databases } = createServerDatabases();

  // Level 4 and above are the club's officer and lead tiers; anything lower is a
  // working designation and is not published as leadership.
  const designations = await databases.listDocuments(DATABASE_ID, COLLECTIONS.DESIGNATIONS, [
    Query.equal("isActive", [true]),
    Query.greaterThanEqual("level", 4),
    Query.orderDesc("level"),
    Query.limit(50),
  ]);
  if (designations.documents.length === 0) return [];

  const designationRows = designations.documents as unknown as DesignationRow[];
  const designationIds = designationRows.map((row) => row.$id);

  const assignments = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_DESIGNATIONS, [
    Query.equal("designationId", designationIds),
    Query.equal("isActive", [true]),
    Query.limit(500),
  ]);
  const assignmentRows = assignments.documents as unknown as UserDesignationRow[];
  if (assignmentRows.length === 0) return [];

  const userIds = [...new Set(assignmentRows.map((row) => row.userId))];
  const [profiles, names] = await Promise.all([
    databases.listDocuments(DATABASE_ID, COLLECTIONS.PROFILES, [
      Query.equal("userId", userIds),
      Query.limit(500),
    ]),
    getAccountNames(userIds),
  ]);

  const visibleProfiles = new Map(
    (profiles.documents as unknown as ProfileRow[])
      .filter(isPubliclyVisible)
      .map((profile) => [profile.userId, profile])
  );

  return designationRows
    .map((designation) => {
      const members = assignmentRows
        .filter((assignment) => assignment.designationId === designation.$id)
        .map((assignment) => {
          const profile = visibleProfiles.get(assignment.userId);
          const name = names.get(assignment.userId);
          if (!profile || !name) return null;
          return {
            userId: assignment.userId,
            name,
            avatar: profile.avatar,
            bio: profile.bio,
            skills: Array.isArray(profile.skills) ? profile.skills : [],
            githubUrl: profile.githubUrl,
            linkedinUrl: profile.linkedinUrl,
            portfolioUrl: profile.portfolioUrl,
          };
        })
        .filter((member): member is NonNullable<typeof member> => member !== null);

      return {
        designation: designation.name,
        slug: designation.slug,
        badgeIcon: designation.badgeIcon,
        members,
      };
    })
    .filter((group) => group.members.length > 0);
}

export default async function TeamPage() {
  let groups: TeamGroup[] = [];
  let failed = false;

  try {
    groups = await loadLeadership();
  } catch (error) {
    console.error("Leadership lookup error:", error);
    failed = true;
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-14 space-y-12">
      <header className="space-y-4 max-w-2xl">
        <Chip size="sm" variant="soft">
          Governance
        </Chip>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Who runs the club</h1>
        <p className="text-default-600">
          Officers and leads, exactly as recorded in the club&apos;s
          designation register — no honorary names, no filler. If someone
          holds a title here, they hold the work that comes with it.
        </p>
      </header>

      <figure className="space-y-2">
        <div className="overflow-hidden rounded-3xl border border-default-200/70">
          <img
            src="/Assets/Banners/clut.jpg"
            alt="A crowd in black and white with one figure lit in green binary code"
            loading="lazy"
            className="h-44 w-full object-cover sm:h-60"
          />
        </div>
        <figcaption className="text-center text-sm text-muted">
          Leadership here isn&apos;t a title — it&apos;s whoever steps forward,
          does the work, and hands it over.
        </figcaption>
      </figure>

      {failed ? (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>The register wouldn&apos;t load</Alert.Title>
            <Alert.Description>
              The leadership register could not be reached. Try again shortly.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : (
        <TeamDirectory groups={groups} />
      )}

      <Card variant="secondary">
        <Card.Content className="flex flex-col items-center gap-4 p-8 text-center sm:flex-row sm:text-left">
          <div className="min-w-0 flex-1 space-y-1.5">
            <h2 className="text-lg font-bold tracking-tight">Want your name up there?</h2>
            <p className="text-sm leading-relaxed text-muted">
              Titles go to members who do the work first. Join, show up for a
              few months, and the register takes care of itself.
            </p>
          </div>
          <Link href="/register" className="shrink-0">
            <Button className="rounded-full px-6">Join the club</Button>
          </Link>
        </Card.Content>
      </Card>
    </div>
  );
}
