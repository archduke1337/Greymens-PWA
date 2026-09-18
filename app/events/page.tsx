// app/events/page.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import type { Event as EventType } from "@/lib/types";
import { getErrorMessage } from "@/lib/errorHandler";
import {
  CalendarIcon,
  MapPinIcon,
  UsersIcon,
  HeartIcon,
  StarIcon,
  CrownIcon,
  CalendarXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, CardContent, CardFooter, CardHeader, Chip, Input, Label, ListBox, ProgressBar, Select } from "@heroui/react";

const categories = [
  { key: "all", label: "All Events" },
  { key: "conference", label: "Conferences" },
  { key: "workshop", label: "Workshops" },
  { key: "masterclass", label: "Masterclasses" },
  { key: "competition", label: "Competitions" },
  { key: "bootcamp", label: "Bootcamps" },
  { key: "forum", label: "Forums" },
];

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const calculateDiscount = (original: number, discount: number) => {
  if (!Number.isFinite(original) || original <= 0) return 0;
  if (!Number.isFinite(discount) || discount < 0) return 0;
  return Math.max(0, Math.round(((original - discount) / original) * 100));
};

/** Spots remaining, never negative for overbooked legacy rows. */
const spotsLeft = (event: { capacity?: number | null; registered?: number | null }) => {
  if (!event.capacity || event.capacity <= 0) return null;
  return Math.max(0, event.capacity - (event.registered ?? 0));
};

/** Fill percentage clamped to a real 0–100 range. */
const registrationProgress = (event: { capacity?: number | null; registered?: number | null }) => {
  if (!event.capacity || event.capacity <= 0) return 0;
  return Math.min(100, Math.max(0, ((event.registered ?? 0) / event.capacity) * 100));
};

