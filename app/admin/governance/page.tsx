"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, Chip, Input, Label, TextArea, TextField } from "@heroui/react";
import { ArrowLeft, BookOpen, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";

type RecordType = "minute" | "resolution" | "amendment" | "handover" | "annual_review" | "asset";
interface GovernanceRecord { $id: string; recordType: RecordType; title: string; body: string; meetingDate?: string; visibility: string; status: string; updatedAt?: string; }

const RECORD_TYPES: Array<{ value: RecordType; label: string }> = [
  { value: "minute", label: "Meeting minutes" },
  { value: "resolution", label: "Resolution" },
  { value: "amendment", label: "Charter amendment" },
  { value: "handover", label: "Officer handover" },
  { value: "annual_review", label: "Annual governance review" },
  { value: "asset", label: "Asset / continuity record" },
];

export default function GovernanceAdminPage() {
  const { user, loading: authLoading } = useAuth();
  const { isRole } = usePermissions();
  const router = useRouter();
  const [records, setRecords] = useState<GovernanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ recordType: "minute" as RecordType, title: "", body: "", meetingDate: "", visibility: "members", status: "draft" });

  const loadRecords = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/governance", { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load governance records");
      const data = await response.json() as { records?: GovernanceRecord[] };
      setRecords(data.records || []);
    } catch { toast.error("Could not load governance records"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
    if (!authLoading && user && !isRole("admin")) router.push("/unauthorized");
    if (!authLoading && user && isRole("admin")) loadRecords();
  }, [authLoading, user, isRole, router, loadRecords]);

  const createRecord = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/admin/governance", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(form) });
      if (!response.ok) throw new Error("Unable to create record");
      toast.success("Governance record created");
      setForm({ recordType: "minute", title: "", body: "", meetingDate: "", visibility: "members", status: "draft" });
      await loadRecords();
    } catch { toast.error("Could not create governance record"); }
    finally { setSaving(false); }
  };

  if (authLoading || loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" /></div>;
  if (!user || !isRole("admin")) return null;

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-12">
      <div className="flex items-center gap-4"><Button variant="secondary" onPress={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button><div><h1 className="text-3xl font-bold">Governance records</h1><p className="text-[var(--muted)]">Minutes, resolutions, amendments, handovers, and continuity records.</p></div></div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card><CardHeader className="flex-row items-center gap-3"><Plus className="h-5 w-5 text-[var(--accent)]" /><h2 className="text-xl font-bold">Create record</h2></CardHeader><CardContent><form className="space-y-4" onSubmit={createRecord}>
          <div><Label>Record type</Label><select className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2" value={form.recordType} onChange={(event) => setForm({ ...form, recordType: event.target.value as RecordType })}>{RECORD_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></div>
          <TextField variant="secondary"><Label>Title</Label><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></TextField>
          <div><Label>Body</Label><TextArea className="mt-1 min-h-40" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} required /></div>
          <TextField variant="secondary"><Label>Meeting / effective date</Label><Input type="date" value={form.meetingDate} onChange={(event) => setForm({ ...form, meetingDate: event.target.value })} /></TextField>
          <div className="grid grid-cols-2 gap-3"><div><Label>Visibility</Label><select className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2" value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value })}><option value="public">Public</option><option value="members">Members</option><option value="restricted">Restricted</option></select></div><div><Label>Status</Label><select className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="draft">Draft</option><option value="approved">Approved</option><option value="archived">Archived</option></select></div></div>
          <Button type="submit" variant="primary" isPending={saving}>Save record</Button>
        </form></CardContent></Card>
        <div className="space-y-4"><h2 className="flex items-center gap-2 text-xl font-bold"><BookOpen className="h-5 w-5" /> Existing records</h2>{records.length === 0 ? <Card><CardContent className="p-8 text-center text-[var(--muted)]">No governance records yet.</CardContent></Card> : records.map((record) => <Card key={record.$id}><CardContent className="space-y-2 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{record.title}</h3><div className="flex gap-2"><Chip size="sm" variant="soft">{record.recordType}</Chip><Chip size="sm" color={record.status === "approved" ? "success" : "warning"}>{record.status}</Chip></div></div><p className="line-clamp-3 whitespace-pre-wrap text-sm text-[var(--muted)]">{record.body}</p><p className="text-xs text-[var(--muted)]">{record.meetingDate || record.updatedAt || "No date"} · {record.visibility}</p></CardContent></Card>)}</div>
      </div>
    </main>
  );
}
