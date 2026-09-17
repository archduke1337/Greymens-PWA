// app/admin/powers/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PlusIcon,
  TrashIcon,
  CheckIcon,
  XIcon,
  SearchIcon,
  ZapIcon,
  ShieldIcon,
  UsersIcon,
} from "lucide-react";
import { getErrorMessage } from "@/lib/errorHandler";
import MemberAvatar from "@/components/MemberAvatar";
import {
  Button,
  Card,
  CardContent,
  Chip,
  Input,
  Label,
  ListBox,
  Modal,
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  useOverlayState,
} from "@heroui/react";
import type { Power, UserPower, Department, Profile } from "@/lib/types";

const CATEGORY_LABELS: Record<string, string> = {
  membership: "Membership",
  events: "Events",
  tickets: "Tickets",
  content: "Content",
  resources: "Resources",
  admin: "Admin",
  gallery: "Gallery",
  social: "Social",
};

const CATEGORY_COLORS: Record<string, string> = {
  membership: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  events: "bg-muted text-muted-foreground",
  tickets: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  content: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  resources: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  admin: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  gallery: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  social: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
};

const SCOPE_COLORS: Record<string, string> = {
  global: "bg-red-100 text-red-700",
  department: "bg-amber-100 text-amber-700",
  own: "bg-green-100 text-green-700",
};

