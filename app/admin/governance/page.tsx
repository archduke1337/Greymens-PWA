"use client";

import { useCallback, useEffect, useState } from "react";
import { readApiError } from "@/lib/errorHandler";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, Chip, Input, Label, ListBox, Select, TextArea, TextField } from "@heroui/react";
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [transitionId, setTransitionId] = useState<string | null>(null);
  // New records always start as drafts — approval is an explicit, audited
  // transition via the per-record buttons below, never a create-time flag.
  const [form, setForm] = useState({ recordType: "minute" as RecordType, title: "", body: "", meetingDate: "", visibility: "members" });

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
      const response = await fetch("/api/admin/governance", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ...form, status: "draft" }) });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(readApiError(payload, "Unable to create record"));
      toast.success("Governance record created as draft");
      setForm({ recordType: "minute", title: "", body: "", meetingDate: "", visibility: "members" });
      await loadRecords();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not create governance record"); }
    finally { setSaving(false); }
  };

  const transitionRecord = async (recordId: string, status: "draft" | "approved" | "archived") => {
    const label = status === "approved" ? "Approve this record? It becomes the official version." : status === "archived" ? "Archive this record?" : "Reopen this record as a draft?";
    if (!confirm(label)) return;
    setTransitionId(recordId);
    try {
      const response = await fetch("/api/admin/governance", { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ recordId, status }) });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(readApiError(payload, "Unable to update record"));
      toast.success(status === "approved" ? "Record approved" : status === "archived" ? "Record archived" : "Record reopened as draft");
      await loadRecords();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update record"); }
    finally { setTransitionId(null); }
  };

  if (authLoading || loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" /></div>;
  if (!user || !isRole("admin")) return null;

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-12">
      <div className="flex items-center gap-4"><Button variant="secondary" onPress={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button><div><h1 className="text-3xl font-bold">Governance records</h1><p className="text-[var(--muted)]">Minutes, resolutions, amendments, handovers, and continuity records.</p></div></div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card><CardHeader className="flex-row items-center gap-3"><Plus className="h-5 w-5 text-[var(--accent)]" /><h2 className="text-xl font-bold">Create record</h2></CardHeader><CardContent><form className="space-y-4" onSubmit={createRecord}>
          <div><Select fullWidth value={form.recordType} onChange={(value) => setForm({ ...form, recordType: String(value ?? "") as RecordType })}><Label>Record type</Label><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger><Select.Popover><ListBox>{RECORD_TYPES.map((type) => (<ListBox.Item key={type.value} id={type.value} textValue={type.label}>{type.label}<ListBox.ItemIndicator /></ListBox.Item>))}</ListBox></Select.Popover></Select></div>
          <TextField variant="secondary"><Label>Title</Label><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></TextField>
          <div><Label>Body</Label><TextArea className="mt-1 min-h-40" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} required /></div>
          <TextField variant="secondary"><Label>Meeting / effective date</Label><Input type="date" value={form.meetingDate} onChange={(event) => setForm({ ...form, meetingDate: event.target.value })} /></TextField>
          <div className="grid grid-cols-2 gap-3"><div><Select fullWidth value={form.visibility} onChange={(value) => setForm({ ...form, visibility: String(value ?? form.visibility) })}><Label>Visibility</Label><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger><Select.Popover><ListBox><ListBox.Item id="public" textValue="Public">Public<ListBox.ItemIndicator /></ListBox.Item><ListBox.Item id="members" textValue="Members">Members<ListBox.ItemIndicator /></ListBox.Item><ListBox.Item id="restricted" textValue="Restricted">Restricted<ListBox.ItemIndicator /></ListBox.Item></ListBox></Select.Popover></Select></div><p className="self-center text-xs text-[var(--muted)]">New records start as drafts and are approved explicitly.</p></div>
          <Button type="submit" variant="primary" isPending={saving}>Save record</Button>
        </form></CardContent></Card>
        <div className="space-y-4"><h2 className="flex items-center gap-2 text-xl font-bold"><BookOpen className="h-5 w-5" /> Existing records</h2>{records.length === 0 ? <Card><CardContent className="p-8 text-center text-[var(--muted)]">No governance records yet.</CardContent></Card> : records.map((record) => { const expanded = expandedId === record.$id; return (<Card key={record.$id}><CardContent className="space-y-2 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{record.title}</h3><div className="flex gap-2"><Chip size="sm" variant="soft">{record.recordType}</Chip><Chip size="sm" color={record.status === "approved" ? "success" : record.status === "archived" ? "default" : "warning"}>{record.status}</Chip></div></div><p className={`${expanded ? "" : "line-clamp-3"} whitespace-pre-wrap text-sm text-[var(--muted)]`}>{record.body}</p><p className="text-xs text-[var(--muted)]">{record.meetingDate || record.updatedAt || "No date"} · {record.visibility}</p><div className="flex flex-wrap gap-2 pt-1"><Button size="sm" variant="ghost" onPress={() => setExpandedId(expanded ? null : record.$id)}>{expanded ? "Show less" : "Read full record"}</Button>{record.status === "draft" && <Button size="sm" variant="secondary" isPending={transitionId === record.$id} onPress={() => transitionRecord(record.$id, "approved")}>Approve</Button>}{record.status === "approved" && <Button size="sm" variant="secondary" isPending={transitionId === record.$id} onPress={() => transitionRecord(record.$id, "archived")}>Archive</Button>}{record.status === "archived" && <Button size="sm" variant="ghost" isPending={transitionId === record.$id} onPress={() => transitionRecord(record.$id, "draft")}>Reopen as draft</Button>}</div></CardContent></Card>); })}</div>
      </div>
    </main>
  );
}
