"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, Chip, Input, Label, TextArea, TextField } from "@heroui/react";
import { ArrowLeft, Loader2, Settings } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { GOVERNANCE_OFFICES } from "@/lib/governance";

interface Assignment { $id: string; officeId: string; userId: string; selectionMethod: string; termStart: string; termEnd?: string; status: string; notes?: string; }

export default function OfficesAdminPage() {
  const { user, loading: authLoading } = useAuth();
  const { isRole } = usePermissions();
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
    if (!authLoading && user && !isRole("admin")) router.push("/unauthorized");
    if (!authLoading && user && isRole("admin")) loadAssignments();
  }, [authLoading, user, isRole, router, loadAssignments]);

  const assignOffice = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/admin/offices", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(form) });
      if (!response.ok) throw new Error("Unable to assign office");
      toast.success("Office assigned");
      setForm({ ...form, userId: "", termStart: "", termEnd: "", notes: "" });
      await loadAssignments();
    } catch { toast.error("Could not assign office"); }
    finally { setSaving(false); }
  };

  const updateStatus = async (assignmentId: string, status: string) => {
    const response = await fetch("/api/admin/offices", { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ assignmentId, status }) });
    if (!response.ok) { toast.error("Could not update office"); return; }
    await loadAssignments();
  };

  if (authLoading || loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" /></div>;
  if (!user || !isRole("admin")) return null;

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-12">
      <div className="flex items-center gap-4"><Button variant="secondary" onPress={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button><div><h1 className="text-3xl font-bold">Constitutional offices</h1><p className="text-[var(--muted)]">Assign offices separately from membership status, with explicit terms and succession records.</p></div></div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card><CardHeader className="flex-row items-center gap-3"><Settings className="h-5 w-5 text-[var(--accent)]" /><h2 className="text-xl font-bold">Assign office</h2></CardHeader><CardContent><form className="space-y-4" onSubmit={assignOffice}>
          <div><Label>Office</Label><select className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2" value={form.officeId} onChange={(event) => setForm({ ...form, officeId: event.target.value as typeof form.officeId })}>{GOVERNANCE_OFFICES.map((office) => <option key={office.id} value={office.id}>{office.title}</option>)}</select></div>
          <TextField variant="secondary"><Label>Appwrite user ID</Label><Input value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value })} required /></TextField>
          <div><Label>Selection method</Label><select className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2" value={form.selectionMethod} onChange={(event) => setForm({ ...form, selectionMethod: event.target.value })}><option value="election">Election</option><option value="appointment">Appointment</option><option value="interim">Interim succession</option></select></div>
          <div className="grid grid-cols-2 gap-3"><TextField variant="secondary"><Label>Term starts</Label><Input type="date" value={form.termStart} onChange={(event) => setForm({ ...form, termStart: event.target.value })} required /></TextField><TextField variant="secondary"><Label>Term ends</Label><Input type="date" value={form.termEnd} onChange={(event) => setForm({ ...form, termEnd: event.target.value })} /></TextField></div>
          <div><Label>Notes</Label><TextArea className="mt-1 min-h-20" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
          <Button type="submit" variant="primary" isPending={saving}>Assign office</Button>
        </form></CardContent></Card>
        <div className="space-y-4"><h2 className="text-xl font-bold">Assignments</h2>{assignments.length === 0 ? <Card><CardContent className="p-8 text-center text-[var(--muted)]">No office assignments recorded.</CardContent></Card> : assignments.map((assignment) => <Card key={assignment.$id}><CardContent className="space-y-3 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{officeTitle(assignment.officeId)}</h3><Chip color={assignment.status === "active" ? "success" : "default"}>{assignment.status}</Chip></div><p className="font-mono text-xs text-[var(--muted)]">{assignment.userId}</p><p className="text-sm text-[var(--muted)]">{assignment.selectionMethod} · {assignment.termStart}{assignment.termEnd ? ` → ${assignment.termEnd}` : ""}</p>{assignment.status === "active" && <Button size="sm" variant="secondary" onPress={() => updateStatus(assignment.$id, "ended")}>End assignment</Button>}</CardContent></Card>)}</div>
      </div>
    </main>
  );
}
