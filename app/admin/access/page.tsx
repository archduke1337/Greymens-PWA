"use client";

import { useEffect, useState } from "react";
import { Button, Card, Checkbox, Input, Label, ListBox, Select, TextArea, Chip } from "@heroui/react";
import { CAPABILITIES } from "@/lib/capabilities";

type Role = { $id: string; name: string; slug: string; description?: string; capabilities: string[]; isActive: boolean };
type Assignment = { $id: string; userId: string; roleId: string; expiresAt?: string; scopeType?: string; scopeId?: string; isActive: boolean };

export default function AccessCenterPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});
  const [members, setMembers] = useState<Array<{ userId: string; name: string; urn?: string }>>([]);
  const [membersAvailable, setMembersAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<"create_role" | "assign_role" | null>(null);
  const [message, setMessage] = useState("");
  const [role, setRole] = useState({ name: "", slug: "", description: "", capabilities: [] as string[] });
  const [assignment, setAssignment] = useState({ userId: "", roleId: "", expiresAt: "", scopeType: "global", scopeId: "" });
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = async () => {
    const response = await fetch("/api/access", { credentials: "include" });
    if (!response.ok) throw new Error("Unable to load access data");
    const data = await response.json() as { roles?: Role[]; assignments?: Assignment[]; accountNames?: Record<string, string> };
    setRoles(data.roles || []);
    setAssignments(data.assignments || []);
    setAccountNames(data.accountNames || {});
  };

  useEffect(() => { load().catch(() => setMessage("Unable to load access data")).finally(() => setLoading(false)); }, []);

  useEffect(() => {
    // Member directory for the assignee picker. Best-effort: without
    // users.view the admin pastes a user ID instead of being blocked.
    fetch("/api/admin/users?limit=200", { credentials: "include" })
      .then((response) => {
        if (!response.ok) throw new Error("member directory unavailable");
        return response.json() as Promise<{
          users?: Array<{ profile?: { userId?: string; urn?: string }; membership?: { status?: string } | null }>;
          accountNames?: Record<string, string>;
        }>;
      })
      .then((data) => {
        const options = (data.users ?? [])
          .map((entry): { userId: string; name: string; urn?: string } | null => {
            const userId = String(entry.profile?.userId ?? "");
            if (!userId || entry.membership?.status !== "active") return null;
            return { userId, name: data.accountNames?.[userId] || userId, urn: entry.profile?.urn };
          })
          .filter((option): option is { userId: string; name: string; urn?: string } => option !== null)
          .sort((a, b) => a.name.localeCompare(b.name));
        setMembers(options);
        setMembersAvailable(true);
      })
      .catch(() => {
        setMembers([]);
        setMembersAvailable(false);
      });
  }, []);

  const submit = async (action: "create_role" | "assign_role") => {
    setMessage("");
    if (action === "assign_role" && !assignment.userId.trim()) {
      setMessage(membersAvailable ? "Select a member first." : "Enter the member's user ID.");
      return;
    }
    setSubmitting(action);
    try {
      const response = await fetch("/api/access", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "create_role" ? { action, ...role } : { action, ...assignment }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setMessage(data?.error || "Unable to save access"); return; }
      setMessage(action === "create_role" ? "Role template created" : "Role assigned");
      if (action === "create_role") setRole({ name: "", slug: "", description: "", capabilities: [] });
      else setAssignment({ userId: "", roleId: "", expiresAt: "", scopeType: "global", scopeId: "" });
      await load();
    } finally {
      setSubmitting(null);
    }
  };

  const toggleCapability = (capability: string) => setRole((current) => ({
    ...current,
    capabilities: current.capabilities.includes(capability)
      ? current.capabilities.filter((item) => item !== capability)
      : [...current.capabilities, capability],
  }));

  const revoke = async (assignmentId: string, assignee: string) => {
    if (!confirm(`Revoke this role from ${assignee}? They lose these capabilities immediately.`)) return;
    setRevokingId(assignmentId);
    setMessage("");
    try {
      const response = await fetch("/api/access", {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, isActive: false }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setMessage(data?.error || "Unable to revoke access"); return; }
      setMessage("Access revoked");
      await load();
    } catch {
      setMessage("Unable to revoke access");
    } finally {
      setRevokingId(null);
    }
  };

  if (loading) return <div className="p-8">Loading Access Center...</div>;
  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <header><h1 className="text-3xl font-bold">Access Center</h1><p className="text-default-600">Create role templates and assign capability bundles with scope and expiry.</p></header>
      {message && <div role="status" className="rounded-lg border border-primary/30 bg-primary/10 p-3">{message}</div>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6 space-y-4">
          <h2 className="text-xl font-semibold">Create role template</h2>
          <label className="block text-sm font-medium">Display name<Input value={role.name} onChange={(event) => setRole({ ...role, name: event.target.value })} /></label>
          <label className="block text-sm font-medium">Slug<Input placeholder="editorial-lead" value={role.slug} onChange={(event) => setRole({ ...role, slug: event.target.value })} /></label>
          <label className="block text-sm font-medium">Description<TextArea value={role.description} onChange={(event) => setRole({ ...role, description: event.target.value })} /></label>
          <fieldset className="space-y-2"><legend className="font-medium">Capabilities</legend><div className="grid gap-2 sm:grid-cols-2">
            {CAPABILITIES.map((capability) => (
              <Checkbox
                key={capability}
                isSelected={role.capabilities.includes(capability)}
                onChange={() => toggleCapability(capability)}
              >
                <Checkbox.Content>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <span className="text-sm">{capability}</span>
                </Checkbox.Content>
              </Checkbox>
            ))}
          </div></fieldset>
          <Button onPress={() => submit("create_role")} isPending={submitting === "create_role"} isDisabled={!role.name || !role.slug || role.capabilities.length === 0}>Create role</Button>
        </Card>
        <Card className="p-6 space-y-4">
          <h2 className="text-xl font-semibold">Assign role to member</h2>
          {membersAvailable ? (
            <Select
              fullWidth
              value={assignment.userId === "" ? null : assignment.userId}
              onChange={(value) => setAssignment({ ...assignment, userId: String(value ?? "") })}
            >
              <Label>Member</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {members.map((member) => (
                    <ListBox.Item key={member.userId} id={member.userId} textValue={member.name}>
                      {member.name}{member.urn ? ` · ${member.urn}` : ""}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          ) : (
            <label className="block text-sm font-medium">Member user ID<Input placeholder="Directory unavailable — paste user ID" value={assignment.userId} onChange={(event) => setAssignment({ ...assignment, userId: event.target.value })} /></label>
          )}
          <Select
            fullWidth
            placeholder="Select a role"
            value={assignment.roleId === "" ? null : assignment.roleId}
            onChange={(value) => setAssignment({ ...assignment, roleId: String(value ?? "") })}
          >
            <Label>Role</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {roles.filter((item) => item.isActive).map((item) => (
                  <ListBox.Item key={item.$id} id={item.$id} textValue={item.name}>
                    {item.name}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          <Select
            fullWidth
            value={assignment.scopeType}
            onChange={(value) => setAssignment({ ...assignment, scopeType: String(value ?? "global") })}
          >
            <Label>Scope</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {["global", "department", "team", "project"].map((item) => (
                  <ListBox.Item key={item} id={item} textValue={item}>
                    {item}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          <label className="block text-sm font-medium">Scope ID (optional)<Input value={assignment.scopeId} onChange={(event) => setAssignment({ ...assignment, scopeId: event.target.value })} /></label>
          <label className="block text-sm font-medium">Expires (optional)<Input type="datetime-local" value={assignment.expiresAt} onChange={(event) => setAssignment({ ...assignment, expiresAt: event.target.value ? new Date(event.target.value).toISOString() : "" })} /></label>
          <Button onPress={() => submit("assign_role")} isPending={submitting === "assign_role"} isDisabled={!assignment.userId || !assignment.roleId}>Assign role</Button>
        </Card>
      </div>
      <section className="space-y-4"><h2 className="text-xl font-semibold">Role templates</h2>{roles.map((item) => <Card key={item.$id} className="flex flex-wrap items-center justify-between gap-4 p-4"><div><h3 className="font-semibold">{item.name}</h3><p className="text-sm text-default-600">{item.description || item.slug}</p></div><div className="flex flex-wrap gap-2">{item.capabilities.map((capability) => <Chip key={capability} size="sm">{capability}</Chip>)}</div></Card>)}</section>
      <section className="space-y-4"><h2 className="text-xl font-semibold">Recent assignments</h2>{assignments.map((item) => { const assignee = accountNames[item.userId] || item.userId; return (<Card key={item.$id} className="flex flex-wrap items-center justify-between gap-4 p-4"><span>{assignee} → {roles.find((roleItem) => roleItem.$id === item.roleId)?.name || item.roleId}</span><span className="flex flex-wrap items-center gap-2 text-sm text-default-600">{item.scopeType}{item.scopeId ? `:${item.scopeId}` : ""}{item.expiresAt ? <Chip size="sm" variant="soft">expires {new Date(item.expiresAt).toLocaleDateString()}</Chip> : null}{!item.isActive ? <Chip size="sm">revoked</Chip> : null}</span>{item.isActive && <Button size="sm" variant="secondary" onPress={() => revoke(item.$id, assignee)} isPending={revokingId === item.$id} isDisabled={revokingId === item.$id}>Revoke</Button>}</Card>); })}</section>
    </main>
  );
}
