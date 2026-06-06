"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { notificationService } from "@/lib/notifications";
import { profileService } from "@/lib/profiles";
import type { Notification, Profile } from "@/lib/types";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardContent,
  Input,
  TextArea,
  Modal,
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalBody,
  ModalFooter,
  ModalHeader,
  useOverlayState,
} from "@heroui/react";
import {
  Bell,
  Send,
  Search,
  CheckCircle,
  Clock,
  Loader2,
} from "lucide-react";

export default function AdminNotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { isOpen, open, close } = useOverlayState();
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    userId: "",
    title: "",
    body: "",
    type: "admin_announcement",
  });

  const loadData = useCallback(async () => {
    try {
      const allNotifs = await notificationService.getAll(200);
      setNotifications(allNotifs);

      // Load only profiles for recipients shown in the list
      const recipientIds = [...new Set(allNotifs.map((n) => n.userId))].slice(0, 50);
      const profileResults = await Promise.all(
        recipientIds.map((id) => profileService.getByUserId(id).catch(() => null))
      );
      const profileMap: Record<string, Profile> = {};
      profileResults.forEach((p) => {
        if (p) profileMap[p.userId] = p;
      });
      setProfiles(profileMap);
    } catch (error) {
      console.error("Error loading notifications:", error);
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (!authLoading && user && (user.prefs as Record<string, unknown>)?.role !== "admin") {
      router.push("/unauthorized");
      return;
    }
    loadData();
  }, [user, authLoading, router, loadData]);

  const handleSend = async () => {
    if (!user) return;
    if (!form.userId || !form.title || !form.body) {
      toast.error("All fields are required");
      return;
    }

    setSending(true);
    try {
      await notificationService.create({
        userId: form.userId,
        type: form.type,
        title: form.title,
        body: form.body,
      });

      toast.success("Notification sent!");
      close();
      setForm({ userId: "", title: "", body: "", type: "admin_announcement" });
      await loadData();
    } catch (error) {
      console.error("Error sending notification:", error);
      toast.error("Failed to send notification");
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
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "membership_rejected":
        return <CheckCircle className="w-4 h-4 text-red-500" />;
      case "promotion":
        return <CheckCircle className="w-4 h-4 text-purple-500" />;
      default:
        return <Bell className="w-4 h-4 text-blue-500" />;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin h-10 w-10 text-purple-500" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 md:py-8 px-4 md:px-6">
      <div className="flex items-start justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
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
      <Card className="border-none shadow-md mb-6">
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
        <Card className="border-none shadow-md">
          <CardContent className="p-12 text-center">
            <Bell className="w-16 h-16 text-default-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No notifications</h3>
            <p className="text-default-500">
              {searchQuery ? "Try a different search" : "No notifications in the system yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((notif) => (
            <Card key={notif.$id} className="border-none shadow-md">
              <CardContent className="p-4 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                  {getNotificationIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{notif.title}</h3>
                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                    )}
                  </div>
                  <p className="text-sm text-default-500 mt-1 line-clamp-2">{notif.body}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-default-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {notif.$createdAt ? new Date(notif.$createdAt).toLocaleString() : "-"}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-default-100">{notif.type}</span>
                    <span>To: {profiles[notif.userId]?.urn || notif.userId.slice(0, 8)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Send Notification Modal */}
      <Modal>
        <ModalBackdrop isOpen={isOpen} onOpenChange={(o) => { if (!o) close(); }}>
          <ModalContainer>
            <ModalDialog>
              <ModalHeader>Send Notification</ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Recipient User ID</label>
                    <Input
                      placeholder="Enter the user's ID"
                      value={form.userId}
                      onChange={(e: any) => setForm((p) => ({ ...p, userId: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Title</label>
                    <Input
                      placeholder="Notification title"
                      value={form.title}
                      onChange={(e: any) => setForm((p) => ({ ...p, title: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Body</label>
                    <TextArea
                      placeholder="Notification message..."
                      value={form.body}
                      onChange={(e: any) => setForm((p) => ({ ...p, body: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Type</label>
                    <select
                      value={form.type}
                      onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-foreground"
                    >
                      <option value="admin_announcement">Admin Announcement</option>
                      <option value="system_update">System Update</option>
                      <option value="event_update">Event Update</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="ghost" onPress={close}>Cancel</Button>
                <Button
                  variant="primary"
                  onPress={handleSend}
                  isPending={sending}
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
