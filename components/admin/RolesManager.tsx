// components/admin/RolesManager.tsx
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import { toast } from "sonner";
import {
  CheckIcon,
  PlusIcon,
  SearchIcon,
  ShieldIcon,
  TrashIcon,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Input,
  Label,
  ListBox,
  Select,
  TextArea,
} from "@heroui/react";

import MemberAvatar from "@/components/MemberAvatar";
import { getErrorMessage, readApiError } from "@/lib/errorHandler";
import { CAPABILITIES } from "@/lib/capabilities";

type Role = {
  $id: string;
  name: string;
  slug: string;
  description?: string;
  capabilities: string[];
  /**
   * Set when this template *is* a charter office. Offices and roles are the
   * same grant in the same table; the office is the template plus a term, and
   * it is assigned from the Offices tab.
   */
  officeId?: string;
  isActive: boolean;
};

type Assignment = {
  $id: string;
  userId: string;
  roleId: string;
  expiresAt?: string;
  scopeType?: string;
  scopeId?: string;
  isActive: boolean;
};

/** Directory entry for the assignee picker: names are the search key. */
type MemberOption = {
  userId: string;
  name: string;
  urn?: string;
  avatar?: string;
  status?: string;
};

const SCOPES = ["global", "department", "team", "project"] as const;

/** Suggested slug from a display name; the admin can still edit it. */
function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * A grant counts as live only while it is active AND unexpired — the
 * server-side authorizer enforces expiry on every check, so an expired row
 * that is still `isActive` must not be presented as a current grant.
 */
function isLive(assignment: Assignment) {
  if (assignment.isActive === false) return false;

  return (
    !assignment.expiresAt ||
    new Date(assignment.expiresAt).getTime() > Date.now()
  );
}

function formatDate(value?: string) {
  if (!value) return "";
  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleDateString();
}

/**
 * Role templates and their assignments, embedded in the Access console's
 * Roles tab. Self-loading so the console page only owns its chrome and the
 * People overview. Member selection is name-first: the directory is fetched
 * once, then the picker filters on name/URN instead of demanding a raw ID.
 */