export default function EventsPage() {
  const { user } = useAuth();
  const { hasCapability } = usePermissions();
  const router = useRouter();
  const canProposeEvents = hasCapability("events.create");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [savedEvents, setSavedEvents] = useState<string[]>([]);
  // Server-owned registration state: event id -> registration status, so
  // waitlisted and pending rows are never mislabelled as "Registered".
  const [registrationStatus, setRegistrationStatus] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [registering, setRegistering] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    try {
      setLoadError(null);
      const response = await fetch("/api/events", { credentials: "include" });
      const payload = (await response.json()) as { events?: EventType[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to load events");
      setEvents(payload.events ?? []);
    } catch (error) {
      console.error("Error loading events:", error);
      setEvents([]);
      setLoadError(getErrorMessage(error) || "Unable to load events");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSavedEvents = useCallback(() => {
    try {
      const saved = localStorage.getItem("savedEvents");
      if (saved) setSavedEvents(JSON.parse(saved));
    } catch {
      localStorage.removeItem("savedEvents");
      setSavedEvents([]);
    }
  }, []);

  /**
   * Registration state is server-owned.
   *
   * It used to be mirrored into `localStorage`, which meant the list could show
   * a stale or entirely fabricated registration: the array was user-editable and
   * had no relationship to the registration rows the door actually checks.
   */
  const loadRegistrations = useCallback(async () => {
    if (!user) {
      setRegistrationStatus({});
      return;
    }
    try {
      const response = await fetch("/api/events/register", { cache: "no-store", credentials: "include" });
      if (!response.ok) return;
      const data = await response.json() as { registrations?: Array<{ eventId: string; status?: string }> };
      const next: Record<string, string> = {};
      for (const registration of data.registrations ?? []) {
        if (registration.eventId) next[registration.eventId] = registration.status || "approved";
      }
      setRegistrationStatus(next);
    } catch (error) {
      console.error("Error loading registrations:", error);
    }
  }, [user]);

  useEffect(() => {
    loadEvents();
    loadSavedEvents();
    loadRegistrations();
  }, [loadEvents, loadSavedEvents, loadRegistrations]);

  const filteredEvents = useMemo(() => events
    .filter(event =>
      selectedCategory === "all" || event.category === selectedCategory
    )
    .filter(event =>
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (event.tags || []).some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "date":
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case "price":
          return (a.discountPrice || a.price) - (b.discountPrice || b.price);
        case "popularity":
          return b.registered - a.registered;
        default:
          return 0;
      }
    }), [events, selectedCategory, searchQuery, sortBy]);

  // Card actions are siblings of the details link (never nested inside it):
  // HeroUI press events do not carry a working stopPropagation, so a button
  // inside a clickable card would both act and navigate.
  const toggleSaveEvent = useCallback((eventId: string) => {
    setSavedEvents(prev => {
      const newSaved = prev.includes(eventId)
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId];
      localStorage.setItem("savedEvents", JSON.stringify(newSaved));
      return newSaved;
    });
  }, []);

  const toggleRegisterEvent = useCallback(async (eventId: string) => {
    if (!user) {
      toast.error("Please login to register for events");
      router.push("/login");
      return;
    }

    const currentStatus = registrationStatus[eventId];
    const isRegistered = Boolean(currentStatus);
    if (isRegistered && !confirm("Are you sure you want to cancel your registration for this event?")) return;

    setRegistering(eventId);
    try {
      if (isRegistered) {
        const response = await fetch(`/api/events/register?eventId=${encodeURIComponent(eventId)}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId }),
        });
        const data = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) throw new Error(data.error || "Unable to cancel this registration");
        setRegistrationStatus(prev => {
          const next = { ...prev };
          delete next[eventId];
          return next;
        });
        toast.success("Registration cancelled");
      } else {
        const event = events.find(e => e.$id === eventId);
        if (!event) throw new Error("Event not found");

        const response = await fetch("/api/events/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId }),
        });
        const data = await response.json().catch(() => ({})) as {
          error?: string;
          status?: "approved" | "pending" | "waitlisted";
          ticket?: { ticketCode?: string } | null;
        };
        if (!response.ok) throw new Error(data.error || "Unable to register for this event");

        setRegistrationStatus(prev => ({ ...prev, [eventId]: data.status || "approved" }));

        if (data.status === "waitlisted") {
          toast.warning("Added to the waitlist", {
            description: `${event.title} is at capacity. We will contact you if a place opens up.`,
          });
        } else if (data.status === "pending") {
          toast.info("Registration submitted for approval", { description: event.title });
        } else {
          toast.success(`Registered for ${event.title}`, {
            description: data.ticket?.ticketCode
              ? `Your ticket code is ${data.ticket.ticketCode}. Find it under “My Tickets”.`
              : undefined,
          });
        }
      }

      await loadEvents();
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Registration error:", message);
      toast.error(message);
    } finally {
      setRegistering(null);
    }
  }, [user, router, registrationStatus, events, loadEvents]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-default-500">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      {/* Hero Section */}
      <div className="mx-auto max-w-xl space-y-3 px-4 py-12 text-center sm:py-16">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Events
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
            Workshops, meetups, CTFs, and competitions. Open ones say so —
            just register and show up.
          </p>
          {canProposeEvents && (
            <div className="mt-6">
              <Button variant="primary" onPress={() => router.push("/admin/events/create")}>
                Propose an event
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Filters and Search */}
      <div className="max-w-7xl mx-auto px-6">
        <Card variant="secondary" className="border-none shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              <div className="flex-1 w-full lg:max-w-md">
                <Input
                  placeholder="Search events, topics, or locations..."
                  aria-label="Search events, topics, or locations"
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                <Select
                  className="min-w-[150px]"
                  aria-label="Sort events"
                  value={sortBy}
                  onChange={(value) => setSortBy(String(value ?? "date"))}
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="date" textValue="Date">
                        Date
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="price" textValue="Price">
                        Price
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="popularity" textValue="Popularity">
                        Popularity
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>

                <Select
                  className="min-w-[150px]"
                  aria-label="Filter by category"
                  value={selectedCategory}
                  onChange={(value) => setSelectedCategory(String(value ?? "all"))}
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {categories.map(category => (
                        <ListBox.Item key={category.key} id={category.key} textValue={category.label}>
                          {category.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Events Grid */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {filteredEvents.map((event) => {
            const status = registrationStatus[event.$id!];
            const isRegistered = Boolean(status);
            const registerLabel =
              status === "waitlisted" ? "Waitlisted"
              : status === "pending" ? "Pending approval"
              : status ? "Registered"
              : "Register";
            const remaining = spotsLeft(event);
            return (
            <Card
              key={event.$id}
              className="border-none hover:shadow-2xl transition-all duration-300 group" variant="secondary"
            >
              <CardContent className="p-0 overflow-hidden">
                <div className="relative">
                  <Link href={`/events/${event.$id}`} aria-label={`View details for ${event.title}`}>
                    <img
                      src={event.image}
                      alt={event.title}
                      className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </Link>

                  <div className="absolute top-4 left-4 flex flex-col gap-2">
                    {event.isFeatured && (
                      <Chip color="accent" variant="primary" size="sm" className="font-bold">
                        <StarIcon className="w-3 h-3 mr-1" />
                        Featured
                      </Chip>
                    )}
                    {event.isPremium && (
                      <Chip color="warning" variant="primary" size="sm" className="font-bold">
                        <CrownIcon className="w-3 h-3 mr-1" />
                        Premium
                      </Chip>
                    )}
                  </div>

                  <Button
                    isIconOnly
                    variant="primary"
                    className="absolute top-4 right-4 bg-white/90 dark:bg-black/90 backdrop-blur-sm"
                    size="sm"
                    aria-label={savedEvents.includes(event.$id!) ? "Unsave event" : "Save event"}
                    onPress={() => toggleSaveEvent(event.$id!)}
                  >
                    <HeartIcon 
                      className={`w-4 h-4 ${
                        savedEvents.includes(event.$id!) 
                          ? "fill-red-500 text-red-500" 
                          : "text-gray-600"
                      }`} 
                    />
                  </Button>

                  {event.discountPrice && event.discountPrice < event.price && calculateDiscount(event.price, event.discountPrice) > 0 && (
                    <div className="absolute bottom-4 left-4">
                      <Chip color="success" variant="primary" size="sm">
                        {calculateDiscount(event.price, event.discountPrice)}% OFF
                      </Chip>
                    </div>
                  )}
                </div>

                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <h3 className="font-bold text-xl line-clamp-2 group-hover:text-primary transition-colors">
                      <Link href={`/events/${event.$id}`} className="hover:text-primary">
                        {event.title}
                      </Link>
                    </h3>
                  </div>

                  <p className="text-default-600 line-clamp-2">
                    {event.description}
                  </p>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-default-500">
                      <CalendarIcon className="w-4 h-4" />
                      <span>{formatDate(event.date)}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-default-500">
                      <MapPinIcon className="w-4 h-4" />
                      <span>{event.location}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-default-500">
                      <UsersIcon className="w-4 h-4" />
                      <span>{event.registered} registered</span>
                      {remaining !== null && (
                        <span className="text-xs text-default-400">
                          • {remaining} {remaining === 1 ? "spot" : "spots"} left
                        </span>
                      )}
                    </div>
                  </div>

                  {event.capacity ? (
                    <ProgressBar
                      value={registrationProgress(event)}
                      size="sm"
                      className="mt-2"
                      aria-label="Registration progress"
                    >
                      <ProgressBar.Track>
                        <ProgressBar.Fill />
                      </ProgressBar.Track>
                    </ProgressBar>
                  ) : null}

                  <div className="flex flex-wrap gap-2 pt-2">
                    {(event.tags || []).slice(0, 3).map((tag, index) => (
                      <Chip key={index} size="sm" variant="primary">
                        {tag}
                      </Chip>
                    ))}
                    {(event.tags || []).length > 3 && (
                      <Chip size="sm" variant="primary">
                        +{(event.tags || []).length - 3}
                      </Chip>
                    )}
                  </div>
                </div>
              </CardContent>

              <CardFooter className="px-6 pb-6 pt-0">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    {event.discountPrice && event.discountPrice < event.price ? (
                      <>
                        <span className="text-2xl font-bold text-foreground">
                          ${event.discountPrice}
                        </span>
                        <span className="text-lg text-default-400 line-through">
                          ${event.price}
                        </span>
                      </>
                    ) : (
                      <span className="text-2xl font-bold text-foreground">
                        ${event.price}
                      </span>
                    )}
                  </div>

                  <Button
                    variant={isRegistered ? "secondary" : "primary"}
                    isPending={registering === event.$id}
                    aria-label={isRegistered ? `${registerLabel} for ${event.title} (activate to cancel)` : `Register for ${event.title}`}
                    onPress={() => toggleRegisterEvent(event.$id!)}
                  >
                    {registerLabel}
                  </Button>
                </div>
              </CardFooter>
            </Card>
            );
          })}
        </div>

        {loadError ? (
          <div className="text-center py-12">
            <TriangleAlertIcon className="w-12 h-12 mx-auto mb-4 text-warning" />
            <h3 className="text-xl font-semibold mb-2">Couldn&apos;t load events</h3>
            <p className="text-default-500 mb-4">{loadError}</p>
            <Button variant="primary" onPress={() => { setLoading(true); loadEvents(); }}>
              Try again
            </Button>
          </div>
        ) : filteredEvents.length === 0 && (
          <div className="text-center py-12">
            <CalendarXIcon className="w-12 h-12 mx-auto mb-4 text-default-300" />
            <h3 className="text-xl font-semibold mb-2">No events found</h3>
            <p className="text-default-500">
              Try adjusting your search or filter criteria
            </p>
          </div>
        )}
      </div>
    </div>
  );
}