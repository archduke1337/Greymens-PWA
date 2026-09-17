"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorHandler";
import { Button, Card, CardContent, Chip, Input } from "@heroui/react";
import { Loader2, SearchIcon } from "lucide-react";
import OfficesManager, { type OfficeAssignment, type MemberOption } from "@/components/admin/OfficesManager";
import DesignationsManager from "@/components/admin/DesignationsManager";
import type { Department, Designation } from "@/lib/types";

type TabKey = "people" | "offices" | "designations";

interface PersonOffices {
  officeId: string;
  title: string;
  assignmentId: string;
  selectionMethod: string;
  termStart: string;
  termEnd?: string;
  status: string;
}

interface PersonDesignation {
  designationId: string;
  name: string;
}

interface Person {
  userId: string;
  name: string;
  urn?: string;
  branch?: string;
  offices: PersonOffices[];
  designations: PersonDesignation[];
}

interface PositionsData {
  canManageOffices: boolean;
  canAssignDesignations: boolean;
  assignments: OfficeAssignment[];
  members: MemberOption[];
  designations: Array<Designation & { holderCount?: number }>;
  departments: Department[];
  people: Person[];
  accountNames: Record<string, string>;
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "people", label: "People" },
  { key: "offices", label: "Offices" },
  { key: "designations", label: "Designations" },
];

export default function AdminPositionsPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasCapability } = usePermissions();
  const router = useRouter();
  const [data, setData] = useState<PositionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("people");
  const [searchQuery, setSearchQuery] = useState("");

  const canOffices = hasCapability("governance.manage_offices");
  const canDesignations = hasCapability("designations.assign");

  const loadData = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/positions", { credentials: "include" });
      const payload = (await response.json().catch(() => null)) as (PositionsData & { error?: string }) | null;
      if (!response.ok) throw new Error(payload?.error || "Unable to load positions");
      setData(payload as PositionsData);
    } catch (error) {
      console.error("Error loading positions:", error);
      toast.error(getErrorMessage(error) || "Failed to load positions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (!authLoading && user) void loadData();
  }, [user, authLoading, router, loadData]);

  const visibleTabs = useMemo(() => {
    // A caller entitled to only one system sees only its tab — the server
    // filters the read model the same way, so hidden tabs have no data.
    if (canOffices && canDesignations) return TABS;
    if (canOffices) return TABS.filter((tab) => tab.key !== "designations");
    if (canDesignations) return TABS.filter((tab) => tab.key !== "offices");
    return TABS;
  }, [canOffices, canDesignations]);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(visibleTabs[0]?.key ?? "people");
    }
  }, [visibleTabs, activeTab]);

  const filteredPeople = useMemo(() => {
    const list = data?.people ?? [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((person) =>
      [
        person.name,
        person.urn,
        person.branch,
        person.userId,
        ...person.offices.map((office) => office.title),
        ...person.designations.map((desig) => desig.name),
      ].some((value) => (value ?? "").toLowerCase().includes(q)),
    );
  }, [data, searchQuery]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
      </div>
    );
  }
  if (!user) return null;
  if (!canOffices && !canDesignations) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12">
        <Card><CardContent className="p-8 text-center text-[var(--muted)]">
          Position management requires the offices or designations capability.
        </CardContent></Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-12">
      <div className="flex items-center gap-4">
        <Button variant="secondary" onPress={() => router.back()}>
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Positions</h1>
          <p className="text-[var(--muted)]">
            Constitutional offices and designations in one place. Offices grant
            real capabilities and run on fixed terms; designations are titles
            and ranks that grant none — the two are labelled, never merged.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        {visibleTabs.map((tab) => (
          <Button
            key={tab.key}
            size="sm"
            variant={activeTab === tab.key ? "primary" : "ghost"}
            isDisabled={activeTab === tab.key}
            onPress={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "people" && (
        <div className="space-y-4">
          <Input
            placeholder="Search by name, URN, branch, office, or designation..."
            value={searchQuery}
            onChange={(e: any) => setSearchQuery(e.target.value)}
            aria-label="Search position holders"
          />
          {filteredPeople.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-[var(--muted)]">
              {searchQuery.trim() ? "No holders match your search." : "No offices or designations are currently held."}
            </CardContent></Card>
          ) : (
            filteredPeople.map((person) => (
              <Card key={person.userId}>
                <CardContent className="space-y-3 p-5">
                  <div>
                    <h3 className="font-semibold">{person.name}</h3>
                    <p className="text-xs text-[var(--muted)]">
                      {[person.urn, person.branch].filter(Boolean).join(" · ") || person.userId}
                    </p>
                  </div>
                  {person.offices.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Offices</span>
                      {person.offices.map((office) => (
                        <Chip key={office.assignmentId} size="sm" color="accent" title={`${office.selectionMethod} · term from ${office.termStart}${office.termEnd ? ` to ${office.termEnd}` : ""}`}>
                          {office.title}
                        </Chip>
                      ))}
                    </div>
                  )}
                  {person.designations.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Titles</span>
                      {person.designations.map((desig) => (
                        <Chip key={desig.designationId} size="sm" variant="soft">
                          {desig.name}
                        </Chip>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
          <p className="text-xs text-[var(--muted)]">
            <SearchIcon className="mr-1 inline h-3 w-3" />
            Office chips carry capabilities; title chips are display-only.
          </p>
        </div>
      )}

      {activeTab === "offices" && data && (
        <OfficesManager
          assignments={data.assignments}
          members={data.members}
          membersAvailable={data.canManageOffices}
          accountNames={data.accountNames}
          onChanged={loadData}
        />
      )}

      {activeTab === "designations" && data && (
        <DesignationsManager
          designations={data.designations}
          departments={data.departments}
          onChanged={loadData}
        />
      )}
    </main>
  );
}