export default function RolesManager() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [membersAvailable, setMembersAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<
    "create_role" | "assign_role" | null
  >(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const [role, setRole] = useState({
    name: "",
    slug: "",
    description: "",
    capabilities: [] as string[],
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [capabilityQuery, setCapabilityQuery] = useState("");

  const [assignment, setAssignment] = useState({
    userId: "",
    roleId: "",
    expiresAt: "",
    scopeType: "global",
    scopeId: "",
  });
  const [memberQuery, setMemberQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [templateQuery, setTemplateQuery] = useState("");
  const [assignmentQuery, setAssignmentQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/access", {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as {
        roles?: Role[];
        assignments?: Assignment[];
        accountNames?: Record<string, string>;
        error?: string;
      } | null;

      if (!response.ok)
        throw new Error(readApiError(data, "Unable to load roles"));
      setRoles(data?.roles ?? []);
      setAssignments(data?.assignments ?? []);
      setAccountNames(data?.accountNames ?? {});
    } catch (error) {
      toast.error(getErrorMessage(error) || "Unable to load access data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    // Member directory for the picker. Best-effort: without users.view the
    // admin pastes a user ID instead of the picker silently going empty.
    fetch("/api/admin/users?limit=500", {
      credentials: "include",
      cache: "no-store",
    })
      .then((response) => {
        if (!response.ok) throw new Error("directory unavailable");

        return response.json() as Promise<{
          users?: Array<{
            profile?: { userId?: string; urn?: string; avatar?: string };
            membership?: { status?: string } | null;
          }>;
          accountNames?: Record<string, string>;
        }>;
      })
      .then((data) => {
        const options = (data.users ?? [])
          .map((entry): MemberOption | null => {
            const userId = String(entry.profile?.userId ?? "");

            if (!userId) return null;

            return {
              userId,
              name: data.accountNames?.[userId] || entry.profile?.urn || userId,
              urn: entry.profile?.urn,
              avatar: entry.profile?.avatar,
              status: entry.membership?.status,
            };
          })
          .filter((option): option is MemberOption => option !== null)
          .sort((a, b) => a.name.localeCompare(b.name));

        setMembers(options);
        setMembersAvailable(true);
      })
      .catch(() => {
        setMembers([]);
        setMembersAvailable(false);
      });
  }, []);

  const memberName = useCallback(
    (userId: string) =>
      accountNames[userId] ||
      members.find((member) => member.userId === userId)?.name ||
      userId,
    [accountNames, members],
  );

  const avatarFor = useCallback(
    (userId: string) =>
      members.find((member) => member.userId === userId)?.avatar,
    [members],
  );

  const submit = async (action: "create_role" | "assign_role") => {
    if (action === "assign_role" && !assignment.userId.trim()) {
      toast.error(
        membersAvailable
          ? "Select a member first"
          : "Enter the member's user ID",
      );

      return;
    }
    // A non-global scope without a scope ID is accepted by the server and
    // applies far too broadly — require the ID up front.
    if (
      action === "assign_role" &&
      assignment.scopeType !== "global" &&
      !assignment.scopeId.trim()
    ) {
      toast.error(
        `A ${assignment.scopeType} scope needs its ID — otherwise the grant applies everywhere`,
      );

      return;
    }
    setSubmitting(action);
    try {
      const response = await fetch("/api/access", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "create_role"
            ? { action, ...role }
            : { action, ...assignment },
        ),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok)
        throw new Error(readApiError(data, "Unable to save access"));
      toast.success(
        action === "create_role" ? "Role template created" : "Role assigned",
      );
      if (action === "create_role") {
        setRole({ name: "", slug: "", description: "", capabilities: [] });
        setSlugTouched(false);
      } else {
        setAssignment({
          userId: "",
          roleId: "",
          expiresAt: "",
          scopeType: "global",
          scopeId: "",
        });
        setMemberQuery("");
      }
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error) || "Unable to save access");
    } finally {
      setSubmitting(null);
    }
  };

  const toggleCapability = (capability: string) =>
    setRole((current) => ({
      ...current,
      capabilities: current.capabilities.includes(capability)
        ? current.capabilities.filter((item) => item !== capability)
        : [...current.capabilities, capability],
    }));

  const revoke = async (assignmentId: string, assignee: string) => {
    if (
      !confirm(
        `Revoke this role from ${assignee}? They lose these capabilities immediately.`,
      )
    )
      return;
    setRevokingId(assignmentId);
    try {
      const response = await fetch("/api/access", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, isActive: false }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok)
        throw new Error(readApiError(data, "Unable to revoke access"));
      toast.success("Access revoked");
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error) || "Unable to revoke access");
    } finally {
      setRevokingId(null);
    }
  };

  const visibleCapabilities = useMemo(() => {
    const q = capabilityQuery.trim().toLowerCase();

    return q
      ? CAPABILITIES.filter((capability) =>
          capability.toLowerCase().includes(q),
        )
      : CAPABILITIES;
  }, [capabilityQuery]);

  const visibleMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();

    if (!q) return members;

    return members.filter((member) =>
      [member.name, member.urn, member.userId].some((value) =>
        (value ?? "").toLowerCase().includes(q),
      ),
    );
  }, [members, memberQuery]);

  const visibleRoles = useMemo(() => {
    const q = roleFilter.trim().toLowerCase();
    // Office templates are excluded: an office carries a term and a
    // single-holder rule that a plain role assignment cannot express, so
    // assigning one here would be a second, termless route to the same
    // authority. Offices are assigned from the Offices tab.
    const active = roles.filter((item) => item.isActive && !item.officeId);

    if (!q) return active;

    return active.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.slug.toLowerCase().includes(q),
    );
  }, [roles, roleFilter]);

  const liveCountFor = useCallback(
    (roleId: string) =>
      assignments.filter((item) => item.roleId === roleId && isLive(item))
        .length,
    [assignments],
  );

  const visibleTemplates = useMemo(() => {
    const q = templateQuery.trim().toLowerCase();
    const sorted = [...roles].sort((a, b) => a.name.localeCompare(b.name));

    if (!q) return sorted;

    return sorted.filter((item) =>
      [item.name, item.slug, item.description ?? "", ...item.capabilities].some(
        (value) => value.toLowerCase().includes(q),
      ),
    );
  }, [roles, templateQuery]);

  const assignmentRows = useMemo(() => {
    const q = assignmentQuery.trim().toLowerCase();

    return assignments
      .map((item) => ({
        item,
        live: isLive(item),
        assignee: memberName(item.userId),
        roleName:
          roles.find((template) => template.$id === item.roleId)?.name ||
          item.roleId,
      }))
      .filter((row) =>
        !q
          ? true
          : [
              row.assignee,
              row.roleName,
              row.item.userId,
              row.item.scopeType,
              row.item.scopeId,
            ].some((value) =>
              String(value ?? "")
                .toLowerCase()
                .includes(q),
            ),
      )
      .sort(
        (a, b) =>
          Number(b.live) - Number(a.live) ||
          a.assignee.localeCompare(b.assignee),
      );
  }, [assignments, roles, assignmentQuery, memberName]);

  const liveAssignments = assignments.filter(isLive).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4">Loading roles...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <p className="text-sm text-default-500 -mt-2">
        Role templates bundle capabilities; every assignment carries a scope and
        optional expiry. A role manager can only grant capabilities they hold
        themselves. Charter offices are the same kind of grant — their templates
        are listed here, marked <span className="font-medium">office</span>, but
        assigned from the Offices tab, which also records the term.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Create role template */}
        <Card className="border-none shadow-md">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <PlusIcon aria-hidden className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Create role template</h2>
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                htmlFor="role-name"
              >
                Display name
              </label>
              <Input
                id="role-name"
                placeholder="Editorial Lead"
                value={role.name}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const name = event.target.value;

                  setRole((current) => ({
                    ...current,
                    name,
                    // Slug follows the name until the admin edits it directly.
                    slug: slugTouched ? current.slug : slugify(name),
                  }));
                }}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  htmlFor="role-slug"
                >
                  Slug
                </label>
                <Input
                  id="role-slug"
                  placeholder="editorial-lead"
                  value={role.slug}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    setSlugTouched(true);
                    setRole({ ...role, slug: event.target.value });
                  }}
                />
              </div>
              <div>
                <span className="block text-sm font-medium mb-1.5">
                  Selected
                </span>
                <div className="flex h-10 items-center">
                  <Chip size="sm" variant="soft">
                    {role.capabilities.length} capabilit
                    {role.capabilities.length === 1 ? "y" : "ies"}
                  </Chip>
                </div>
              </div>
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                htmlFor="role-description"
              >
                Description
              </label>
              <TextArea
                className="min-h-20"
                id="role-description"
                placeholder="What this role is for, in one line."
                value={role.description}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                  setRole({ ...role, description: event.target.value })
                }
              />
            </div>

            <fieldset className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <legend className="text-sm font-medium">Capabilities</legend>
                <Input
                  aria-label="Filter capabilities"
                  className="max-w-52"
                  placeholder="Filter capabilities..."
                  value={capabilityQuery}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setCapabilityQuery(event.target.value)
                  }
                />
              </div>
              <div className="grid max-h-64 gap-1.5 overflow-y-auto rounded-lg border border-default-200 p-3 sm:grid-cols-2">
                {visibleCapabilities.map((capability) => (
                  <Checkbox
                    key={capability}
                    isSelected={role.capabilities.includes(capability)}
                    onChange={() => toggleCapability(capability)}
                  >
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <span className="text-xs font-mono">{capability}</span>
                    </Checkbox.Content>
                  </Checkbox>
                ))}
                {visibleCapabilities.length === 0 && (
                  <p className="text-xs text-default-400">
                    No capability matches “{capabilityQuery}”.
                  </p>
                )}
              </div>
            </fieldset>

            <Button
              isDisabled={
                !role.name || !role.slug || role.capabilities.length === 0
              }
              isPending={submitting === "create_role"}
              variant="primary"
              onPress={() => submit("create_role")}
            >
              <CheckIcon aria-hidden className="w-4 h-4 mr-1" />
              Create role
            </Button>
          </CardContent>
        </Card>

        {/* Assign role */}
        <Card className="border-none shadow-md">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <ShieldIcon aria-hidden className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Assign role to member</h2>
            </div>

            {membersAvailable ? (
              <div className="space-y-2">
                <Input
                  aria-label="Search members by name or URN"
                  placeholder="Search members by name or URN..."
                  value={memberQuery}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setMemberQuery(event.target.value)
                  }
                />
                <div className="max-h-52 space-y-1.5 overflow-y-auto rounded-lg border border-default-200 p-2">
                  {visibleMembers.map((member) => {
                    const selected = assignment.userId === member.userId;

                    return (
                      <button
                        key={member.userId}
                        aria-pressed={selected}
                        className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors ${
                          selected
                            ? "border-primary bg-primary/10"
                            : "border-transparent hover:bg-default-100"
                        }`}
                        type="button"
                        onClick={() =>
                          setAssignment((current) => ({
                            ...current,
                            userId: member.userId,
                          }))
                        }
                      >
                        <MemberAvatar
                          className="w-8 h-8 text-xs font-bold flex-shrink-0"
                          name={member.name}
                          src={member.avatar}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {member.name}
                          </span>
                          <span className="block truncate text-xs text-default-400">
                            {[
                              member.urn,
                              member.status && member.status !== "active"
                                ? member.status
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || member.userId}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                  {visibleMembers.length === 0 && (
                    <p className="p-2 text-xs text-default-400">
                      No member matches that search.
                    </p>
                  )}
                </div>
                {assignment.userId && (
                  <p className="text-sm text-default-500">
                    Selected:{" "}
                    <span className="font-semibold text-foreground">
                      {memberName(assignment.userId)}
                    </span>
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  htmlFor="assignee-id"
                >
                  Member user ID
                </label>
                <Input
                  id="assignee-id"
                  placeholder="Directory unavailable — paste user ID"
                  value={assignment.userId}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setAssignment({ ...assignment, userId: event.target.value })
                  }
                />
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  htmlFor="role-filter"
                >
                  Role
                </label>
                <Input
                  className="mb-2"
                  id="role-filter"
                  placeholder="Filter roles..."
                  value={roleFilter}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setRoleFilter(event.target.value)
                  }
                />
                <Select
                  fullWidth
                  placeholder="Select a role"
                  value={assignment.roleId === "" ? null : assignment.roleId}
                  onChange={(value) =>
                    setAssignment({
                      ...assignment,
                      roleId: String(value ?? ""),
                    })
                  }
                >
                  <Label>Role</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {visibleRoles.map((item) => (
                        <ListBox.Item
                          key={item.$id}
                          id={item.$id}
                          textValue={item.name}
                        >
                          {item.name}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Scope
                  </label>
                  <Select
                    fullWidth
                    value={assignment.scopeType}
                    onChange={(value) =>
                      setAssignment({
                        ...assignment,
                        scopeType: String(value ?? "global"),
                      })
                    }
                  >
                    <Label>Scope</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {SCOPES.map((scope) => (
                          <ListBox.Item
                            key={scope}
                            id={scope}
                            textValue={scope}
                          >
                            {scope}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
                <div>
                  <label
                    className="block text-sm font-medium mb-1.5"
                    htmlFor="scope-id"
                  >
                    Scope ID{" "}
                    {assignment.scopeType !== "global" ? (
                      <span aria-hidden="true" className="text-danger">
                        *
                      </span>
                    ) : (
                      <span className="font-normal text-default-400">
                        (optional for global)
                      </span>
                    )}
                  </label>
                  <Input
                    id="scope-id"
                    placeholder="department / team / project ID"
                    value={assignment.scopeId}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setAssignment({
                        ...assignment,
                        scopeId: event.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                htmlFor="expires-at"
              >
                Expires (optional)
              </label>
              <Input
                id="expires-at"
                type="datetime-local"
                value={assignment.expiresAt}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setAssignment({
                    ...assignment,
                    expiresAt: event.target.value
                      ? new Date(event.target.value).toISOString()
                      : "",
                  })
                }
              />
            </div>

            <Button
              isDisabled={!assignment.userId || !assignment.roleId}
              isPending={submitting === "assign_role"}
              variant="primary"
              onPress={() => submit("assign_role")}
            >
              <CheckIcon aria-hidden className="w-4 h-4 mr-1" />
              Assign role
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Role templates */}
        <section aria-label="Role templates" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Role templates</h2>
            <Chip size="sm" variant="soft">
              {roles.length}
            </Chip>
          </div>
          <Input
            aria-label="Filter role templates"
            placeholder="Filter by name, slug, or capability..."
            value={templateQuery}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setTemplateQuery(event.target.value)
            }
          />
          {visibleTemplates.length === 0 ? (
            <Card className="border-none shadow-sm">
              <CardContent className="p-8 text-center text-sm text-default-500">
                {templateQuery.trim()
                  ? "No template matches that search."
                  : "No role templates yet."}
              </CardContent>
            </Card>
          ) : (
            visibleTemplates.map((item) => (
              <Card key={item.$id} className="border-none shadow-sm">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold">{item.name}</h3>
                      <p className="text-xs font-mono text-default-400">
                        {item.slug}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      {item.officeId && (
                        <Chip
                          size="sm"
                          title="Charter office — assign from the Offices tab"
                          variant="soft"
                        >
                          office
                        </Chip>
                      )}
                      <Chip size="sm" variant="soft">
                        {liveCountFor(item.$id)} active
                      </Chip>
                      {!item.isActive && (
                        <Chip
                          className="bg-muted text-muted-foreground"
                          size="sm"
                        >
                          inactive
                        </Chip>
                      )}
                    </div>
                  </div>
                  {item.description && (
                    <p className="text-sm text-default-500">
                      {item.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {item.capabilities.map((capability) => (
                      <Chip
                        key={capability}
                        className="text-xs font-mono"
                        size="sm"
                      >
                        {capability}
                      </Chip>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </section>

        {/* Assignments */}
        <section aria-label="Role assignments" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Assignments</h2>
            <Chip size="sm" variant="soft">
              {liveAssignments} active
            </Chip>
          </div>
          <Input
            aria-label="Filter role assignments"
            placeholder="Filter by member, role, or scope..."
            value={assignmentQuery}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setAssignmentQuery(event.target.value)
            }
          />
          {assignmentRows.length === 0 ? (
            <Card className="border-none shadow-sm">
              <CardContent className="p-8 text-center text-sm text-default-500">
                {assignmentQuery.trim()
                  ? "No assignment matches that search."
                  : "Nobody holds a role yet. Assign one from the panel above."}
              </CardContent>
            </Card>
          ) : (
            assignmentRows.map(({ item, live, assignee, roleName }) => (
              <Card key={item.$id} className="border-none shadow-sm">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <MemberAvatar
                      className="w-9 h-9 text-sm font-bold flex-shrink-0"
                      name={assignee}
                      src={avatarFor(item.userId)}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {assignee}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-default-500">
                        <span className="font-medium">{roleName}</span>
                        <Chip size="sm" variant="soft">
                          {item.scopeType || "global"}
                          {item.scopeId ? `:${item.scopeId}` : ""}
                        </Chip>
                        {item.expiresAt && (
                          <Chip size="sm" variant="soft">
                            {live
                              ? `expires ${formatDate(item.expiresAt)}`
                              : `expired ${formatDate(item.expiresAt)}`}
                          </Chip>
                        )}
                        {item.isActive === false && (
                          <Chip size="sm">revoked</Chip>
                        )}
                      </div>
                    </div>
                  </div>
                  {item.isActive && (
                    <Button
                      isDisabled={revokingId === item.$id}
                      isPending={revokingId === item.$id}
                      size="sm"
                      variant="secondary"
                      onPress={() => revoke(item.$id, assignee)}
                    >
                      <TrashIcon aria-hidden className="w-4 h-4 mr-1" />
                      Revoke
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
          <p className="flex items-center gap-1 text-xs text-default-400">
            <SearchIcon aria-hidden className="h-3 w-3" />
            Expired and revoked grants stay listed so the trail is visible.
          </p>
        </section>
      </div>
    </>
  );
}
