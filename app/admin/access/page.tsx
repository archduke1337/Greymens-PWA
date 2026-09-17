// app/admin/access/page.tsx
"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, CardContent, Chip, Input } from "@heroui/react";
import { ArrowLeft, SearchIcon } from "lucide-react";
import MemberAvatar from "@/components/MemberAvatar";
import RolesManager from "@/components/admin/RolesManager";
import PowersManager from "@/components/admin/PowersManager";
import { usePermissions } from "@/context/PermissionContext";

type TabKey = "people" | "roles" | "powers";

/**
 * Merged Access console: roles (+ their assignments) and operational powers
 * used to live on separate pages, so "who can do what" took two visits and a
 * mental join. One console now answers it — the People tab is that join, the
 * other two tabs are where grants are made.
 *
 * Tabs are capability-filtered like Positions: a caller entitled to only one
 * half sees only that half (the server filters its read models the same way).
 */
const TABS: Array<{ key: TabKey; label: string; cap: string | string[] }> = [
  { key: "people", label: "People", cap: ["access.assign_roles", "powers.manage"] },
  { key: "roles", label: "Roles & assignments", cap: "access.assign_roles" },
  { key: "powers", label: "Powers", cap: "powers.manage" },
];

interface PersonRole {
  assignmentId: string;
  name: string;
  capabilities: string[];
  scope: string;
  expiresAt?: string;
}

interface PersonPower {
  grantId: string;
  name: string;
  scope: string;
  department?: string;
  expiresAt?: string;
}

interface PersonAccess {
  userId: string;
  name: string;
  urn?: string;
  avatar?: string;
  roles: PersonRole[];
  powers: PersonPower[];
}

interface AccessPayload {
  roles?: Array<{ $id: string; name?: unknown; capabilities?: unknown }>;
  assignments?: Array<{
    $id: string;
    userId?: string;
    roleId?: string;
    scopeType?: string;
    scopeId?: string;
    expiresAt?: string;
    isActive?: boolean;
  }>;
  accountNames?: Record<string, string>;
}

interface PowersPayload {
  powers?: Array<{ $id: string; displayName?: unknown; name?: unknown; scope?: string }>;
  grants?: Array<{
    $id: string;
    userId?: string;
    powerId?: string;
    departmentId?: string;
    expiresAt?: string;
    isActive?: boolean;
  }>;
  departments?: Array<{ $id: string; name?: string }>;
  accountNames?: Record<string, string>;
}

interface UsersPayload {
  users?: Array<{ profile?: { userId?: string; urn?: string; avatar?: string } }>;
  accountNames?: Record<string, string>;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include", cache: "no-store" });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data ? String((data as { error?: string }).error ?? "") : "";
    throw new Error(message || `Request failed (${response.status})`);
  }
  return data as T;
}

/** Expiry is enforced server-side on every check; mirror that here. */
function isLive(entry: { isActive?: boolean; expiresAt?: string }) {
  if (entry.isActive === false) return false;
  return !entry.expiresAt || new Date(entry.expiresAt).getTime() > Date.now();
}

function formatDate(value?: string) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleDateString();
}

