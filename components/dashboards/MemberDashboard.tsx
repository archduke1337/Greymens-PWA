"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import type { Event, Notification, Registration, Resource } from "@/lib/types";
/** The caller's own issued tickets, as returned by /api/events/register. */
type MemberTicket = {
  $id: string;
  eventId: string;
  ticketCode: string;
  status: string;
  issuedAt?: string;
};

import {
  Calendar,
  Ticket as TicketIcon,
  Users,
  Award,
  Bell,
  FileText,
  Video,
  Link as LinkIcon,
  ChevronRight,
  Clock,
  MapPin,
  ArrowUpRight,
  FolderOpen,
} from "lucide-react";

export default function MemberDashboard() {
  const { user } = useAuth();
  const { userDepartments, userDesignations, membership } = usePermissions();

  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [registeredEvents, setRegisteredEvents] = useState<Event[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [tickets, setTickets] = useState<MemberTicket[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        const [dashboardResponse, ticketResponse, notificationResponse, resourceResponse] = await Promise.all([
          fetch("/api/dashboard", { credentials: "include", cache: "no-store" }),
          fetch("/api/events/register", { credentials: "include", cache: "no-store" }),
          fetch("/api/notifications?limit=10", { credentials: "include", cache: "no-store" }),
          fetch("/api/resources", { credentials: "include", cache: "no-store" }),
        ]);
        const dashboard = (await dashboardResponse.json()) as {
          upcomingEvents?: Event[];
          registrations?: Registration[];
          myEvents?: Array<{ event: Event | null }>;
          error?: string;
        };
        const ticketPayload = (await ticketResponse.json()) as { tickets?: MemberTicket[] };
        const notificationPayload = (await notificationResponse.json()) as { notifications?: Notification[] };
        const resourcePayload = (await resourceResponse.json()) as { resources?: Resource[] };
        if (!dashboardResponse.ok) throw new Error(dashboard.error || "Unable to load dashboard");
        if (!cancelled) {
          setUpcomingEvents(dashboard.upcomingEvents ?? []);
          setRegisteredEvents((dashboard.myEvents ?? []).flatMap(({ event }) => (event ? [event] : [])));
          setRegistrations(dashboard.registrations ?? []);
          setTickets(ticketResponse.ok ? ticketPayload.tickets ?? [] : []);
          setNotifications(notificationResponse.ok ? notificationPayload.notifications ?? [] : []);
          setResources(resourceResponse.ok ? (resourcePayload.resources ?? []).slice(0, 6) : []);
        }
      } catch (loadError) {
        if (!cancelled) console.error("Error loading member dashboard:", loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const now = new Date().toISOString().split("T")[0];
  const pastEvents = registrations.filter((r) => {
    const event = registeredEvents.find((e) => e.$id === r.eventId);
    return event && event.date < now;
  });

  const upcomingRegistrations = registrations.filter((r) => {
    const event = registeredEvents.find((e) => e.$id === r.eventId);
    return event && event.date >= now;
  });

  const activeTickets = tickets.filter((t) =>
    ["issued", "active"].includes(t.status)
  );

  const badges = userDesignations.length;

  const stats = [
    { label: "Events Attended", value: pastEvents.length, icon: Calendar, color: "text-primary" },
    { label: "Active Tickets", value: activeTickets.length, icon: TicketIcon, color: "text-emerald-400" },
    { label: "Departments", value: userDepartments.length, icon: Users, color: "text-blue-400" },
    { label: "Badges", value: badges, icon: Award, color: "text-amber-400" },
  ];

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="space-y-2">
          <div className="h-9 w-64 bg-zinc-800 rounded-lg animate-pulse" />
          <div className="h-4 w-80 bg-zinc-800 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, <span className="tracking-tight text-foreground">{user?.name}</span>
        </h1>
        <p className="text-zinc-400">
          {membership?.membershipNumber && (
            <span className="text-zinc-500">Member #{membership.membershipNumber}</span>
          )}
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="flex items-center justify-between">
                <Icon className={`w-5 h-5 ${stat.color}`} />
                <span className="text-2xl font-bold">{stat.value}</span>
              </div>
              <p className="text-sm text-zinc-400 mt-2">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Events */}
        <div className="lg:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">My Events</h2>
            <Link href="/events" className="text-sm text-primary hover:opacity-90 flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-lg bg-zinc-800/50 mb-4">
            {(["upcoming", "past"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 px-3 text-sm rounded-md transition-colors ${
                  activeTab === tab
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-400 hover:text-zinc-300"
                }`}
              >
                {tab === "upcoming" ? `Upcoming (${upcomingRegistrations.length})` : `Past (${pastEvents.length})`}
              </button>
            ))}
          </div>

          {activeTab === "upcoming" ? (
            upcomingRegistrations.length > 0 ? (
              <div className="space-y-3">
                {upcomingRegistrations.map((reg) => {
                  const event = registeredEvents.find((e) => e.$id === reg.eventId);
                  if (!event) return null;
                  return (
                    <div key={reg.$id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-zinc-800/50 transition-colors">
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm truncate">{event.title}</h3>
                        <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {event.venue}
                          </span>
                        </div>
                      </div>
                      <Link href={`/events/${event.$id}`} className="text-zinc-500 hover:text-zinc-300">
                        <ArrowUpRight className="w-4 h-4" />
                      </Link>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">No upcoming events registered</p>
                <Link href="/events" className="text-sm text-primary hover:opacity-90 mt-2 inline-block">
                  Browse Events
                </Link>
              </div>
            )
          ) : pastEvents.length > 0 ? (
            <div className="space-y-3">
              {pastEvents.map((reg) => {
                const event = registeredEvents.find((e) => e.$id === reg.eventId);
                if (!event) return null;
                return (
                  <div key={reg.$id} className="flex items-center gap-4 p-3 rounded-lg opacity-60">
                    <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-5 h-5 text-zinc-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate">{event.title}</h3>
                      <p className="text-xs text-zinc-500 mt-1">
                        {new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-zinc-500">No past events</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Upcoming Events Feed */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="text-lg font-semibold mb-4">Upcoming Events</h2>
            {upcomingEvents.length > 0 ? (
              <div className="space-y-3">
                {upcomingEvents.slice(0, 4).map((event) => (
                  <Link
                    key={event.$id}
                    href={`/events/${event.$id}`}
                    className="block p-3 rounded-lg hover:bg-zinc-800/50 transition-colors group"
                  >
                    <h3 className="font-medium text-sm group-hover:text-primary transition-colors truncate">
                      {event.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                      <Clock className="w-3 h-3" />
                      {new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      <span className="text-zinc-700">•</span>
                      <MapPin className="w-3 h-3" />
                      {event.venue}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500 text-center py-4">No upcoming events</p>
            )}
          </div>

          {/* Recent Notifications */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="text-lg font-semibold mb-4">Notifications</h2>
            {notifications.length > 0 ? (
              <div className="space-y-3">
                {notifications.slice(0, 5).map((notif) => (
                  <div
                    key={notif.$id}
                    className={`p-3 rounded-lg ${notif.read ? "opacity-60" : "bg-zinc-800/50"}`}
                  >
                    <div className="flex items-start gap-2">
                      {!notif.read && <Bell className="w-3 h-3 text-primary mt-1 flex-shrink-0" />}
                      <div className="min-w-0">
                        <h4 className="text-sm font-medium truncate">{notif.title}</h4>
                        <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{notif.body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <Bell className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No notifications</p>
              </div>
            )}
          </div>

          {/* Resources Quick Access */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Resources</h2>
              <Link href="/resources" className="text-sm text-primary hover:opacity-90 flex items-center gap-1">
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            {resources.length > 0 ? (
              <div className="space-y-2">
                {resources.slice(0, 5).map((res) => {
                  const iconMap = {
                    document: FileText,
                    link: LinkIcon,
                    video: Video,
                    file: FolderOpen,
                    announcement: Bell,
                  };
                  const Icon = iconMap[res.type] || FileText;
                  return (
                    <div key={res.$id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/50 transition-colors">
                      <Icon className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                      <span className="text-sm truncate">{res.title}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-zinc-500 text-center py-4">No resources available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
