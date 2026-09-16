// app/events/page.tsx
"use client";

import { title, subtitle } from "@/components/primitives";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import type { Event as EventType } from "@/lib/types";
import { getErrorMessage } from "@/lib/errorHandler";
import {
  CalendarIcon,
  MapPinIcon,
  UsersIcon,
  HeartIcon,
  SparklesIcon,
  StarIcon,
  CrownIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, Badge, Button, Card, CardContent, CardFooter, CardHeader, Chip, Input, ProgressBar, Select, ListBoxItem} from "@heroui/react";

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
  return Math.round(((original - discount) / original) * 100);
};

export default function EventsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [savedEvents, setSavedEvents] = useState<string[]>([]);
  const [registeredEvents, setRegisteredEvents] = useState<string[]>([]);
  const [events, setEvents] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    try {
      const response = await fetch("/api/events", { credentials: "include" });
      const payload = (await response.json()) as { events?: EventType[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to load events");
      setEvents(payload.events ?? []);
    } catch (error) {
      console.error("Error loading events:", error);
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
      setRegisteredEvents([]);
      return;
    }
    try {
      const response = await fetch("/api/events/register", { cache: "no-store", credentials: "include" });
      if (!response.ok) return;
      const data = await response.json() as { registrations?: Array<{ eventId: string }> };
      setRegisteredEvents((data.registrations ?? []).map((registration) => registration.eventId));
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

  const toggleSaveEvent = useCallback((e: React.MouseEvent, eventId: string) => {
    e.stopPropagation();
    setSavedEvents(prev => {
      const newSaved = prev.includes(eventId)
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId];
      localStorage.setItem("savedEvents", JSON.stringify(newSaved));
      return newSaved;
    });
  }, []);

  const toggleRegisterEvent = useCallback(async (e: React.MouseEvent, eventId: string) => {
    e.stopPropagation();
    
    if (!user) {
      toast.error("Please login to register for events");
      router.push("/login");
      return;
    }

    const isRegistered = registeredEvents.includes(eventId);
    if (isRegistered && !confirm("Are you sure you want to cancel your registration for this event?")) return;

    setRegistering(eventId);
    try {
      if (isRegistered) {
        const response = await fetch("/api/events/register", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId }),
        });
        const data = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) throw new Error(data.error || "Unable to cancel this registration");
        setRegisteredEvents(prev => prev.filter(id => id !== eventId));
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

        setRegisteredEvents(prev => [...prev, eventId]);

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
  }, [user, router, registeredEvents, events, loadEvents]);

  const handleEventClick = useCallback((eventId: string) => {
    router.push(`/events/${eventId}`);
  }, [router]);

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
      <div className="text-center space-y-6 relative py-12">
        <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-muted border border-border mb-6">
          <SparklesIcon className="w-5 h-5 text-primary" />
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Upcoming Events
          </span>
        </div>
        <div className="relative z-10">
          <h1 className={title({ size: "lg" })}>
            Discover{" "}
            <span className={title({ color: "violet", size: "lg" })}>
              Amazing Events
            </span>
          </h1>
          <p className={subtitle({ class: "mt-6 max-w-3xl mx-auto text-xl" })}>
            Join our community events, workshops, and conferences to learn, network, and grow together
          </p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="max-w-7xl mx-auto px-6">
        <Card className="border-none shadow-lg bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              <div className="flex-1 w-full lg:max-w-md">
                <Input
                  placeholder="Search events, topics, or locations..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="min-w-[150px] px-3 py-2 rounded-lg border border-default-300 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                >
                  <option value="date">Date</option>
                  <option value="price">Price</option>
                  <option value="popularity">Popularity</option>
                </select>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="min-w-[150px] px-3 py-2 rounded-lg border border-default-300 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                >
                  {categories.map(category => (
                    <option key={category.key} value={category.key}>{category.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Events Grid */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {filteredEvents.map((event) => (
            <Card
              key={event.$id}
              className="border-none hover:shadow-2xl transition-all duration-300 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl group cursor-pointer"
              onClick={() => handleEventClick(event.$id!)}
              
              
            >
              <CardContent className="p-0 overflow-hidden">
                <div className="relative">
                  <img
                    src={event.image}
                    alt={event.title}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                  />

                  <div className="absolute top-4 left-4 flex flex-col gap-2">
                    {event.isFeatured && (
                      <Badge variant="primary" className="font-bold">
                        <StarIcon className="w-3 h-3 mr-1" />
                        Featured
                      </Badge>
                    )}
                    {event.isPremium && (
                      <Badge variant="primary" className="font-bold">
                        <CrownIcon className="w-3 h-3 mr-1" />
                        Premium
                      </Badge>
                    )}
                  </div>

                  <Button
                    isIconOnly
                    variant="primary"
                    className="absolute top-4 right-4 bg-white/90 dark:bg-black/90 backdrop-blur-sm"
                    size="sm"
                    aria-label={savedEvents.includes(event.$id!) ? "Unsave event" : "Save event"}
                    onPress={(e: any) => toggleSaveEvent(e, event.$id!)}
                  >
                    <HeartIcon 
                      className={`w-4 h-4 ${
                        savedEvents.includes(event.$id!) 
                          ? "fill-red-500 text-red-500" 
                          : "text-gray-600"
                      }`} 
                    />
                  </Button>

                  {event.discountPrice && event.discountPrice < event.price && (
                    <div className="absolute bottom-4 left-4">
                      <Badge variant="primary">
                        {calculateDiscount(event.price, event.discountPrice)}% OFF
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <h3 className="font-bold text-xl line-clamp-2 group-hover:text-primary transition-colors">
                      {event.title}
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
                      {event.capacity && (
                        <span className="text-xs text-default-400">
                          • {event.capacity - event.registered} spots left
                        </span>
                      )}
                    </div>
                  </div>

                  {event.capacity && (
                    <ProgressBar 
                      value={(event.registered / event.capacity) * 100} 
                      size="sm" 
                      className="mt-2"
                    />
                  )}

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
                    variant={registeredEvents.includes(event.$id!) ? "secondary" : "primary"}
                    isPending={registering === event.$id}
                    aria-label={registeredEvents.includes(event.$id!) ? "Cancel registration" : `Register for ${event.title}`}
                    onPress={(e: any) => toggleRegisterEvent(e, event.$id!)}
                  >
                    {registeredEvents.includes(event.$id!) ? "Registered" : "Register"}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>

        {filteredEvents.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎯</div>
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