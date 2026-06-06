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
import { powerService } from "@/lib/powers";
import { departmentService } from "@/lib/departments";
import { profileService } from "@/lib/profiles";
import { getErrorMessage } from "@/lib/errorHandler";
import {
  Button,
  Card,
  CardContent,
  Chip,
  Input,
  Modal,
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalBody,
  ModalFooter,
  ModalHeader,
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
  events: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
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

  // Grant modal
  const { isOpen: isGrantOpen, open: openGrant, close: closeGrant } = useOverlayState();
  const [grantTarget, setGrantTarget] = useState<Power | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [grantScope, setGrantScope] = useState<{ departmentId?: string; expiresAt?: string }>({});
  const [granting, setGranting] = useState(false);

  // View holders modal
  const { isOpen: isHoldersOpen, open: openHolders, close: closeHolders } = useOverlayState();
  const [holdersTarget, setHoldersTarget] = useState<Power | null>(null);
  const [holders, setHolders] = useState<(UserPower & { profile?: Profile | null })[]>([]);
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
      const [allPowers, allDepts] = await Promise.all([
        powerService.getAll(),
        departmentService.getAll(),
      ]);
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
    setSelectedUser(null);
    setGrantScope({});
    openGrant();
  };

  const handleSearchUsers = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await profileService.search(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error("Error searching users:", error);
      toast.error("Failed to search users");
    } finally {
      setSearching(false);
    }
  };

  const handleGrant = async () => {
    if (!selectedUser || !grantTarget || !user) return;
    setGranting(true);
    try {
      await powerService.grant(
        selectedUser.userId,
        grantTarget.$id!,
        user.$id,
        grantScope.departmentId || undefined,
        grantScope.expiresAt || undefined
      );
      toast.success(
        `Power "${grantTarget.displayName}" granted to ${selectedUser.urn || selectedUser.userId}!`
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
      const holdersData = await powerService.getPowerHolders(power.$id!);
      const holdersWithProfiles = await Promise.all(
        holdersData.map(async (h) => {
          const profile = await profileService.getByUserId(h.userId);
          return { ...h, profile };
        })
      );
      setHolders(holdersWithProfiles);
    } catch (error) {
      console.error("Error loading holders:", error);
      toast.error("Failed to load power holders");
    } finally {
      setLoadingHolders(false);
    }
  };

  const handleRevoke = async (userId: string) => {
    if (!holdersTarget) return;
    if (!confirm("Are you sure you want to revoke this power?")) return;
    setRevokingUserId(userId);
    try {
      await powerService.revoke(userId, holdersTarget.$id!);
      toast.success("Power revoked successfully!");
      setHolders((prev) => prev.filter((h) => h.userId !== userId));
    } catch (error) {
      console.error("Error revoking power:", error);
      toast.error("Failed to revoke power");
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
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-transparent">
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
      <div className="space-y-8">
        {Object.keys(groupedPowers).length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-lg text-default-600">No powers defined yet</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedPowers).map(([category, categoryPowers]) => (
            <div key={category}>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-bold capitalize">
                  {CATEGORY_LABELS[category] || category}
                </h2>
                <Chip size="sm" className={CATEGORY_COLORS[category]}>
                  {categoryPowers.length} powers
                </Chip>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryPowers.map((power) => (
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
          ))
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
                        placeholder="Search by URN, branch, or userId..."
                        value={searchQuery}
                        onChange={(e: any) => setSearchQuery(e.target.value)}
                        onKeyPress={(e: any) => {
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
                            No results found. Try a different search.
                          </p>
                        )}
                      {searchResults.map((profile) => (
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
                            <div className="w-8 h-8 rounded-full bg-default-200 flex items-center justify-center text-xs font-bold">
                              {profile.urn?.charAt(0) ||
                                profile.userId.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {profile.urn || profile.userId}
                              </p>
                              <p className="text-xs text-default-400">
                                {[profile.branch, profile.program]
                                  .filter(Boolean)
                                  .join(" | ")}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Selected User */}
                    {selectedUser && (
                      <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
                        <p className="text-sm font-semibold">Selected:</p>
                        <p className="text-sm">
                          {selectedUser.urn || selectedUser.userId}
                        </p>
                      </div>
                    )}

                    {/* Scope Options */}
                    {grantTarget?.scope === "department" && (
                      <div>
                        <label className="block text-sm font-medium mb-1.5">
                          Department Scope (optional)
                        </label>
                        <select
                          value={grantScope.departmentId || ""}
                          onChange={(e) =>
                            setGrantScope({
                              ...grantScope,
                              departmentId: e.target.value || undefined,
                            })
                          }
                          className="w-full px-3 py-2.5 rounded-lg border border-default-300 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        >
                          <option value="">Select department (optional)</option>
                          {departments.map((dept) => (
                            <option key={dept.$id} value={dept.$id}>
                              {dept.name}
                            </option>
                          ))}
                        </select>
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
                      className="w-full sm:w-auto bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold"
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
                              <div className="w-8 h-8 rounded-full bg-default-200 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {holder.profile?.urn?.charAt(0) ||
                                  holder.userId.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {holder.profile?.urn || holder.userId}
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
                                      Dept-scoped
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