function AccessConsole() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasCapability } = usePermissions();

  const requestedTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<TabKey>(() =>
    TABS.some((tab) => tab.key === requestedTab) ? (requestedTab as TabKey) : "people",
  );

  const [people, setPeople] = useState<PersonAccess[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const visibleTabs = useMemo(
    () =>
      TABS.filter((tab) =>
        Array.isArray(tab.cap) ? tab.cap.some((cap) => hasCapability(cap)) : hasCapability(tab.cap),
      ),
    [hasCapability],
  );

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(visibleTabs[0]?.key ?? "people");
    }
  }, [visibleTabs, activeTab]);

  const loadPeople = useCallback(async () => {
    setLoadingPeople(true);
    setLoadError("");
    try {
      // Three independent reads, joined client-side. Each can be refused
      // without taking the page down: an admin with only powers.manage still
      // sees who holds powers and is told why the role half is missing.
      const [accessResult, powersResult, usersResult] = await Promise.allSettled([
        fetchJson<AccessPayload>("/api/access"),
        fetchJson<PowersPayload>("/api/admin/powers"),
        fetchJson<UsersPayload>("/api/admin/users?limit=500"),
      ]);

      const accessPayload = accessResult.status === "fulfilled" ? accessResult.value : null;
      const powersPayload = powersResult.status === "fulfilled" ? powersResult.value : null;
      const usersPayload = usersResult.status === "fulfilled" ? usersResult.value : null;

      const nextNotes: string[] = [];
      if (accessResult.status === "rejected") {
        nextNotes.push(`Roles and assignments could not be read: ${accessResult.reason?.message ?? "unknown error"}.`);
      } else if (!Array.isArray(accessPayload?.roles) || !Array.isArray(accessPayload?.assignments)) {
        nextNotes.push(
          "Roles and assignments are hidden here because this account does not hold access.assign_roles.",
        );
      }
      if (powersResult.status === "rejected") {
        nextNotes.push(`Powers could not be read: ${powersResult.reason?.message ?? "unknown error"}.`);
      }
      if (usersResult.status === "rejected") {
        nextNotes.push("Member names and photos are unavailable, so this list falls back to URNs and user IDs.");
      }
      setNotes(nextNotes);

      const roleById = new Map((accessPayload?.roles ?? []).map((role) => [role.$id, role]));
      const powerById = new Map((powersPayload?.powers ?? []).map((power) => [power.$id, power]));
      const departmentById = new Map((powersPayload?.departments ?? []).map((dept) => [dept.$id, dept]));
      const profileByUser = new Map(
        (usersPayload?.users ?? []).map((entry) => [String(entry.profile?.userId ?? ""), entry.profile ?? {}]),
      );
      const nameByUser: Record<string, string> = {
        ...(accessPayload?.accountNames ?? {}),
        ...(powersPayload?.accountNames ?? {}),
        ...(usersPayload?.accountNames ?? {}),
      };

      const peopleByUser = new Map<string, PersonAccess>();
      const ensurePerson = (userId: string): PersonAccess => {
        const existing = peopleByUser.get(userId);
        if (existing) return existing;
        const profile = profileByUser.get(userId);
        const person: PersonAccess = {
          userId,
          name: nameByUser[userId] || profile?.urn || userId,
          urn: profile?.urn,
          avatar: profile?.avatar,
          roles: [],
          powers: [],
        };
        peopleByUser.set(userId, person);
        return person;
      };

      for (const assignment of accessPayload?.assignments ?? []) {
        const userId = String(assignment.userId ?? "");
        if (!userId || !isLive(assignment)) continue;
        const role = assignment.roleId ? roleById.get(assignment.roleId) : undefined;
        ensurePerson(userId).roles.push({
          assignmentId: assignment.$id,
          name: typeof role?.name === "string" && role.name ? role.name : "Unnamed role",
          capabilities: Array.isArray(role?.capabilities)
            ? role.capabilities.filter((capability): capability is string => typeof capability === "string")
            : [],
          scope: [assignment.scopeType || "global", assignment.scopeId].filter(Boolean).join(":"),
          expiresAt: assignment.expiresAt,
        });
      }

      for (const grant of powersPayload?.grants ?? []) {
        const userId = String(grant.userId ?? "");
        if (!userId || !isLive(grant)) continue;
        const power = grant.powerId ? powerById.get(grant.powerId) : undefined;
        const departmentName = grant.departmentId ? departmentById.get(grant.departmentId)?.name : undefined;
        ensurePerson(userId).powers.push({
          grantId: grant.$id,
          name:
            (typeof power?.displayName === "string" && power.displayName) ||
            (typeof power?.name === "string" && power.name) ||
            grant.powerId ||
            "Unknown power",
          scope: power?.scope || "global",
          department: typeof departmentName === "string" ? departmentName : undefined,
          expiresAt: grant.expiresAt,
        });
      }

      setPeople(
        [...peopleByUser.values()].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
        ),
      );
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load the access overview");
    } finally {
      setLoadingPeople(false);
    }
  }, []);

  useEffect(() => {
    void loadPeople();
  }, [loadPeople]);

  const filteredPeople = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return people;
    return people.filter((person) =>
      [
        person.name,
        person.urn,
        person.userId,
        ...person.roles.flatMap((role) => [role.name, ...role.capabilities]),
        ...person.powers.map((power) => `${power.name} ${power.department ?? ""}`),
      ].some((value) => String(value ?? "").toLowerCase().includes(q)),
    );
  }, [people, searchQuery]);

  if (visibleTabs.length === 0) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12">
        <Card className="border-none shadow-md">
          <CardContent className="p-8 text-center text-default-500">
            The access console requires the access.assign_roles or powers.manage capability.
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <Button variant="secondary" onPress={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-1" aria-hidden />
          Back
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Access &amp; Powers</h1>
          <p className="text-default-500 mt-1 text-sm md:text-base max-w-3xl">
            Who can do what, in one place. Role templates bundle capabilities on a scope with an optional
            expiry; operational powers are fixed grants. The People tab joins the two.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Access console sections">
        {visibleTabs.map((tab) => (
          <Button
            key={tab.key}
            size="sm"
            variant={activeTab === tab.key ? "primary" : "ghost"}
            aria-selected={activeTab === tab.key}
            isDisabled={activeTab === tab.key}
            onPress={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {notes.length > 0 && (
        <ul className="mb-6 space-y-1 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}

      {activeTab === "people" && (
        <section className="space-y-4" aria-label="Members with roles or powers">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              className="max-w-md"
              placeholder="Search by name, URN, role, or power..."
              aria-label="Search members, roles, and powers"
              value={searchQuery}
              onChange={(event: any) => setSearchQuery(event.target.value)}
            />
            <span className="text-sm text-default-500">
              {loadingPeople ? "Loading…" : `${filteredPeople.length} member${filteredPeople.length === 1 ? "" : "s"}`}
            </span>
          </div>

          {loadingPeople ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
                <p className="mt-4">Joining roles and powers...</p>
              </div>
            </div>
          ) : loadError ? (
            <Card className="border-none shadow-sm">
              <CardContent className="space-y-3 p-8 text-center">
                <p className="text-default-500">{loadError}</p>
                <Button variant="secondary" onPress={() => void loadPeople()}>
                  Try again
                </Button>
              </CardContent>
            </Card>
          ) : filteredPeople.length === 0 ? (
            <Card className="border-none shadow-sm">
              <CardContent className="p-8 text-center text-default-500">
                {searchQuery.trim()
                  ? "No member matches that search."
                  : "No member currently holds an active role or power."}
              </CardContent>
            </Card>
          ) : (
            filteredPeople.map((person) => (
              <Card key={person.userId} className="border-none shadow-sm">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center gap-3">
                    <MemberAvatar
                      src={person.avatar}
                      name={person.name}
                      className="w-10 h-10 text-sm font-bold flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold">{person.name}</h2>
                      <p className="truncate text-xs text-default-500">
                        {[person.urn, person.name === person.userId ? null : person.userId]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="ml-auto hidden flex-shrink-0 gap-1.5 sm:flex">
                      {person.roles.length > 0 && (
                        <Chip size="sm" variant="soft">
                          {person.roles.length} role{person.roles.length === 1 ? "" : "s"}
                        </Chip>
                      )}
                      {person.powers.length > 0 && (
                        <Chip size="sm" variant="soft">
                          {person.powers.length} power{person.powers.length === 1 ? "" : "s"}
                        </Chip>
                      )}
                    </div>
                  </div>

                  {person.roles.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-default-400">Roles</span>
                      {person.roles.map((role) => (
                        <Chip
                          key={role.assignmentId}
                          size="sm"
                          variant="soft"
                          title={[role.capabilities.join(", "), role.scope, formatDate(role.expiresAt)]
                            .filter(Boolean)
                            .join(" · ")}
                        >
                          {role.name}
                        </Chip>
                      ))}
                    </div>
                  )}

                  {person.powers.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-default-400">Powers</span>
                      {person.powers.map((power) => (
                        <Chip
                          key={power.grantId}
                          size="sm"
                          title={[power.scope, power.department, formatDate(power.expiresAt)]
                            .filter(Boolean)
                            .join(" · ")}
                        >
                          {power.name}
                        </Chip>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}

          <p className="flex items-center gap-1 text-xs text-default-400">
            <SearchIcon className="h-3 w-3" aria-hidden />
            Revoked and expired grants are omitted here; the Roles and Powers tabs keep the full trail.
          </p>
        </section>
      )}

      {activeTab === "roles" && <RolesManager />}
      {activeTab === "powers" && <PowersManager />}
    </main>
  );
}

export default function AdminAccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      }
    >
      <AccessConsole />
    </Suspense>
  );
}
