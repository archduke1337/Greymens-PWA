// app/admin/notifications/compose/page.tsx
// Full notification composer: pick offices and/or individual members and/or
// a broadcast audience, see exactly who that reaches, then send. The quick
// modal on the notifications feed stays for one-off sends; anything with a
// real audience gets built here.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardContent,
  Checkbox,
  Input,
  Label,
  ListBox,
  Select,
  Spinner,
  Switch,
  TextArea,
} from "@heroui/react";
import { ArrowLeft, Search, Send, X } from "lucide-react";

import { GOVERNANCE_OFFICES } from "@/lib/governance";
import { renderEmailHtml } from "@/lib/email-template";
import { useAuth } from "@/context/AuthContext";
import { readApiError } from "@/lib/errorHandler";
import { logError } from "@/lib/logger";

const LAYER_LABELS: Record<string, string> = {
  executive: "Executive",
  general_council: "General council",
  technical: "Technical",
  security: "Security",
};

const BROADCAST_OPTIONS = [
  { value: "", label: "None — only the selection above" },
  { value: "all_members", label: "All active members" },
  { value: "not_onboarded", label: "Not onboarded (registered, no profile)" },
  { value: "all_users", label: "All registered profiles" },
] as const;

const MESSAGE_TYPES = [
  { value: "admin_announcement", label: "Admin announcement" },
  { value: "system_update", label: "System update" },
  { value: "event_update", label: "Event update" },
  { value: "event_reminder", label: "Event reminder" },
  { value: "general", label: "General" },
] as const;

interface MemberPick {
  userId: string;
  name: string;
  urn: string;
}

interface OfficePreview {
  officeId: string;
  title: string;
  holders: string[];
}

interface ResolvePreview {
  count: number;
  capped: boolean;
  sample: string[];
  offices: OfficePreview[];
}

