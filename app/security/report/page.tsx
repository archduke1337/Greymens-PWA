"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, Input, Label, ListBox, Select, TextArea } from "@heroui/react";
import { AlertTriangle, ArrowLeft, ShieldCheck } from "lucide-react";

export default function SecurityReportPage() {
  const router = useRouter();
  const [activityLoading, setActivityLoading] = useState(false);
  const [incidentLoading, setIncidentLoading] = useState(false);
  const [activity, setActivity] = useState({ title: "", description: "", target: "", scope: "", techniques: "", dataBoundary: "", purpose: "", startsAt: "", endsAt: "" });
  const [incident, setIncident] = useState({ title: "", description: "", affectedResource: "", severity: "moderate" });
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activityReceipt, setActivityReceipt] = useState(false);
  const [incidentError, setIncidentError] = useState<string | null>(null);
  const [incidentReceipt, setIncidentReceipt] = useState(false);

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  const submitActivity = async (event: React.FormEvent) => {
    event.preventDefault();
    setActivityLoading(true);
    setActivityError(null);
    setActivityReceipt(false);
    try {
      const response = await fetch("/api/security/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...activity, techniques: activity.techniques.split(",").map((item) => item.trim()).filter(Boolean) }),
      });
      if (!response.ok) throw new Error("Unable to submit activity request");
      setActivityReceipt(true);
      setActivity({ title: "", description: "", target: "", scope: "", techniques: "", dataBoundary: "", purpose: "", startsAt: "", endsAt: "" });
    } catch {
      setActivityError("Could not submit the activity request. Please try again.");
    }
    finally { setActivityLoading(false); }
  };

  const submitIncident = async (event: React.FormEvent) => {
    event.preventDefault();
    setIncidentLoading(true);
    setIncidentError(null);
    setIncidentReceipt(false);
    try {
      const response = await fetch("/api/security/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(incident),
      });
      if (!response.ok) throw new Error("Unable to submit incident");
      setIncidentReceipt(true);
      setIncident({ title: "", description: "", affectedResource: "", severity: "moderate" });
    } catch {
      setIncidentError("Could not submit the incident report. Please try again.");
    }
    finally { setIncidentLoading(false); }
  };

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-12">
      <Button variant="secondary" onPress={goBack}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
      <header className="grid items-center gap-6 sm:grid-cols-[1fr_180px]">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">Security governance</h1>
          <p className="max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
            Membership is not permission to test a system. Request written
            authorization before technical activity — and if you see something,
            say something here.
          </p>
        </div>
        <img
          src="/Assets/Objects/Story-board.webp"
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="hidden w-full rounded-3xl border border-default-200/70 object-cover sm:block"
        />
      </header>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center gap-3"><ShieldCheck className="h-6 w-6 text-[var(--accent)]" /><h2 className="text-xl font-bold">Request authorized activity</h2></CardHeader>
          <CardContent><form className="space-y-4" onSubmit={submitActivity}>
            {activityError && (
              <div role="alert" className="p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger text-sm">
                {activityError}
              </div>
            )}
            {activityReceipt && (
              <div role="status" className="p-3 rounded-lg bg-success-50 dark:bg-success-900/20 text-success text-sm">
                Activity request submitted for review. The security team will respond with a decision.
              </div>
            )}
            <label className="block text-sm font-medium">Activity title<Input fullWidth value={activity.title} onChange={(event) => setActivity({ ...activity, title: event.target.value })} required /></label>
            <label className="block text-sm font-medium">Description<TextArea fullWidth rows={3} value={activity.description} onChange={(event) => setActivity({ ...activity, description: event.target.value })} required /></label>
            <label className="block text-sm font-medium">Target<Input fullWidth placeholder="System, domain, lab, or repository" value={activity.target} onChange={(event) => setActivity({ ...activity, target: event.target.value })} required /></label>
            <label className="block text-sm font-medium">Exact scope and exclusions<TextArea fullWidth rows={3} value={activity.scope} onChange={(event) => setActivity({ ...activity, scope: event.target.value })} required /></label>
            <label className="block text-sm font-medium">Techniques<Input fullWidth placeholder="comma-separated" value={activity.techniques} onChange={(event) => setActivity({ ...activity, techniques: event.target.value })} /></label>
            <label className="block text-sm font-medium">Data boundary<TextArea fullWidth rows={3} value={activity.dataBoundary} onChange={(event) => setActivity({ ...activity, dataBoundary: event.target.value })} required /></label>
            <label className="block text-sm font-medium">Purpose<TextArea fullWidth rows={3} value={activity.purpose} onChange={(event) => setActivity({ ...activity, purpose: event.target.value })} required /></label>
            <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium">Starts<Input fullWidth type="datetime-local" value={activity.startsAt} onChange={(event) => setActivity({ ...activity, startsAt: event.target.value })} required /></label><label className="block text-sm font-medium">Ends<Input fullWidth type="datetime-local" value={activity.endsAt} onChange={(event) => setActivity({ ...activity, endsAt: event.target.value })} required /></label></div>
            <Button type="submit" variant="primary" isPending={activityLoading}>Submit for authorization</Button>
          </form></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center gap-3"><AlertTriangle className="h-6 w-6 text-[var(--danger)]" /><h2 className="text-xl font-bold">Report an incident</h2></CardHeader>
          <CardContent><form className="space-y-4" onSubmit={submitIncident}>
            <p className="text-sm text-[var(--muted)]">Use this for suspected compromise, unauthorized access, credential exposure, data loss, or unsafe activity. Do not investigate beyond your authorization.</p>
            {incidentError && (
              <div role="alert" className="p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger text-sm">
                {incidentError}
              </div>
            )}
            {incidentReceipt && (
              <div role="status" className="p-3 rounded-lg bg-success-50 dark:bg-success-900/20 text-success text-sm">
                Incident report submitted confidentially. Thank you for reporting promptly.
              </div>
            )}
            <label className="block text-sm font-medium">Incident title<Input fullWidth value={incident.title} onChange={(event) => setIncident({ ...incident, title: event.target.value })} required /></label>
            <label className="block text-sm font-medium">What happened?<TextArea fullWidth rows={4} value={incident.description} onChange={(event) => setIncident({ ...incident, description: event.target.value })} required /></label>
            <label className="block text-sm font-medium">Affected resource<Input fullWidth value={incident.affectedResource} onChange={(event) => setIncident({ ...incident, affectedResource: event.target.value })} required /></label>
            <div><Select fullWidth value={incident.severity} onChange={(value) => setIncident({ ...incident, severity: String(value ?? "low") })}><Label>Severity</Label><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger><Select.Popover><ListBox><ListBox.Item id="low" textValue="Low">Low<ListBox.ItemIndicator /></ListBox.Item><ListBox.Item id="moderate" textValue="Moderate">Moderate<ListBox.ItemIndicator /></ListBox.Item><ListBox.Item id="major" textValue="Major">Major<ListBox.ItemIndicator /></ListBox.Item><ListBox.Item id="critical" textValue="Critical">Critical<ListBox.ItemIndicator /></ListBox.Item></ListBox></Select.Popover></Select></div>
            <Button type="submit" variant="danger" isPending={incidentLoading}>Submit confidential report</Button>
          </form></CardContent>
        </Card>
      </div>
    </main>
  );
}
