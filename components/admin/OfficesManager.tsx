"use client";

import { useState } from "react";
import { Button, Card, CardContent, CardHeader, Chip, Input, Label, ListBox, Select, TextArea, TextField } from "@heroui/react";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import { GOVERNANCE_OFFICES } from "@/lib/governance";

export interface OfficeAssignment {
  $id: string;
  officeId: string;
  userId: string;
  selectionMethod: string;
  termStart: string;
  termEnd?: string;
  status: string;
  notes?: string;
}

export interface MemberOption {
  userId: string;
  name: string;
  urn?: string;
}

interface OfficesManagerProps {
  assignments: OfficeAssignment[];
  members: MemberOption[];
  membersAvailable: boolean;
  accountNames: Record<string, string>;
  onChanged: () => Promise<void> | void;
}

export default function OfficesManager({ assignments, members, membersAvailable, accountNames, onChanged }: OfficesManagerProps) {
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [form, setForm] = useState({ officeId: GOVERNANCE_OFFICES[0].id, userId: "", selectionMethod: "appointment", termStart: "", termEnd: "", notes: "" });
  const officeTitle = (id: string) => GOVERNANCE_OFFICES.find((office) => office.id === id)?.title || id;

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
      await onChanged();
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
      await onChanged();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update office"); }
    finally { setUpdatingId(null); }
  };

  const memberName = (userId: string) =>
    accountNames[userId] || members.find((member) => member.userId === userId)?.name;

  return (
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
      <div className="space-y-4"><h2 className="text-xl font-bold">Assignments</h2>{assignments.length === 0 ? <Card><CardContent className="p-8 text-center text-[var(--muted)]">No office assignments recorded.</CardContent></Card> : assignments.map((assignment) => { const name = memberName(assignment.userId); return (<Card key={assignment.$id}><CardContent className="space-y-3 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{officeTitle(assignment.officeId)}</h3><Chip color={assignment.status === "active" ? "success" : "default"}>{assignment.status}</Chip></div>{name && <p className="text-sm font-medium">{name}</p>}<p className="font-mono text-xs text-[var(--muted)]">{assignment.userId}</p><p className="text-sm text-[var(--muted)]">{assignment.selectionMethod} · {assignment.termStart}{assignment.termEnd ? ` → ${assignment.termEnd}` : ""}</p>{assignment.status === "active" && <Button size="sm" variant="secondary" isPending={updatingId === assignment.$id} onPress={() => updateStatus(assignment.$id, "ended")}>End assignment</Button>}</CardContent></Card>); })}</div>
    </div>
  );
}