export default function ComposeNotificationPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [selectedOffices, setSelectedOffices] = useState<string[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<MemberPick[]>([]);
  const [broadcast, setBroadcast] = useState<string>("");
  const [memberQuery, setMemberQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemberPick[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchAvailable, setSearchAvailable] = useState(true);
  const [manualIds, setManualIds] = useState("");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<string>("admin_announcement");
  const [sendEmail, setSendEmail] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(false);

  const [preview, setPreview] = useState<ResolvePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  // The console's email toggle renders from this — the client cannot read
  // server env, so the server states the channel.
  useEffect(() => {
    if (authLoading || !user) return;

    fetch("/api/notifications?all=true&limit=1", { credentials: "include" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as {
          emailConfigured?: boolean;
        } | null;

        if (response.ok && payload) setEmailConfigured(payload.emailConfigured === true);
      })
      .catch(() => {});
  }, [user, authLoading]);

  const manualIdList = useMemo(
    () =>
      manualIds
        .split(/[\s,]+/)
        .map((value) => value.trim())
        .filter(Boolean),
    [manualIds],
  );

  const hasRecipients =
    selectedOffices.length > 0 ||
    selectedMembers.length > 0 ||
    manualIdList.length > 0 ||
    broadcast !== "";

  // Live recipient resolution: every change re-resolves against the same
  // server logic the send path uses, so the count cannot disagree.
  useEffect(() => {
    if (!user || authLoading || !hasRecipients) {
      setPreview(null);

      return;
    }
    const params = new URLSearchParams({ resolve: "true" });
    const userIds = [
      ...selectedMembers.map((member) => member.userId),
      ...manualIdList,
    ];

    if (userIds.length > 0) params.set("userIds", userIds.join(","));
    if (selectedOffices.length > 0)
      params.set("officeIds", selectedOffices.join(","));
    if (broadcast) params.set("audience", broadcast);

    let cancelled = false;

    setPreviewLoading(true);
    fetch(`/api/notifications?${params.toString()}`, {
      credentials: "include",
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | (ResolvePreview & { error?: string })
          | null;

        if (!cancelled && response.ok && payload) {
          setPreview({
            count: payload.count ?? 0,
            capped: payload.capped === true,
            sample: payload.sample ?? [],
            offices: payload.offices ?? [],
          });
        } else if (!cancelled) {
          setPreview(null);
        }
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    user,
    authLoading,
    hasRecipients,
    selectedMembers,
    manualIdList,
    selectedOffices,
    broadcast,
  ]);

  // Member search (debounced): without users.view the directory 403s and the
  // sender pastes account ids instead of being blocked.
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const query = memberQuery.trim();

    if (!query || !user) {
      setSearchResults([]);

      return;
    }

    searchTimer.current = setTimeout(() => {
      setSearching(true);
      fetch(
        `/api/admin/members/search?q=${encodeURIComponent(query)}&limit=10`,
        { credentials: "include" },
      )
        .then(async (response) => {
          if (response.status === 403) {
            setSearchAvailable(false);
            setSearchResults([]);

            return;
          }
          const payload = (await response.json().catch(() => null)) as {
            candidates?: MemberPick[];
          } | null;

          if (response.ok) setSearchResults(payload?.candidates ?? []);
        })
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 250);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [memberQuery, user]);

  const toggleOffice = (officeId: string) => {
    setSelectedOffices((prev) =>
      prev.includes(officeId)
        ? prev.filter((id) => id !== officeId)
        : [...prev, officeId],
    );
  };

  const addMember = (member: MemberPick) => {
    setSelectedMembers((prev) =>
      prev.some((picked) => picked.userId === member.userId)
        ? prev
        : [...prev, member],
    );
    setMemberQuery("");
    setSearchResults([]);
  };

  const officesByLayer = useMemo(() => {
    const groups = new Map<string, typeof GOVERNANCE_OFFICES>();

    for (const office of GOVERNANCE_OFFICES) {
      const group = groups.get(office.layer) ?? [];

      group.push(office);
      groups.set(office.layer, group);
    }

    return [...groups.entries()];
  }, []);

  const handleSend = async () => {
    if (!user) return;
    if (!hasRecipients) {
      toast.error("Pick at least one office, member, or audience first");

      return;
    }
    if (!title.trim() || !body.trim()) {
      toast.error("Title and body are both required");

      return;
    }
    if (sendEmail && !emailConfigured) {
      toast.error("Email is not configured — uncheck email or set it up");

      return;
    }
    if (preview?.capped) {
      toast.error("Over the 500-recipient limit — narrow the selection first");

      return;
    }

    setSending(true);
    try {
      const userIds = [
        ...selectedMembers.map((member) => member.userId),
        ...manualIdList,
      ];
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...(userIds.length > 0 ? { userIds } : {}),
          ...(selectedOffices.length > 0
            ? { officeIds: selectedOffices }
            : {}),
          ...(broadcast ? { audience: broadcast } : {}),
          type,
          title: title.trim(),
          body: body.trim(),
          sendEmail,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        sent?: number;
        email?: { attempted?: boolean; sent?: number; failed?: number };
        error?: string;
      } | null;

      if (!response.ok)
        throw new Error(readApiError(payload, "Unable to send notification"));

      const sent = payload?.sent ?? 0;
      const email = payload?.email;
      let message = `Notification sent to ${sent} recipient${sent === 1 ? "" : "s"}`;

      if (sendEmail) {
        message += email?.attempted
          ? ` · email to ${email.sent ?? 0}${email.failed ? ` (${email.failed} failed)` : ""}`
          : " · email skipped (not configured)";
      }
      toast.success(message);
      router.push("/admin/notifications");
    } catch (error) {
      logError("Error sending notification:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to send notification",
      );
    } finally {
      setSending(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div
          aria-label="Loading composer"
          className="text-center space-y-4"
          role="status"
        >
          <Spinner size="lg" />
          <p className="text-default-500">Loading composer…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 md:py-8 px-4 md:px-6">
      <Link
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        href="/admin/notifications"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        All notifications
      </Link>

      <div className="mt-2 mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          Compose notification
        </h1>
        <p className="text-default-500 mt-1 md:mt-2 text-sm md:text-base">
          Target offices, pick members, or both — the recipient count updates
          as you build.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recipients */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-4 sm:p-5 space-y-4">
              <h2 className="font-bold tracking-tight">Offices</h2>
              {officesByLayer.map(([layer, offices]) => (
                <fieldset key={layer}>
                  <legend className="text-xs font-medium uppercase tracking-widest text-muted mb-2">
                    {LAYER_LABELS[layer] ?? layer}
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {offices.map((office) => (
                      <Checkbox
                        key={office.id}
                        aria-label={office.title}
                        isSelected={selectedOffices.includes(office.id)}
                        onChange={() => toggleOffice(office.id)}
                      >
                        <Checkbox.Content>
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                          <span className="text-sm">{office.title}</span>
                        </Checkbox.Content>
                      </Checkbox>
                    ))}
                  </div>
                </fieldset>
              ))}
              {selectedOffices.length === 0 && (
                <p className="text-xs text-default-400">
                  No office selected. Vacant offices resolve to nobody — the
                  count below shows it before you send.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-5 space-y-4">
              <h2 className="font-bold tracking-tight">Members</h2>
              {searchAvailable ? (
                <div className="relative">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                  />
                  <label className="sr-only" htmlFor="compose-member-search">
                    Search members to add
                  </label>
                  <Input
                    className="pl-9"
                    id="compose-member-search"
                    placeholder="Type a name or URN to add members…"
                    value={memberQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setMemberQuery(e.target.value)
                    }
                  />
                  {(searching || searchResults.length > 0) && (
                    <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-default-200 bg-surface shadow-lg">
                      {searching && searchResults.length === 0 ? (
                        <p className="px-4 py-3 text-sm text-muted">
                          Searching…
                        </p>
                      ) : (
                        <ul className="max-h-56 overflow-y-auto py-1">
                          {searchResults
                            .filter(
                              (result) =>
                                !selectedMembers.some(
                                  (picked) =>
                                    picked.userId === result.userId,
                                ),
                            )
                            .map((result) => (
                              <li key={result.userId}>
                                <button
                                  className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-surface-secondary"
                                  type="button"
                                  onClick={() => addMember(result)}
                                >
                                  <span className="font-medium">
                                    {result.name}
                                  </span>
                                  <span className="text-xs text-muted">
                                    {result.urn}
                                  </span>
                                </button>
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    htmlFor="compose-manual-ids"
                  >
                    Recipient account IDs
                  </label>
                  <TextArea
                    id="compose-manual-ids"
                    placeholder="One account ID per line, or comma-separated"
                    rows={3}
                    value={manualIds}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setManualIds(e.target.value)
                    }
                  />
                  <p className="text-xs text-default-400">
                    Member search needs directory access — paste IDs instead.
                  </p>
                </div>
              )}
              {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedMembers.map((member) => (
                    <button
                      key={member.userId}
                      aria-label={`Remove ${member.name}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-soft-foreground transition-colors hover:opacity-80"
                      type="button"
                      onClick={() =>
                        setSelectedMembers((prev) =>
                          prev.filter(
                            (picked) => picked.userId !== member.userId,
                          ),
                        )
                      }
                    >
                      {member.name}
                      <X aria-hidden="true" className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-5 space-y-2">
              <h2 className="font-bold tracking-tight">Also include</h2>
              <Select
                fullWidth
                value={broadcast}
                onChange={(value) => setBroadcast(String(value ?? ""))}
              >
                <Label className="sr-only">Broadcast audience</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {BROADCAST_OPTIONS.map((option) => (
                      <ListBox.Item
                        key={option.value}
                        id={option.value}
                        textValue={option.label}
                      >
                        {option.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
              <p className="text-xs text-default-400">
                Unions with the offices and members above — duplicates receive
                once.
              </p>
            </CardContent>
          </Card>

          {/* Live recipient summary */}
          <Card>
            <CardContent className="p-4 sm:p-5 space-y-2">
              <h2 className="font-bold tracking-tight">Recipients</h2>
              {!hasRecipients ? (
                <p className="text-sm text-muted">
                  Nothing selected yet — pick offices or members above.
                </p>
              ) : previewLoading ? (
                <p className="text-sm text-muted">Resolving recipients…</p>
              ) : preview ? (
                <div className="space-y-2 text-sm">
                  <p
                    aria-live="polite"
                    className="font-semibold tabular-nums"
                  >
                    {preview.count} recipient{preview.count === 1 ? "" : "s"}
                    {preview.capped && (
                      <span className="text-warning-700">
                        {" "}
                        — over the 500 limit, narrow the selection
                      </span>
                    )}
                  </p>
                  {preview.offices.length > 0 && (
                    <ul className="space-y-1 text-muted">
                      {preview.offices.map((office) => (
                        <li key={office.officeId}>
                          {office.title}:{" "}
                          {office.holders.length > 0
                            ? office.holders.join(", ")
                            : "vacant — reaches nobody"}
                        </li>
                      ))}
                    </ul>
                  )}
                  {preview.sample.length > 0 && (
                    <p className="text-muted">
                      Including: {preview.sample.slice(0, 6).join(", ")}
                      {preview.count > 6 &&
                        ` and ${preview.count - 6} more`}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted">
                  Recipient preview unavailable — the send will still validate
                  before writing anything.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Message */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-4 sm:p-5 space-y-4">
              <h2 className="font-bold tracking-tight">Message</h2>
              <div>
                <label className="text-sm font-medium mb-1 block" htmlFor="compose-title">
                  Title{" "}
                  <span aria-hidden="true" className="text-danger">
                    *
                  </span>
                </label>
                <Input
                  id="compose-title"
                  maxLength={255}
                  placeholder="Notification title"
                  value={title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setTitle(e.target.value)
                  }
                />
                <p className="text-xs text-default-400 mt-1 tabular-nums">
                  {title.length}/255
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block" htmlFor="compose-body">
                  Body{" "}
                  <span aria-hidden="true" className="text-danger">
                    *
                  </span>
                </label>
                <TextArea
                  id="compose-body"
                  maxLength={5000}
                  placeholder={
                    "Team — quick update…\n\n**Friday session** moved to 5 PM in the lab."
                  }
                  rows={7}
                  value={body}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setBody(e.target.value)
                  }
                />
                <p className="text-xs text-default-400 mt-1 tabular-nums">
                  {body.length}/5000 · Markdown works: **bold**, *italic*,
                  [link](https://…), lists, `code`
                </p>
              </div>
              <Select
                fullWidth
                value={type}
                onChange={(value) => setType(String(value ?? "general"))}
              >
                <Label>Type</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {MESSAGE_TYPES.map((option) => (
                      <ListBox.Item
                        key={option.value}
                        id={option.value}
                        textValue={option.label}
                      >
                        {option.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
              <div className="rounded-xl border border-border p-3">
                <Switch
                  isSelected={sendEmail}
                  onChange={(checked: boolean) => setSendEmail(checked)}
                >
                  <Switch.Content>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                    Also send by email
                  </Switch.Content>
                </Switch>
                <p className="text-xs text-default-500 mt-1.5">
                  {emailConfigured
                    ? "Mails each recipient's account address alongside the in-app notice."
                    : "Email is not configured — set RESEND_API_KEY and EMAIL_FROM on the server to enable it."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-5 space-y-2">
              <h2 className="font-bold tracking-tight">Email preview</h2>
              <div
                className="max-h-72 overflow-y-auto overflow-x-hidden rounded-xl border border-default-200 bg-white"
                // Safe: the shared shell escapes the title and body.
                dangerouslySetInnerHTML={{
                  __html: renderEmailHtml(
                    title.trim() || "Notification",
                    body.trim() || "Your message will appear here.",
                  ),
                }}
              />
            </CardContent>
          </Card>

          <Button
            fullWidth
            className="rounded-full"
            isDisabled={sending || !hasRecipients || preview?.capped === true}
            isPending={sending}
            variant="primary"
            onPress={handleSend}
          >
            <Send aria-hidden="true" className="h-4 w-4" />
            {sending
              ? "Sending…"
              : preview
                ? `Send to ${preview.count} recipient${preview.count === 1 ? "" : "s"}`
                : "Send notification"}
          </Button>
        </div>
      </div>
    </div>
  );
}
