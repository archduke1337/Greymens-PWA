"use client";

import type { Notification } from "@/lib/types";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  ListBox,
  Select,
  Switch,
  TextArea,
  Modal,
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalBody,
  ModalFooter,
  ModalHeader,
  useOverlayState,
  Spinner,
} from "@heroui/react";
import { Bell, Send, CheckCircle, XCircle, Clock } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { readApiError } from "@/lib/errorHandler";
import { logError } from "@/lib/logger";

export default function AdminNotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [recipientNames, setRecipientNames] = useState<Record<string, string>>(
    {},
  );
  const [members, setMembers] = useState<
    Array<{ userId: string; name: string; urn?: string }>
  >([]);
  const [membersAvailable, setMembersAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { isOpen, open, close } = useOverlayState();
  const [sending, setSending] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [form, setForm] = useState({
    audience: "single" as "single" | "all_members" | "all_users",
    userId: "",
    title: "",
    body: "",
    type: "admin_announcement",
    sendEmail: false,
  });

  const loadData = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications?all=true&limit=200", {
        credentials: "include",
      });
      const payload = (await response.json()) as {
        notifications?: Notification[];
        accountNames?: Record<string, string>;
        emailConfigured?: boolean;
        error?: string;
      };

      if (!response.ok)
        throw new Error(readApiError(payload, "Unable to load notifications"));
      setNotifications(payload.notifications ?? []);
      setRecipientNames(payload.accountNames ?? {});
      setEmailConfigured(payload.emailConfigured === true);
    } catch (error) {
      logError("Error loading notifications:", error);
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMembers = useCallback(async () => {
    // Recipient picker directory. Best-effort: without users.view the admin
    // pastes a user ID instead of being blocked.
    try {
      const response = await fetch("/api/admin/users?limit=200", {
        credentials: "include",
      });

      if (!response.ok) throw new Error("member directory unavailable");
      const data = (await response.json()) as {
        users?: Array<{
          profile?: { userId?: string; urn?: string };
          membership?: { status?: string } | null;
        }>;
        accountNames?: Record<string, string>;
      };
      const options = (data.users ?? [])
        .map((entry): { userId: string; name: string; urn?: string } | null => {
          const userId = String(entry.profile?.userId ?? "");

          if (!userId || entry.membership?.status !== "active") return null;

          return {
            userId,
            name: data.accountNames?.[userId] || userId,
            urn: entry.profile?.urn,
          };
        })
        .filter(
          (option): option is { userId: string; name: string; urn?: string } =>
            option !== null,
        )
        .sort((a, b) => a.name.localeCompare(b.name));

      setMembers(options);
      setMembersAvailable(true);
    } catch {
      setMembers([]);
      setMembersAvailable(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");

      return;
    }
    loadData();
    if (!authLoading && user) void loadMembers();
  }, [user, authLoading, router, loadData, loadMembers]);

  const handleSend = async () => {
    if (!user) return;
    if (
      (form.audience === "single" && !form.userId.trim()) ||
      !form.title.trim() ||
      !form.body.trim()
    ) {
      toast.error(
        form.audience === "single"
          ? "Recipient, title, and body are all required"
          : "Title and body are both required",
      );

      return;
    }
    if (form.audience !== "single" && form.sendEmail && !emailConfigured) {
      toast.error("Email is not configured — uncheck email or set it up");

      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...(form.audience === "single"
            ? { userId: form.userId.trim() }
            : { audience: form.audience }),
          type: form.type,
          title: form.title.trim(),
          body: form.body.trim(),
          sendEmail: form.sendEmail,
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
      const audienceLabel =
        form.audience === "single"
          ? recipientNames[form.userId.trim()] || "member"
          : form.audience === "all_members"
            ? `${sent} members`
            : `${sent} users`;
      let message = `Notification sent to ${audienceLabel}`;

      if (form.sendEmail) {
        message += email?.attempted
          ? ` · email to ${email.sent ?? 0}${email.failed ? ` (${email.failed} failed)` : ""}`
          : " · email skipped (not configured)";
      }
      toast.success(message);
      close();
      setForm({
        audience: "single",
        userId: "",
        title: "",
        body: "",
        type: "admin_announcement",
        sendEmail: false,
      });
      await loadData();
    } catch (error) {
      logError("Error sending notification:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to send notification",
      );
    } finally {
      setSending(false);
    }
  };

  const filtered = notifications.filter((n) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();

    return (
      n.title.toLowerCase().includes(q) ||
      n.body.toLowerCase().includes(q) ||
      n.type.toLowerCase().includes(q)
    );
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "membership_approved":
        return <CheckCircle className="w-4 h-4 text-success" />;
      case "membership_rejected":
        return <XCircle className="w-4 h-4 text-danger" />;
      case "promotion":
        return <CheckCircle className="w-4 h-4 text-primary" />;
      default:
        return <Bell className="w-4 h-4 text-accent" />;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div
          aria-label="Loading notifications"
          className="text-center space-y-4"
          role="status"
        >
          <Spinner size="lg" />
          <p className="text-default-500">Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 md:py-8 px-4 md:px-6">
      <div className="flex items-start justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Notification Management
          </h1>
          <p className="text-default-500 mt-1 md:mt-2 text-sm md:text-base">
            View and send system notifications
          </p>
        </div>
        <Button variant="primary" onPress={open}>
          <Send className="w-4 h-4" />
          Send Notification
        </Button>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <Input
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e: any) => setSearchQuery(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Notifications List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Bell className="w-16 h-16 text-default-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No notifications</h3>
            <p className="text-default-500">
              {searchQuery
                ? "Try a different search"
                : "No notifications in the system yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((notif) => (
            <Card key={notif.$id}>
              <CardContent className="p-4 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  {getNotificationIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{notif.title}</h3>
                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="text-sm text-default-500 mt-1 line-clamp-2">
                    {notif.body}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-default-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {notif.$createdAt
                        ? new Date(notif.$createdAt).toLocaleString()
                        : "-"}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-default-100">
                      {notif.type}
                    </span>
                    <span>
                      To: {recipientNames[notif.userId] || notif.userId}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Send Notification Modal */}
      <Modal>
        <ModalBackdrop
          isOpen={isOpen}
          onOpenChange={(o) => {
            if (!o) close();
          }}
        >
          <ModalContainer>
            <ModalDialog>
              <ModalHeader>Send Notification</ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <div>
                    <span className="text-sm font-medium mb-1 block">
                      Audience{" "}
                      <span aria-hidden="true" className="text-danger">
                        *
                      </span>
                    </span>
                    <div
                      aria-label="Notification audience"
                      className="flex flex-wrap gap-2"
                      role="group"
                    >
                      {(
                        [
                          { value: "single", label: "One member" },
                          { value: "all_members", label: "All members" },
                          { value: "all_users", label: "Everyone" },
                        ] as const
                      ).map((option) => (
                        <Button
                          key={option.value}
                          size="sm"
                          variant={
                            form.audience === option.value
                              ? "primary"
                              : "secondary"
                          }
                          onPress={() =>
                            setForm((p) => ({ ...p, audience: option.value }))
                          }
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                    {form.audience !== "single" && (
                      <p className="text-xs text-default-500 mt-1">
                        {form.audience === "all_members"
                          ? "One in-app notice per active member (max 500)."
                          : "One in-app notice per profile holder (max 500)."}
                      </p>
                    )}
                  </div>
                  {form.audience === "single" &&
                    (membersAvailable ? (
                      <div>
                        <Select
                          fullWidth
                          value={form.userId === "" ? null : form.userId}
                          onChange={(value) =>
                            setForm((p) => ({
                              ...p,
                              userId: String(value ?? ""),
                            }))
                          }
                        >
                          <Label>
                            Recipient{" "}
                            <span aria-hidden="true" className="text-danger">
                              *
                            </span>
                          </Label>
                          <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              {members.map((member) => (
                                <ListBox.Item
                                  key={member.userId}
                                  id={member.userId}
                                  textValue={member.name}
                                >
                                  {member.name}
                                  {member.urn ? ` · ${member.urn}` : ""}
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                              ))}
                            </ListBox>
                          </Select.Popover>
                        </Select>
                      </div>
                    ) : (
                      <div>
                        <label className="text-sm font-medium mb-1 block">
                          Recipient User ID{" "}
                          <span aria-hidden="true" className="text-danger">
                            *
                          </span>
                        </label>
                        <Input
                          placeholder="Member directory unavailable — enter the user's ID"
                          value={form.userId}
                          onChange={(e: any) =>
                            setForm((p) => ({ ...p, userId: e.target.value }))
                          }
                        />
                      </div>
                    ))}
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Title{" "}
                      <span aria-hidden="true" className="text-danger">
                        *
                      </span>
                    </label>
                    <Input
                      maxLength={255}
                      placeholder="Notification title"
                      value={form.title}
                      onChange={(e: any) =>
                        setForm((p) => ({ ...p, title: e.target.value }))
                      }
                    />
                    <p className="text-xs text-default-400 mt-1 tabular-nums">
                      {form.title.length}/255
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Body{" "}
                      <span aria-hidden="true" className="text-danger">
                        *
                      </span>
                    </label>
                    <TextArea
                      maxLength={5000}
                      placeholder="Notification message..."
                      rows={3}
                      value={form.body}
                      onChange={(e: any) =>
                        setForm((p) => ({ ...p, body: e.target.value }))
                      }
                    />
                    <p className="text-xs text-default-400 mt-1 tabular-nums">
                      {form.body.length}/5000
                    </p>
                  </div>
                  <div>
                    <Select
                      fullWidth
                      value={form.type}
                      onChange={(value) =>
                        setForm((p) => ({
                          ...p,
                          type: String(value ?? "general"),
                        }))
                      }
                    >
                      <Label>Type</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {[
                            {
                              value: "admin_announcement",
                              label: "Admin Announcement",
                            },
                            { value: "system_update", label: "System Update" },
                            { value: "event_update", label: "Event Update" },
                            {
                              value: "event_reminder",
                              label: "Event Reminder",
                            },
                            { value: "general", label: "General" },
                          ].map((type) => (
                            <ListBox.Item
                              key={type.value}
                              id={type.value}
                              textValue={type.label}
                            >
                              {type.label}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>
                  <div className="rounded-xl border border-border p-3">
                    <Switch
                      isSelected={form.sendEmail}
                      onChange={(checked: boolean) =>
                        setForm((p) => ({ ...p, sendEmail: checked }))
                      }
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
                        ? "Mails every recipient's account address alongside the in-app notice."
                        : "Email is not configured — set RESEND_API_KEY and EMAIL_FROM on the server to enable it."}
                    </p>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="secondary" onPress={close}>
                  Cancel
                </Button>
                <Button
                  isPending={sending}
                  variant="primary"
                  onPress={handleSend}
                >
                  <Send className="w-4 h-4" />
                  Send
                </Button>
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>
    </div>
  );
}
