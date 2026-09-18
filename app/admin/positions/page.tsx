"use client";

import type { Department, Designation } from "@/lib/types";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Card, CardContent, Chip, Input, Spinner } from "@heroui/react";
import { SearchIcon } from "lucide-react";

import { getErrorMessage, readApiError } from "@/lib/errorHandler";
import { usePermissions } from "@/context/PermissionContext";
import { useAuth } from "@/context/AuthContext";
import DesignationsManager from "@/components/admin/DesignationsManager";
import { logError } from "@/lib/logger";

type TabKey = "people" | "designations";

interface PersonDesignation {
  designationId: string;
  name: string;
}

interface Person {
  userId: string;
  name: string;
  urn?: string;
  designations: PersonDesignation[];
}

interface DesignationsData {
  designations: Array<Designation & { holderCount?: number }>;
  departments: Department[];
  people: Person[];
  accountNames: Record<string, string>;
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "people", label: "People" },
  { key: "designations", label: "Designations" },
];

/**
 * Titles and ranks.
 *
 * A designation is an honour by default and grants nothing. It only carries
 * authority when an administrator lists capabilities on it, which makes it a
 * grant like the other three — and therefore subject to the same
 * no-grant-beyond-hold rule, and visible in the Access console's People tab.
 * The distinction this page keeps is who administers it, not whether it can
 * grant: titles are managed here, capability bundles elsewhere.
 */
export default function AdminDesignationsPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasCapability } = usePermissions();
  const router = useRouter();
  const [data, setData] = useState<DesignationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("people");
  const [searchQuery, setSearchQuery] = useState("");

  const canAssign = hasCapability("designations.assign");

  const loadData = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/positions", {
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as
        (DesignationsData & { error?: string }) | null;

      if (!response.ok)
        throw new Error(readApiError(payload, "Unable to load designations"));
      setData(payload as DesignationsData);
    } catch (error) {
      logError("Error loading designations:", error);
      toast.error(getErrorMessage(error) || "Failed to load designations");
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

  const filteredPeople = useMemo(() => {
    const list = data?.people ?? [];
    const q = searchQuery.trim().toLowerCase();

    if (!q) return list;

    return list.filter((person) =>
      [
        person.name,
        person.urn,
        person.userId,
        ...person.designations.map((desig) => desig.name),
      ].some((value) => (value ?? "").toLowerCase().includes(q)),
    );
  }, [data, searchQuery]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div
          aria-label="Loading designations"
          className="text-center space-y-4"
          role="status"
        >
          <Spinner size="lg" />
          <p className="text-default-500">Loading designations...</p>
        </div>
      </div>
    );
  }
  if (!user) return null;
  if (!canAssign) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12">
        <Card>
          <CardContent className="p-8 text-center text-muted">
            Designation management requires the designations.assign capability.
          </CardContent>
        </Card>
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
          <h1 className="text-3xl font-bold">Designations</h1>
          <p className="text-muted">
            Titles and ranks. A designation grants nothing unless capabilities
            are listed on it — then it is an auditable grant, and it appears in
            the Access console alongside roles, offices and powers.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        {TABS.map((tab) => (
          <Button
            key={tab.key}
            isDisabled={activeTab === tab.key}
            size="sm"
            variant={activeTab === tab.key ? "primary" : "secondary"}
            onPress={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "people" && (
        <div className="space-y-4">
          <Input
            aria-label="Search title holders"
            placeholder="Search by name, URN, or designation..."
            value={searchQuery}
            onChange={(e: any) => setSearchQuery(e.target.value)}
          />
          {filteredPeople.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted">
                {searchQuery.trim()
                  ? "No holders match your search."
                  : "No designations are currently held."}
              </CardContent>
            </Card>
          ) : (
            filteredPeople.map((person) => (
              <Card key={person.userId}>
                <CardContent className="space-y-3 p-5">
                  <div>
                    <h3 className="font-semibold">{person.name}</h3>
                    <p className="text-xs text-muted">
                      {person.urn || person.userId}
                    </p>
                  </div>
                  {person.designations.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                        Titles
                      </span>
                      {person.designations.map((desig) => (
                        <Chip
                          key={desig.designationId}
                          size="sm"
                          variant="soft"
                        >
                          {desig.name}
                        </Chip>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
          <p className="text-xs text-muted">
            <SearchIcon className="mr-1 inline h-3 w-3" />A title with no
            capabilities listed is display-only. Anything that grants authority
            shows up in the Access console.
          </p>
        </div>
      )}

      {activeTab === "designations" && data && (
        <DesignationsManager
          departments={data.departments}
          designations={data.designations}
          onChanged={loadData}
        />
      )}
    </main>
  );
}
