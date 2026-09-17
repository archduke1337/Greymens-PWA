"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, Chip, Input, Label, ListBox, Select, TextArea, TextField } from "@heroui/react";
import { ArrowLeft, Loader2, Settings } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { GOVERNANCE_OFFICES } from "@/lib/governance";

interface Assignment { $id: string; officeId: string; userId: string; selectionMethod: string; termStart: string; termEnd?: string; status: string; notes?: string; }

interface MemberOption { userId: string; name: string; urn?: string; }

export default function OfficesAdminPage() {
  const { user, loading: authLoading } = useAuth();
  const { isRole } = usePermissions();
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [membersAvailable, setMembersAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [form, setForm] = useState({ officeId: GOVERNANCE_OFFICES[0].id, userId: "", selectionMethod: "appointment", termStart: "", termEnd: "", notes: "" });
  const officeTitle = (id: string) => GOVERNANCE_OFFICES.find((office) => office.id === id)?.title || id;

  const loadAssignments = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/offices", { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load offices");
      const data = await response.json() as { assignments?: Assignment[] };
      setAssignments(data.assignments || []);
    } catch { toast.error("Could not load office assignments"); }
    finally { setLoading(false); }
  }, []);

  const loadMembers = useCallback(async () => {
    // Member picker directory. Best-effort: if the caller lacks users.view,
    // fall back to the raw user-ID field rather than blocking assignment.
    try {
      const response = await fetch("/api/admin/users?limit=200", { credentials: "include" });
      if (!response.ok) throw new Error("member directory unavailable");
      const data = await response.json() as {
        users?: Array<{ profile?: { userId?: string; urn?: string }; membership?: { status?: string } | null }>;
        accountNames?: Record<string, string>;
      };
      const options = (data.users ?? [])
        .map((entry): MemberOption | null => {
          const userId = String(entry.profile?.userId ?? "");
          if (!userId || entry.membership?.status !== "active") return null;
          return { userId, name: data.accountNames?.[userId] || userId, urn: entry.profile?.urn };
        })
        .filter((option): option is MemberOption => option !== null)
        .sort((a, b) => a.name.localeCompare(b.name));
      setMembers(options);
      setMembersAvailable(true);
    } catch {
      setMembers([]);
      setMembersAvailable(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
    if (!authLoading && user && !isRole("admin")) router.push("/unauthorized");
    if (!authLoading && user && isRole("admin")) { void loadAssignments(); void loadMembers(); }
  }, [authLoading, user, isRole, router, loadAssignments, loadMembers]);

  const assignOffice = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.userId.trim()) { toast.error(membersAvailable ? "Select a member first" : "Enter the member's user ID"); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/offices", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(form) });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      // 404 (unknown user) and 409 (office already filled) carry the real
      // reason — surface it instead of a generic failure.
      if (!response.ok) throw new Error(payload?.error || "Unable to assign office");
      toast.success("Office assigned");
      setForm({ ...form, userId: "", termStart: "", termEnd: "", notes: "" });
      await loadAssignments();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not assign office"); }
    finally { setSaving(false); }
  };

  const updateStatus = async (assignmentId: string, status: string) => {
    setUpdatingId(assignmentId);
    try {
      const response = await fetch("/api/admin/offices", { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ assignmentId, status }) });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Could not update office");
      toast.success(status === "ended" ? "Assignment ended" : "Assignment updated");
      await loadAssignments();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update office"); }
    finally { setUpdatingId(null); }
  };

  if (authLoading || loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" /></div>;
  if (!user || !isRole("admin")) return null;

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-12">
      <div className="flex items-center gap-4"><Button variant="secondary" onPress={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button><div><h1 className="text-3xl font-bold">Constitutional offices</h1><p className="text-[var(--muted)]">Assign offices separately from membership status, with explicit terms and succession records.</p></div></div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card><CardHeader className="flex-row items-center gap-3"><Settings className="h-5 w-5 text-[var(--accent)]" /><h2 className="text-xl font-bold">Assign office</h2></CardHeader><CardContent><form className="space-y-4" onSubmit={assignOffice}>
          <div><Select fullWidth value={form.officeId} onChange={(value) => setForm({ ...form, officeId: String(value ?? form.officeId) as typeof form.officeId })}><Label>Office</Label><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger><Select.Popover><ListBox>{GOVERNANCE_OFFICES.map((office) => (<ListBox.Item key={office.id} id={office.id} textValue={office.title}>{office.title}<ListBox.ItemIndicator /></ListBox.Item>))}</ListBox></Select.Popover></Select></div>
          {membersAvailable ? (
            <div><Select fullWidth value={form.userId} onChange={(value) => setForm({ ...form, userId: String(value ?? "") })}><Label>Member</Label><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger><Select.Popover><ListBox>{members.map((member) => (<ListBox.Item key={member.userId} id={member.userId} textValue={member.name}>{member.name}{member.urn ? ` · ${member.urn}` : ""}<ListBox.ItemIndicator /></ListBox.Item>))}</ListBox></Select.Popover></Select></div>
          ) : (
            <TextField variant="secondary"><Label>Appwrite user ID</Label><Input value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value })} placeholder="Member directory unavailable — paste user ID" required /></TextField>
          )}
          <div><Select fullWidth value={form.selectionMethod} onChange={(value) => setForm({ ...form, selectionMethod: String(value ?? "appointment") })}><Label>Selection method</Label><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger><Select.Popover><ListBox><ListBox.Item id="election" textValue="Election">Election<ListBox.ItemIndicator /></ListBox.Item><ListBox.Item id="appointment" textValue="Appointment">Appointment<ListBox.ItemIndicator /></ListBox.Item><ListBox.Item id="interim" textValue="Interim succession">Interim succession<ListBox.ItemIndicator /></ListBox.Item></ListBox></Select.Popover></Select></div>
          <div className="grid grid-cols-2 gap-3"><TextField variant="secondary"><Label>Term starts</Label><Input type="date" value={form.termStart} onChange={(event) => setForm({ ...form, termStart: event.target.value })} required /></TextField><TextField variant="secondary"><Label>Term ends</Label><Input type="date" value={form.termEnd} onChange={(event) => setForm({ ...form, termEnd: event.target.value })} /></TextField></div>
          <div><Label>Notes</Label><TextArea className="mt-1 min-h-20" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
          <Button type="submit" variant="primary" isPending={saving}>Assign office</Button>
        </form></CardContent></Card>
        <div className="space-y-4"><h2 className="text-xl font-bold">Assignments</h2>{assignments.length === 0 ? <Card><CardContent className="p-8 text-center text-[var(--muted)]">No office assignments recorded.</CardContent></Card> : assignments.map((assignment) => { const memberName = members.find((member) => member.userId === assignment.userId)?.name; return (<Card key={assignment.$id}><CardContent className="space-y-3 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{officeTitle(assignment.officeId)}</h3><Chip color={assignment.status === "active" ? "success" : "default"}>{assignment.status}</Chip></div>{memberName && <p className="text-sm font-medium">{memberName}</p>}<p className="font-mono text-xs text-[var(--muted)]">{assignment.userId}</p><p className="text-sm text-[var(--muted)]">{assignment.selectionMethod} · {assignment.termStart}{assignment.termEnd ? ` → ${assignment.termEnd}` : ""}</p>{assignment.status === "active" && <Button size="sm" variant="secondary" isPending={updatingId === assignment.$id} onPress={() => updateStatus(assignment.$id, "ended")}>End assignment</Button>}</CardContent></Card>); })}</div>
      </div>
    </main>
  );
}
