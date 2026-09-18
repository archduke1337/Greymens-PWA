"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, CardContent, CardHeader, Description, FieldError, Form, Input, Label, ListBox, Select, TextArea, TextField } from "@heroui/react";
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
            say something here. Non-security complaints (conduct, disputes)
            go through{" "}
            <a href="/help-feedback" className="font-medium text-foreground underline underline-offset-4">
              Help &amp; feedback
            </a>{" "}
            so the right officers see them.
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
          <CardContent><Form validationBehavior="aria" onSubmit={submitActivity} className="space-y-4">
            {activityError && (
              <Alert role="alert" status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Couldn&apos;t submit the request</Alert.Title>
                  <Alert.Description>{activityError}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}
            {activityReceipt && (
              <Alert role="status" status="success">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Request sent for review</Alert.Title>
                  <Alert.Description>
                    The security team will respond with a decision. Do not
                    start until you have it in writing.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            )}
            <TextField
              isRequired
              isDisabled={activityLoading}
              name="title"
              validate={(value) => (value.trim() ? null : "Name the activity")}
              value={activity.title}
              onChange={(value) => setActivity({ ...activity, title: value })}
            >
              <Label>Activity title</Label>
              <Input placeholder="What do you want to do?" />
              <FieldError />
            </TextField>
            <TextField
              isRequired
              isDisabled={activityLoading}
              name="description"
              validate={(value) => (value.trim() ? null : "Describe the activity")}
              value={activity.description}
              onChange={(value) => setActivity({ ...activity, description: value })}
            >
              <Label>Description</Label>
              <TextArea rows={3} placeholder="Methods, tools, expected outcome" />
              <FieldError />
            </TextField>
            <TextField
              isRequired
              isDisabled={activityLoading}
              name="target"
              validate={(value) => (value.trim() ? null : "Name the target")}
              value={activity.target}
              onChange={(value) => setActivity({ ...activity, target: value })}
            >
              <Label>Target</Label>
              <Input placeholder="System, domain, lab, or repository" />
              <FieldError />
            </TextField>
            <TextField
              isRequired
              isDisabled={activityLoading}
              name="scope"
              validate={(value) => (value.trim() ? null : "Define the scope")}
              value={activity.scope}
              onChange={(value) => setActivity({ ...activity, scope: value })}
            >
              <Label>Exact scope and exclusions</Label>
              <TextArea rows={3} placeholder="In scope, out of scope" />
              <FieldError />
            </TextField>
            <TextField
              isDisabled={activityLoading}
              name="techniques"
              value={activity.techniques}
              onChange={(value) => setActivity({ ...activity, techniques: value })}
            >
              <Label>Techniques</Label>
              <Input placeholder="Comma-separated" />
              <Description>Optional. Helps reviewers size the risk.</Description>
            </TextField>
            <TextField
              isRequired
              isDisabled={activityLoading}
              name="dataBoundary"
              validate={(value) => (value.trim() ? null : "State the data boundary")}
              value={activity.dataBoundary}
              onChange={(value) => setActivity({ ...activity, dataBoundary: value })}
            >
              <Label>Data boundary</Label>
              <TextArea rows={3} placeholder="What data will you touch, store, or see?" />
              <FieldError />
            </TextField>
            <TextField
              isRequired
              isDisabled={activityLoading}
              name="purpose"
              validate={(value) => (value.trim() ? null : "State the purpose")}
              value={activity.purpose}
              onChange={(value) => setActivity({ ...activity, purpose: value })}
            >
              <Label>Purpose</Label>
              <TextArea rows={3} placeholder="Why is this worth authorizing?" />
              <FieldError />
            </TextField>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                isRequired
                isDisabled={activityLoading}
                name="startsAt"
                validate={(value) => (value ? null : "Pick a start time")}
                value={activity.startsAt}
                onChange={(value) => setActivity({ ...activity, startsAt: value })}
              >
                <Label>Starts</Label>
                <Input type="datetime-local" />
                <FieldError />
              </TextField>
              <TextField
                isRequired
                isDisabled={activityLoading}
                name="endsAt"
                validate={(value) => (value ? null : "Pick an end time")}
                value={activity.endsAt}
                onChange={(value) => setActivity({ ...activity, endsAt: value })}
              >
                <Label>Ends</Label>
                <Input type="datetime-local" />
                <FieldError />
              </TextField>
            </div>
            <Button type="submit" variant="primary" isPending={activityLoading} isDisabled={activityLoading}>Submit for authorization</Button>
          </Form></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center gap-3"><AlertTriangle className="h-6 w-6 text-[var(--danger)]" /><h2 className="text-xl font-bold">Report an incident</h2></CardHeader>
          <CardContent><Form validationBehavior="aria" onSubmit={submitIncident} className="space-y-4">
            <p className="text-sm text-[var(--muted)]">Use this for suspected compromise, unauthorized access, credential exposure, data loss, or unsafe activity — including misconduct that affects safety. Do not investigate beyond your authorization.</p>
            {incidentError && (
              <Alert role="alert" status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Couldn&apos;t submit the report</Alert.Title>
                  <Alert.Description>{incidentError}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}
            {incidentReceipt && (
              <Alert role="status" status="success">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Report received, confidentially</Alert.Title>
                  <Alert.Description>
                    Thank you for reporting promptly. Say nothing about it
                    publicly while it is being handled.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            )}
            <TextField
              isRequired
              isDisabled={incidentLoading}
              name="title"
              validate={(value) => (value.trim() ? null : "Give the incident a title")}
              value={incident.title}
              onChange={(value) => setIncident({ ...incident, title: value })}
            >
              <Label>Incident title</Label>
              <Input placeholder="Short summary of what happened" />
              <FieldError />
            </TextField>
            <TextField
              isRequired
              isDisabled={incidentLoading}
              name="description"
              validate={(value) => (value.trim() ? null : "Describe what happened")}
              value={incident.description}
              onChange={(value) => setIncident({ ...incident, description: value })}
            >
              <Label>What happened?</Label>
              <TextArea rows={4} placeholder="What you saw, when, and where — facts first" />
              <FieldError />
            </TextField>
            <TextField
              isRequired
              isDisabled={incidentLoading}
              name="affectedResource"
              validate={(value) => (value.trim() ? null : "Name the affected resource")}
              value={incident.affectedResource}
              onChange={(value) => setIncident({ ...incident, affectedResource: value })}
            >
              <Label>Affected resource</Label>
              <Input placeholder="System, account, person, or data at risk" />
              <FieldError />
            </TextField>
            <div><Select fullWidth value={incident.severity} onChange={(value) => setIncident({ ...incident, severity: String(value ?? "low") })}><Label>Severity</Label><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger><Select.Popover><ListBox><ListBox.Item id="low" textValue="Low">Low<ListBox.ItemIndicator /></ListBox.Item><ListBox.Item id="moderate" textValue="Moderate">Moderate<ListBox.ItemIndicator /></ListBox.Item><ListBox.Item id="major" textValue="Major">Major<ListBox.ItemIndicator /></ListBox.Item><ListBox.Item id="critical" textValue="Critical">Critical<ListBox.ItemIndicator /></ListBox.Item></ListBox></Select.Popover></Select></div>
            <Button type="submit" variant="danger" isPending={incidentLoading} isDisabled={incidentLoading}>Submit confidential report</Button>
          </Form></CardContent>
        </Card>
      </div>
    </main>
  );
}
