// app/events/[id]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import type { Event as EventType } from "@/lib/types";
import {getErrorMessage, readApiError} from "@/lib/errorHandler";
import Link from "next/link";
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  Star,
  Heart,
  Share,
  Ticket,
  Crown,
  ArrowLeft,
  Building,
  Tag,
  CheckCircle,
  TrendingUp
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarImage, AvatarFallback, Button, Card, CardContent, CardHeader, Chip, ProgressBar, Separator } from "@heroui/react";

export default function EventDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<EventType | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<string | null>(null);
  const [ticketId, setTicketId] = useState<string>("");

  const isRegistered = registrationStatus !== null;

  useEffect(() => {
    loadEvent();
    checkSavedStatus();
  }, [eventId]);

  // Registration state is re-checked whenever the signed-in account changes,
  // because it is owned by the server rather than by this browser.
  useEffect(() => {
    void checkRegistrationStatus();
  }, [user, eventId]);

  const loadEvent = async () => {
    try {
      setLoadError(null);
      setNotFound(false);
      const response = await fetch(`/api/events?eventId=${encodeURIComponent(eventId)}`, { credentials: "include" });
      const payload = (await response.json()) as { event?: EventType; error?: string };
      if (response.status === 404) {
        setNotFound(true);
        setEvent(null);
        return;
      }
      if (!response.ok) throw new Error(readApiError(payload, "Unable to load event"));
      setEvent(payload.event ?? null);
      if (!payload.event) setNotFound(true);
    } catch (error) {
      console.error("Error loading event:", error);
      setLoadError(getErrorMessage(error) || "Unable to load event");
    } finally {
      setLoading(false);
    }
  };

  const checkSavedStatus = () => {
    try {
      const saved = localStorage.getItem("savedEvents");
      if (saved) {
        const savedEvents = JSON.parse(saved);
        setIsSaved(savedEvents.includes(eventId));
      }
    } catch {
      localStorage.removeItem("savedEvents");
      setIsSaved(false);
    }
  };

  /**
   * Read registration and ticket state from the server.
   *
   * This previously read a `registeredEvents` array and a `ticket_<eventId>`
   * record out of `localStorage`. Both were entirely client-owned, so the page
   * could claim a registration that did not exist, and the "ticket" it displayed
   * held a locally generated ID that the door scanner would never recognise.
   */
  const checkRegistrationStatus = async () => {
    if (!user) {
      setRegistrationStatus(null);
      setTicketId("");
      return;
    }
    try {
      const response = await fetch("/api/events/register", { cache: "no-store", credentials: "include" });
      if (!response.ok) return;
      const data = await response.json() as {
        registrations?: Array<{ eventId: string; status?: string }>;
        tickets?: Array<{ eventId: string; ticketCode: string }>;
      };
      const mine = (data.registrations ?? []).find((registration) => registration.eventId === eventId);
      setRegistrationStatus(mine ? mine.status || "approved" : null);
      setTicketId((data.tickets ?? []).find((ticket) => ticket.eventId === eventId)?.ticketCode ?? "");
    } catch (error) {
      console.error("Error loading registration state:", error);
    }
  };

  const toggleSave = () => {
    try {
      const saved = localStorage.getItem("savedEvents");
      const savedEvents = saved ? JSON.parse(saved) : [];
      
      if (isSaved) {
        const filtered = savedEvents.filter((id: string) => id !== eventId);
        localStorage.setItem("savedEvents", JSON.stringify(filtered));
        setIsSaved(false);
      } else {
        savedEvents.push(eventId);
        localStorage.setItem("savedEvents", JSON.stringify(savedEvents));
        setIsSaved(true);
      }
    } catch {
      localStorage.removeItem("savedEvents");
      setIsSaved(false);
    }
  };

  const handleRegister = async () => {
    if (!user) {
      toast.error("Please login to register for events");
      router.push("/login");
      return;
    }

    if (isRegistered) {
      const confirmed = window.confirm("Are you sure you want to cancel your registration for this event?");
      if (!confirmed) return;

      setRegistering(true);
      try {
        const response = await fetch(`/api/events/register?eventId=${encodeURIComponent(eventId)}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId }),
        });
        const data = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) throw new Error(readApiError(data, "Unable to cancel this registration"));
        setRegistrationStatus(null);
        setTicketId("");
        toast.success("Registration cancelled");
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setRegistering(false);
      }
      return;
    }

    setRegistering(true);
    try {
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
      if (!response.ok) throw new Error(readApiError(data, "Unable to register for this event"));

      setRegistrationStatus(data.status || "approved");
      setTicketId(data.ticket?.ticketCode ?? "");

      if (data.status === "waitlisted") {
        toast.warning("Added to the waitlist", {
          description: "This event is at capacity. We will contact you if a place opens up.",
        });
      } else if (data.status === "pending") {
        toast.info("Registration submitted for approval");
      } else {
        toast.success("Registration confirmed", {
          description: data.ticket?.ticketCode
            ? `Your ticket code is ${data.ticket.ticketCode}.`
            : undefined,
        });
      }

      await loadEvent();
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Registration error:", message);
      toast.error(message || "Failed to register for event");
    } finally {
      setRegistering(false);
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: event?.title,
          text: event?.description,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied to clipboard!");
      }
    } catch (error) {
      // Dismissing the share sheet rejects: not an error worth surfacing.
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied to clipboard!");
      } catch {
        toast.error("Unable to share this event");
      }
    }
  };

const formatDate = (dateString: string) => {
  if (!dateString) return "Date TBA";
  const time = new Date(dateString).getTime();
  if (!Number.isFinite(time)) return "Date TBA";
  return new Date(time).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
};

/** An event whose day has passed can be read, not joined. */
const isPastEvent = (dateString?: string | null) => {
  if (!dateString) return false;
  const day = new Date(dateString);
  if (!Number.isFinite(day.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return day < today;
};

  const calculateDiscount = (original: number, discount: number) => {
    if (!Number.isFinite(original) || original <= 0) return 0;
    if (!Number.isFinite(discount) || discount < 0) return 0;
    return Math.max(0, Math.round(((original - discount) / original) * 100));
  };

  const getSpotsLeft = () => {
    if (!event?.capacity || event.capacity <= 0) return null;
    return Math.max(0, event.capacity - (event.registered ?? 0));
  };

  const getRegistrationPercentage = () => {
    if (!event?.capacity || event.capacity <= 0) return 0;
    return Math.min(100, Math.max(0, ((event.registered ?? 0) / event.capacity) * 100));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-default-500">Loading event details...</p>
        </div>
      </div>
    );
  }

  // A failed load with no cached event is an error, not a 404: only the
  // explicit notFound flag (or an empty success) means "does not exist".
  if ((loadError && !event) || (!event && !loading) || notFound) {
    const missing = !loadError && (notFound || !event);
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="mx-auto max-w-sm space-y-3 py-12 text-center">
          {missing ? (
            <img
              src="/Assets/Media/walking-confused.gif"
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="mx-auto h-28 w-28 rounded-3xl border border-default-200/70 object-cover"
            />
          ) : (
            <img
              src="/Assets/Media/try-again.webp"
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="mx-auto h-24 w-24 rounded-3xl border border-default-200/70 object-cover"
            />
          )}
          <h2 className="text-2xl font-bold">
            {missing ? "Nothing on this trail" : "Couldn't load this event"}
          </h2>
          <p className="text-default-500">
            {missing
              ? "This event doesn't exist, or its link is outdated."
              : loadError}
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            {!missing && (
              <Button variant="primary" onPress={() => { setLoading(true); loadEvent(); }}>
                Try again
              </Button>
            )}
            <Button variant="ghost" onPress={() => router.push("/events")}>
              Browse Events
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Back Button */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <Button
          variant="ghost"
          onPress={() => router.push("/events")}
        >
          Back to Events
        </Button>
      </div>

      {/* Hero Image Section */}
      <div className="relative h-[400px] md:h-[500px] w-full overflow-hidden bg-surface-secondary">
        {event.image ? (
          <img
            src={event.image}
            alt={event.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        
        {/* Floating Action Buttons */}
        <div className="absolute top-6 right-6 flex gap-2">
          <Button
            isIconOnly
            variant="primary"
            className="bg-white/90 dark:bg-black/90 backdrop-blur-sm"
            aria-label={isSaved ? "Unsave event" : "Save event"}
            onPress={toggleSave}
          >
            <Heart 
              className={`w-5 h-5 ${
                isSaved ? "fill-danger text-danger" : "text-gray-600"
              }`} 
            />
          </Button>
          <Button
            isIconOnly
            variant="primary"
            className="bg-white/90 dark:bg-black/90 backdrop-blur-sm"
            aria-label="Share event"
            onPress={handleShare}
          >
            <Share className="w-5 h-5" />
          </Button>
        </div>

        {/* Hero Content */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-wrap gap-2 mb-4">
              {event.isFeatured && (
                <Chip color="accent" variant="primary" size="sm" className="font-bold">
                  <Star className="w-3 h-3 mr-1" />
                  Featured
                </Chip>
              )}
              {event.isPremium && (
                <Chip color="warning" variant="primary" size="sm" className="font-bold">
                  <Crown className="w-3 h-3 mr-1" />
                  Premium
                </Chip>
              )}
              <Chip size="sm">{event.category}</Chip>
            </div>
            
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">
              {event.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-6 text-white/90">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <span className="font-medium">{formatDate(event.date)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <span className="font-medium">{event.time}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                <span className="font-medium">{event.location}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Event Details */}
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            <Card className="border-none shadow-lg">
              <CardHeader className="pb-0">
                <h2 className="text-2xl font-bold">About This Event</h2>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-default-600 leading-relaxed text-lg">
                  {event.description}
                </p>
              </CardContent>
            </Card>

            {/* Event Details Grid */}
            <Card className="border-none shadow-lg">
              <CardHeader className="pb-0">
                <h2 className="text-2xl font-bold">Event Details</h2>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-surface-tertiary flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-default-500 mb-1">Date</p>
                      <p className="font-semibold">{formatDate(event.date)}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-surface-tertiary flex items-center justify-center flex-shrink-0">
                      <Clock className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-default-500 mb-1">Time</p>
                      <p className="font-semibold">{event.time}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-surface-tertiary flex items-center justify-center flex-shrink-0">
                      <Building className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-default-500 mb-1">Venue</p>
                      <p className="font-semibold">{event.venue}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-surface-tertiary flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-default-500 mb-1">Location</p>
                      <p className="font-semibold">{event.location}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tags */}
            {event.tags && event.tags.length > 0 && (
              <Card className="border-none shadow-lg">
                <CardHeader className="pb-0">
                  <div className="flex items-center gap-2">
                    <Tag className="w-5 h-5 text-primary" />
                    <h2 className="text-2xl font-bold">Topics</h2>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="flex flex-wrap gap-2">
                    {(event.tags || []).map((tag, index) => (
                      <Chip 
                        key={index} 
                        size="lg" 
                        variant="primary"
                        className="font-medium"
                      >
                        {tag}
                      </Chip>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Organizer */}
            <Card className="border-none shadow-lg">
              <CardHeader className="pb-0">
                <h2 className="text-2xl font-bold">Organized By</h2>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex items-center gap-4">
                  <Avatar
                    className="w-16 h-16"
                  >
                    <AvatarImage src={event.organizerAvatar} alt={event.organizerName} />
                    <AvatarFallback>{event.organizerName?.charAt(0) || 'O'}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold text-lg">{event.organizerName}</p>
                    <p className="text-default-500">Event Organizer</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Registration Card */}
          <div className="lg:col-span-1">
            <Card className="border-none shadow-2xl sticky top-28 bg-card">
              <CardContent className="p-6 space-y-6">
                {/* Price */}
                <div>
                  <div className="flex items-baseline gap-3 mb-2">
                    {event.price === 0 ? (
                      <span className="text-4xl font-bold text-foreground">
                        Free
                      </span>
                    ) : event.discountPrice && event.discountPrice < event.price ? (
                      <>
                        <span className="text-4xl font-bold text-foreground">
                          ${event.discountPrice}
                        </span>
                        <span className="text-2xl text-default-400 line-through">
                          ${event.price}
                        </span>
                      </>
                    ) : (
                      <span className="text-4xl font-bold text-foreground">
                        ${event.price}
                      </span>
                    )}
                  </div>
                  {event.discountPrice && event.discountPrice < event.price && calculateDiscount(event.price, event.discountPrice) > 0 && (
                    <Chip color="success" variant="soft" size="lg">
                      Save ${event.price - event.discountPrice} ({calculateDiscount(event.price, event.discountPrice)}% OFF)
                    </Chip>
                  )}
                </div>

                <Separator />

                {/* Registration Stats */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-default-500" />
                      <span className="text-default-600">Registered</span>
                    </div>
                    <span className="font-bold text-lg">
                      {event.registered ?? 0}{event.capacity && `/${event.capacity}`}
                    </span>
                  </div>

                  {event.capacity && (
                    <>
                      <ProgressBar
                        value={getRegistrationPercentage()}
                        size="md"
                        color={
                          getRegistrationPercentage() > 90 ? "danger" :
                          getRegistrationPercentage() > 70 ? "warning" : "accent"
                        }
                        className="mt-2"
                        aria-label="Registration progress"
                      >
                        <ProgressBar.Track>
                          <ProgressBar.Fill />
                        </ProgressBar.Track>
                      </ProgressBar>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-default-500">
                          {getSpotsLeft()} spots remaining
                        </span>
                        <span className={`font-semibold ${
                          getRegistrationPercentage() > 90 ? "text-danger" : 
                          getRegistrationPercentage() > 70 ? "text-warning" : "text-success"
                        }`}>
                          {Math.round(getRegistrationPercentage())}% filled
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <Separator />

                {/* Registration Button */}
                <div className="space-y-3">
                  {isPastEvent(event.date) ? (
                    <Button
                      variant="secondary"
                      className="w-full font-bold text-lg"
                      isDisabled
                      aria-label={`${event.title} has ended`}
                    >
                      Event ended
                    </Button>
                  ) : (
                    <Button
                      onPress={handleRegister}
                      variant={isRegistered ? "secondary" : "primary"}
                      className="w-full font-bold text-lg"
                      isPending={registering}
                    >
                      {registering ? "Registering..."
                        : registrationStatus === "waitlisted" ? "You're on the Waitlist"
                        : registrationStatus === "pending" ? "Pending Approval"
                        : isRegistered ? "You're Registered!"
                        : "Register Now"}
                    </Button>
                  )}

                  {isRegistered && registrationStatus === "approved" && (
                    <div className="p-4 bg-success-50 dark:bg-success-900/20 rounded-xl border border-success-200 dark:border-success-800">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-semibold text-success text-sm">
                            Registration Confirmed!
                          </p>
                          {ticketId ? (
                            <>
                              <p className="text-xs text-success-700 dark:text-success-300 mt-1">
                                <Ticket className="w-3 h-3 inline mr-1" />
                                Your ticket code
                              </p>
                              <p className="text-xs text-success-700 dark:text-success-300 mt-1 font-mono bg-success-100 dark:bg-success-900/30 p-2 rounded">
                                {ticketId}
                              </p>
                              <Link
                                href={`/events/${eventId}/tickets`}
                                className="text-xs text-success-700 dark:text-success-300 mt-1 inline-block underline underline-offset-2"
                              >
                                View and download your ticket
                              </Link>
                            </>
                          ) : (
                            <p className="text-xs text-success-700 dark:text-success-300 mt-1">
                              Your place is reserved. A ticket will be issued once the organiser confirms your registration.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {isRegistered && registrationStatus === "waitlisted" && (
                    <div className="p-4 bg-warning-50 dark:bg-warning-900/20 rounded-xl border border-warning-200 dark:border-warning-800">
                      <p className="text-sm text-warning-700 dark:text-warning-300">
                        <span className="font-semibold">You&apos;re on the waitlist.</span> We&apos;ll notify you if a place opens up.
                      </p>
                    </div>
                  )}

                  {isRegistered && registrationStatus === "pending" && (
                    <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
                      <p className="text-sm text-default-600">
                        <span className="font-semibold">Awaiting approval.</span> The organiser reviews exclusive-event registrations before issuing tickets.
                      </p>
                    </div>
                  )}

                  {!isRegistered && getSpotsLeft() !== null && getSpotsLeft()! < 10 && (
                    <div className="p-4 bg-warning-50 dark:bg-warning-900/20 rounded-xl border border-warning-200 dark:border-warning-800">
                      <div className="flex items-start gap-2">
                        <TrendingUp className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-warning-700 dark:text-warning-300">
                          <span className="font-semibold">Filling fast!</span> Only {getSpotsLeft()} spots left
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}