export default function AdminPowersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [powers, setPowers] = useState<Power[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Grouped powers by category
  const [groupedPowers, setGroupedPowers] = useState<Record<string, Power[]>>({});
  const [catalogueQuery, setCatalogueQuery] = useState("");

  // Grant modal
  const { isOpen: isGrantOpen, open: openGrant, close: closeGrant } = useOverlayState();
  const [grantTarget, setGrantTarget] = useState<Power | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [resultNames, setResultNames] = useState<Record<string, string>>({});
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [grantScope, setGrantScope] = useState<{ departmentId?: string; expiresAt?: string }>({});
  const [granting, setGranting] = useState(false);

  // View holders modal
  const { isOpen: isHoldersOpen, open: openHolders, close: closeHolders } = useOverlayState();
  const [holdersTarget, setHoldersTarget] = useState<Power | null>(null);
  const [holders, setHolders] = useState<(UserPower & { profile?: Profile | null })[]>([]);
  const [holderNames, setHolderNames] = useState<Record<string, string>>({});
  const [loadingHolders, setLoadingHolders] = useState(false);
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
    loadData();
  }, [user, authLoading, router]);

  const loadData = async () => {
    try {
      const response = await fetch("/api/admin/powers", { credentials: "include" });
      const payload = (await response.json()) as { powers?: Power[]; departments?: Department[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to load powers");
      const allPowers = payload.powers ?? [];
      const allDepts = payload.departments ?? [];
      setPowers(allPowers);
      setDepartments(allDepts);

      // Group by category
      const grouped: Record<string, Power[]> = {};
      for (const power of allPowers) {
        if (!grouped[power.category]) {
          grouped[power.category] = [];
        }
        grouped[power.category].push(power);
      }
      setGroupedPowers(grouped);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load powers");
    } finally {
      setLoading(false);
    }
  };

  // --- Grant Flow ---
  const handleOpenGrant = (power: Power) => {
    setGrantTarget(power);
    setSearchQuery("");
    setSearchResults([]);
    setResultNames({});
    setDirectory(null);
    setSelectedUser(null);
    setGrantScope({});
    openGrant();
  };

  // Member directory cache: one 500-row fetch per modal session, not per
  // keystroke. Entries carry the account name so search AND display both
  // work through names, not just URNs and raw IDs.
  const [directory, setDirectory] = useState<{
    profiles: Profile[];
    names: Record<string, string>;
  } | null>(null);

  const handleSearchUsers = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      let directoryData = directory;
      if (!directoryData) {
        const response = await fetch("/api/admin/users?limit=500", { credentials: "include" });
        const payload = (await response.json().catch(() => null)) as { users?: Array<{ profile: Profile }>; accountNames?: Record<string, string>; error?: string } | null;
        if (!response.ok) throw new Error(payload?.error || "Unable to search users");
        directoryData = {
          profiles: (payload?.users ?? []).map((entry) => entry.profile),
          names: payload?.accountNames ?? {},
        };
        setDirectory(directoryData);
        setResultNames(directoryData.names);
      }
      const query = searchQuery.trim().toLowerCase();
      const names = directoryData.names;
      const displayName = (profile: Profile) =>
        names[profile.userId] || profile.urn || profile.userId;
      // Search spans the cached directory (500 most recent profiles) — the
      // empty-state copy below says so instead of pretending it is global.
      // Name first: that is what the admin actually types.
      const results = directoryData.profiles
        .map((profile) => ({
          profile,
          rank: names[profile.userId]?.toLowerCase().includes(query)
            ? 0
            : [profile.urn, profile.program, profile.branch, profile.userId].some((value) =>
              String(value ?? "").toLowerCase().includes(query)) ? 1 : -1,
          _display: displayName(profile),
        }))
        .filter((entry) => entry.rank >= 0)
        .sort((a, b) => a.rank - b.rank || a._display.localeCompare(b._display))
        .map((entry) => entry.profile);
      setSearchResults(results);
    } catch (error) {
      console.error("Error searching users:", error);
      toast.error(getErrorMessage(error) || "Failed to search users");
    } finally {
      setSearching(false);
    }
  };

  const handleGrant = async () => {
    if (!selectedUser || !grantTarget || !user) return;
    setGranting(true);
    try {
      const response = await fetch("/api/admin/powers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "grant",
          userId: selectedUser.userId,
          powerId: grantTarget.$id,
          departmentId: grantScope.departmentId || null,
          expiresAt: grantScope.expiresAt || null,
        }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Unable to grant power");
      toast.success(
        `Power "${grantTarget.displayName}" granted to ${resultNames[selectedUser.userId] || selectedUser.urn || selectedUser.userId}!`
      );
      closeGrant();
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Error granting power:", message);
      toast.error(message || "Failed to grant power");
    } finally {
      setGranting(false);
    }
  };

  // --- View Holders & Revoke Flow ---
  const handleOpenHolders = async (power: Power) => {
    setHoldersTarget(power);
    setLoadingHolders(true);
    openHolders();
    try {
      const [powerResponse, usersResponse] = await Promise.all([
        fetch("/api/admin/powers", { credentials: "include" }),
        fetch("/api/admin/users?limit=500", { credentials: "include" }),
      ]);
      const powerPayload = (await powerResponse.json().catch(() => null)) as { grants?: UserPower[]; error?: string } | null;
      const usersPayload = (await usersResponse.json().catch(() => null)) as { users?: Array<{ profile: Profile }>; accountNames?: Record<string, string>; error?: string } | null;
      if (!powerResponse.ok) throw new Error(powerPayload?.error || "Unable to load power holders");
      const profileByUser = new Map((usersPayload?.users ?? []).map((entry) => [entry.profile.userId, entry.profile]));
      const holderNames = usersPayload?.accountNames ?? {};
      setHolderNames(holderNames);
      const holdersData = (powerPayload?.grants ?? []).filter((grant) => grant.powerId === power.$id);
      setHolders(holdersData.map((holder) => ({ ...holder, profile: profileByUser.get(holder.userId) ?? null })));
    } catch (error) {
      console.error("Error loading holders:", error);
      toast.error(getErrorMessage(error) || "Failed to load power holders");
    } finally {
      setLoadingHolders(false);
    }
  };

  const handleRevoke = async (userId: string) => {
    if (!holdersTarget) return;
    if (!confirm(`Revoke "${holdersTarget.displayName}" from this member? They lose this privilege immediately.`)) return;
    setRevokingUserId(userId);
    try {
      const response = await fetch("/api/admin/powers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "revoke", userId, powerId: holdersTarget.$id }),
      });
      const payload = (await response.json().catch(() => null)) as { revoked?: number; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Unable to revoke power");
      toast.success(
        typeof payload?.revoked === "number" && payload.revoked === 0
          ? "No active grant found — nothing revoked"
          : "Power revoked successfully!",
      );
      setHolders((prev) => prev.filter((h) => h.userId !== userId));
    } catch (error) {
      console.error("Error revoking power:", error);
      toast.error(getErrorMessage(error) || "Failed to revoke power");
    } finally {
      setRevokingUserId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4">Loading powers...</p>
        </div>
      </div>
    );
  }

  const totalGlobal = powers.filter((p) => p.scope === "global").length;
  const totalDept = powers.filter((p) => p.scope === "department").length;
  const totalOwn = powers.filter((p) => p.scope === "own").length;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Power Management
          </h1>
          <p className="text-default-500 mt-1 text-sm md:text-base">
            Manage user powers, permissions, and scopes
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Total Powers</p>
                <p className="text-2xl font-bold">{powers.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <ZapIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Global Scope</p>
                <p className="text-2xl font-bold">{totalGlobal}</p>
              </div>
              <Chip size="sm" className={SCOPE_COLORS.global}>
                Global
              </Chip>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Department Scope</p>
                <p className="text-2xl font-bold">{totalDept}</p>
              </div>
              <Chip size="sm" className={SCOPE_COLORS.department}>
                Department
              </Chip>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Own Scope</p>
                <p className="text-2xl font-bold">{totalOwn}</p>
              </div>
              <Chip size="sm" className={SCOPE_COLORS.own}>
                Own
              </Chip>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Powers Grouped by Category */}
      <Card className="border-none shadow-md mb-2">
        <CardContent className="p-4">
          <Input
            placeholder="Filter powers by name or capability..."
            aria-label="Filter powers by name or capability"
            value={catalogueQuery}
            onChange={(e: any) => setCatalogueQuery(e.target.value)}
          />
        </CardContent>
      </Card>
      <div className="space-y-8">
        {Object.keys(groupedPowers).length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-lg text-default-600">No powers defined yet</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedPowers).map(([category, categoryPowers]) => {
            const q = catalogueQuery.trim().toLowerCase();
            const visible = q
              ? categoryPowers.filter((power) =>
                [power.displayName, power.name, power.description, category]
                  .some((value) => String(value ?? "").toLowerCase().includes(q)),
              )
              : categoryPowers;
            if (visible.length === 0) return null;
            return (
            <div key={category}>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-bold capitalize">
                  {CATEGORY_LABELS[category] || category}
                </h2>
                <Chip size="sm" className={CATEGORY_COLORS[category]}>
                  {visible.length} powers
                </Chip>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {visible.map((power) => (
                  <Card
                    key={power.$id}
                    className="border-none shadow-md hover:shadow-lg transition-shadow"
                  >
                    <CardContent className="space-y-3 p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-base">
                            {power.displayName}
                          </h3>
                          <p className="text-xs text-default-400 font-mono">
                            {power.name}
                          </p>
                        </div>
                        <Chip
                          size="sm"
                          className={SCOPE_COLORS[power.scope]}
                        >
                          {power.scope}
                        </Chip>
                      </div>

                      {power.description && (
                        <p className="text-sm text-default-500 line-clamp-2">
                          {power.description}
                        </p>
                      )}

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          className="flex-1"
                          onPress={() => handleOpenGrant(power)}
                        >
                          <ShieldIcon className="w-4 h-4 mr-1" />
                          Grant
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          className="flex-1"
                          onPress={() => handleOpenHolders(power)}
                        >
                          <UsersIcon className="w-4 h-4 mr-1" />
                          Holders
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* Grant Modal */}
      <Modal>
        <ModalBackdrop
          isOpen={isGrantOpen}
          onOpenChange={(open: boolean) => {
            if (!open) closeGrant();
          }}
        >
          <ModalContainer>
            <ModalDialog>
              {({ close: dialogClose }: { close: () => void }) => (
                <div>
                  <ModalHeader className="flex flex-col gap-1 border-b pb-4">
                    <h2 className="text-xl font-bold">
                      Grant Power: {grantTarget?.displayName}
                    </h2>
                    <p className="text-sm text-default-500 font-normal">
                      Search for a user and grant them this power
                    </p>
                  </ModalHeader>

                  <ModalBody className="py-6 space-y-4">
                    {/* Search */}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Search by name, URN, branch, or user ID..."
                        aria-label="Search members by name, URN, branch, or user ID"
                        value={searchQuery}
                        onChange={(e: any) => setSearchQuery(e.target.value)}
                        onKeyDown={(e: any) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSearchUsers();
                          }
                        }}
                        className="flex-1"
                      />
                      <Button
                        variant="primary"
                        onPress={handleSearchUsers}
                        isPending={searching}
                      >
                        <SearchIcon className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Search Results */}
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {searchResults.length === 0 &&
                        searchQuery &&
                        !searching && (
                          <p className="text-sm text-default-400 text-center py-4">
                            No results in the 500 most recent profiles. Try a different search.
                          </p>
                        )}
                      {searchResults.map((profile) => {
                        const displayName = resultNames[profile.userId] || profile.urn || profile.userId;
                        return (
                        <button
                          key={profile.userId}
                          type="button"
                          onClick={() => setSelectedUser(profile)}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${
                            selectedUser?.userId === profile.userId
                              ? "border-primary bg-primary/10"
                              : "border-default-200 hover:bg-default-100"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <MemberAvatar
                              src={profile.avatar}
                              name={displayName}
                              className="w-8 h-8 text-xs font-bold flex-shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {displayName}
                              </p>
                              <p className="text-xs text-default-400 truncate">
                                {[profile.urn, profile.branch, profile.program]
                                  .filter(Boolean)
                                  .join(" | ")}
                              </p>
                            </div>
                          </div>
                        </button>
                        );
                      })}
                    </div>

                    {/* Selected User */}
                    {selectedUser && (
                      <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
                        <p className="text-sm font-semibold">Selected:</p>
                        <p className="text-sm">
                          {resultNames[selectedUser.userId] || selectedUser.urn || selectedUser.userId}
                        </p>
                        {(resultNames[selectedUser.userId] || selectedUser.urn) && (
                          <p className="text-xs text-default-400">
                            {[selectedUser.urn, selectedUser.branch].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Scope Options */}
                    {grantTarget?.scope === "department" && (
                      <div>
                        <Select
                          fullWidth
                          placeholder="Select department (optional)"
                          value={grantScope.departmentId || null}
                          onChange={(value) =>
                            setGrantScope({
                              ...grantScope,
                              departmentId: String(value ?? "") || undefined,
                            })
                          }
                        >
                          <Label>Department Scope (optional)</Label>
                          <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              {departments.map((dept) => (
                                <ListBox.Item key={dept.$id} id={dept.$id} textValue={dept.name}>
                                  {dept.name}
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                              ))}
                            </ListBox>
                          </Select.Popover>
                        </Select>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        Expiration Date (optional)
                      </label>
                      <Input
                        type="date"
                        value={grantScope.expiresAt || ""}
                        onChange={(e: any) =>
                          setGrantScope({
                            ...grantScope,
                            expiresAt: e.target.value || undefined,
                          })
                        }
                      />
                    </div>
                  </ModalBody>

                  <ModalFooter className="border-t pt-4">
                    <Button
                      variant="primary"
                      className="w-full sm:w-auto"
                      onPress={closeGrant}
                    >
                      Cancel
                    </Button>
                    <Button
                      isPending={granting}
                      isDisabled={!selectedUser}
                      className="w-full sm:w-auto bg-primary text-primary-foreground font-semibold transition-opacity hover:opacity-90"
                      onPress={handleGrant}
                    >
                      Grant Power
                    </Button>
                  </ModalFooter>
                </div>
              )}
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>

      {/* View Holders Modal */}
      <Modal>
        <ModalBackdrop
          isOpen={isHoldersOpen}
          onOpenChange={(open: boolean) => {
            if (!open) {
              setHolders([]);
              closeHolders();
            }
          }}
        >
          <ModalContainer>
            <ModalDialog>
              {({ close: dialogClose }: { close: () => void }) => (
                <div>
                  <ModalHeader className="flex flex-col gap-1 border-b pb-4">
                    <h2 className="text-xl font-bold">
                      Holders: {holdersTarget?.displayName}
                    </h2>
                    <p className="text-sm text-default-500 font-normal">
                      Users who currently have this power
                    </p>
                  </ModalHeader>

                  <ModalBody className="py-6">
                    {loadingHolders ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                      </div>
                    ) : holders.length === 0 ? (
                      <p className="text-sm text-default-400 text-center py-8">
                        No active holders for this power.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {holders.map((holder) => (
                          <div
                            key={holder.$id}
                            className="flex items-center justify-between p-3 border border-default-200 rounded-lg"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <MemberAvatar
                                src={holder.profile?.avatar}
                                name={holderNames[holder.userId] || holder.profile?.urn || holder.userId}
                                className="w-8 h-8 text-xs font-bold flex-shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {holderNames[holder.userId] || holder.profile?.urn || holder.userId}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-default-400">
                                  <span>
                                    Granted:{" "}
                                    {new Date(
                                      holder.grantedAt
                                    ).toLocaleDateString()}
                                  </span>
                                  {holder.departmentId && (
                                    <Chip
                                      size="sm"
                                      className="bg-amber-100 text-amber-700 text-xs"
                                    >
                                      {departments.find((dept) => dept.$id === holder.departmentId)?.name || "Dept-scoped"}
                                    </Chip>
                                  )}
                                  {holder.expiresAt && (
                                    <Chip
                                      size="sm"
                                      className="bg-red-100 text-red-700 text-xs"
                                    >
                                      Expires:{" "}
                                      {new Date(
                                        holder.expiresAt
                                      ).toLocaleDateString()}
                                    </Chip>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="primary"
                              isIconOnly
                              isPending={revokingUserId === holder.userId}
                              onPress={() => handleRevoke(holder.userId)}
                            >
                              <TrashIcon className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </ModalBody>

                  <ModalFooter className="border-t pt-4">
                    <Button
                      variant="primary"
                      className="w-full sm:w-auto"
                      onPress={() => {
                        setHolders([]);
                        closeHolders();
                      }}
                    >
                      Close
                    </Button>
                  </ModalFooter>
                </div>
              )}
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>
    </div>
  );
}
