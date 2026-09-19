// app/events/[id]/page.tsx
"use client";

import type { Event as EventType } from "@/lib/types";

import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Image from "next/image";
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
  Building,
  Tag,
  CheckCircle,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  ProgressBar,
  Separator,
} from "@heroui/react";

import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { getErrorMessage, readApiError } from "@/lib/errorHandler";
import { logError } from "@/lib/logger";

export default function EventDetailPage() {
  const { user } = useAuth();
  const { hasCapability } = usePermissions();
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;

  // Preview authority mirrors the console list gate (GET /api/admin/events
  // admits events.manage/approve/publish/update): anyone who can review the
  // pipeline may preview an unpublished event. Derived outside the effect so
  // the lookup re-runs when permissions resolve after the session — the same
  // stale-closure trap fixed on the blog detail page.
  const canPreviewEvent =
    hasCapability("events.manage") ||
    hasCapability("events.approve") ||
    hasCapability("events.publish") ||
    hasCapability("events.update");

  const [event, setEvent] = useState<EventType | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<string | null>(
    null,
  );
  const [ticketId, setTicketId] = useState<string>("");

  const isRegistered = registrationStatus !== null;

  useEffect(() => {
    loadEvent();
    checkSavedStatus();
  }, [eventId, user, canPreviewEvent]);

  // Registration state is re-checked whenever the signed-in account changes,
  // because it is owned by the server rather than by this browser.
  useEffect(() => {
    void checkRegistrationStatus();
  }, [user, eventId]);

  const loadEvent = async () => {
    try {
      setLoadError(null);
      setNotFound(false);
      const response = await fetch(
        `/api/events?eventId=${encodeURIComponent(eventId)}`,
        { credentials: "include" },
      );
      const payload = (await response.json()) as {
        event?: EventType;
        error?: string;
      };

      if (response.status === 404) {
        // The public lookup serves published/active only. An owner opening
        // their own draft — or a reviewer opening a shared pipeline link —
        // falls back to the privileged reads and matches by id, so
        // unpublished events are previewable instead of "missing".
        const preview = user ? await loadPreview() : null;

        if (preview) {
          setEvent(preview);
          setNotFound(false);

          return;
        }
        setNotFound(true);
        setEvent(null);

        return;
      }
      if (!response.ok)
        throw new Error(readApiError(payload, "Unable to load event"));
      setEvent(payload.event ?? null);
      if (!payload.event) setNotFound(true);
    } catch (error) {
      logError("Error loading event:", error);
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
   * Privileged preview for events the public lookup 404s (draft, review,
   * approved, rejected, cancelled). Owner first via scope=mine, then the
   * console list for anyone holding review authority — the blog detail
   * fallback, one pipeline over.
   */
  const loadPreview = async (): Promise<EventType | null> => {
    try {
      const mineResponse = await fetch("/api/events?scope=mine", {
        cache: "no-store",
        credentials: "include",
      });

      if (mineResponse.ok) {
        const mine = (await mineResponse.json()) as {
          events?: EventType[];
        };
        const own = (mine.events ?? []).find(
          (entry) => entry.$id === eventId,
        );

        if (own) return own;
      }
      if (!canPreviewEvent) return null;
      const consoleResponse = await fetch("/api/admin/events", {
        cache: "no-store",
        credentials: "include",
      });

      if (!consoleResponse.ok) return null;
      const consolePayload = (await consoleResponse.json()) as {
        events?: EventType[];
      };

      return (
        (consolePayload.events ?? []).find((entry) => entry.$id === eventId) ??
        null
      );
    } catch {
      return null;
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
      const response = await fetch("/api/events/register", {
        cache: "no-store",
        credentials: "include",
      });

      if (!response.ok) return;
      const data = (await response.json()) as {
        registrations?: Array<{ eventId: string; status?: string }>;
        tickets?: Array<{ eventId: string; ticketCode: string }>;
      };
      const mine = (data.registrations ?? []).find(
        (registration) => registration.eventId === eventId,
      );

      setRegistrationStatus(mine ? mine.status || "approved" : null);
      setTicketId(
        (data.tickets ?? []).find((ticket) => ticket.eventId === eventId)
          ?.ticketCode ?? "",
      );
    } catch (error) {
      logError("Error loading registration state:", error);
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
      const confirmed = window.confirm(
        "Are you sure you want to cancel your registration for this event?",
      );

      if (!confirmed) return;

      setRegistering(true);
      try {
        const response = await fetch(
          `/api/events/register?eventId=${encodeURIComponent(eventId)}`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId }),
          },
        );
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };

        if (!response.ok)
          throw new Error(
            readApiError(data, "Unable to cancel this registration"),
          );
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
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        status?: "approved" | "pending" | "waitlisted";
        ticket?: { ticketCode?: string } | null;
      };

      if (!response.ok)
        throw new Error(
          readApiError(data, "Unable to register for this event"),
        );

      setRegistrationStatus(data.status || "approved");
      setTicketId(data.ticket?.ticketCode ?? "");

      if (data.status === "waitlisted") {
        toast.warning("Added to the waitlist", {
          description:
            "This event is at capacity. We will contact you if a place opens up.",
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

      logError("Registration error:", message);
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

    return new Date(time).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
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

    return Math.min(
      100,
      Math.max(0, ((event.registered ?? 0) / event.capacity) * 100),
    );
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
            <Image
              alt=""
              aria-hidden="true"
              className="mx-auto h-28 w-28 rounded-3xl border border-default-200/70 object-cover"
              height={224}
              loading="lazy"
              src="/Assets/Media/walking-confused.gif"
              width={224}
            />
          ) : (
            <Image
              alt=""
              aria-hidden="true"
              className="mx-auto h-24 w-24 rounded-3xl border border-default-200/70 object-cover"
              height={192}
              loading="lazy"
              src="/Assets/Media/try-again.webp"
              width={192}
            />
          )}
          <h2 className="text-2xl font-bold">
            {missing ? "Nothing on this trail" : "Couldn't load this event"}
          </h2>
          <p className="text-default-500">
            {missing
              ? "This event doesn't exist, its link is outdated, or it isn't shared with you."
              : loadError}
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            {!missing && (
              <Button
                variant="primary"
                onPress={() => {
                  setLoading(true);
                  loadEvent();
                }}
              >
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

  // Anything outside published/active arrived via the owner/reviewer preview
  // above: readable, not joinable.
  const isPreview = !["published", "active"].includes(String(event.status));

  return (
    <div className="pb-20">
      {/* Top row: back + actions */}
      <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between gap-3">
        <Button variant="ghost" onPress={() => router.push("/events")}>
          Back to Events
        </Button>
        <div className="flex gap-2">
          <Button
            isIconOnly
            aria-label={isSaved ? "Unsave event" : "Save event"}
            variant="secondary"
            onPress={toggleSave}
          >
            <Heart
              className={`w-5 h-5 ${isSaved ? "fill-danger text-danger" : ""}`}
            />
          </Button>
          <Button
            isIconOnly
            aria-label="Share event"
            variant="secondary"
            onPress={handleShare}
          >
            <Share className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Header — no cover art: titles carry the page, images stay optional */}
      <div className="max-w-7xl mx-auto px-6 pb-2">
        {isPreview && (
          <p
            className="mb-4 rounded-2xl border border-default-200/70 bg-surface-secondary px-4 py-3 text-sm text-muted"
            role="status"
          >
            {event.status === "draft" || event.status === "review"
              ? "Preview — this event isn't published yet, so only the organizer and reviewers can see it. Registration opens on publish."
              : `Status: ${event.status} — visible to the organizer and reviewers, not open for registration.`}
          </p>
        )}
        <div className="flex flex-wrap gap-2 mb-4">
          {event.isFeatured && (
            <Chip
              className="font-bold"
              color="accent"
              size="sm"
              variant="primary"
            >
              <Star className="w-3 h-3 mr-1" />
              Featured
            </Chip>
          )}
          {event.isPremium && (
            <Chip
              className="font-bold"
              color="warning"
              size="sm"
              variant="primary"
            >
              <Crown className="w-3 h-3 mr-1" />
              Premium
            </Chip>
          )}
          <Chip size="sm">{event.category}</Chip>
        </div>

        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
          {event.title}
        </h1>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-muted">
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
                        className="font-medium"
                        size="lg"
                        variant="primary"
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
                  <Avatar className="w-16 h-16">
                    <AvatarImage
                      alt={event.organizerName}
                      src={event.organizerAvatar}
                    />
                    <AvatarFallback>
                      {event.organizerName?.charAt(0) || "O"}
                    </AvatarFallback>
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
                    ) : event.discountPrice &&
                      event.discountPrice < event.price ? (
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
                  {event.discountPrice &&
                    event.discountPrice < event.price &&
                    calculateDiscount(event.price, event.discountPrice) > 0 && (
                      <Chip color="success" size="lg" variant="soft">
                        Save ${event.price - event.discountPrice} (
                        {calculateDiscount(event.price, event.discountPrice)}%
                        OFF)
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
                      {event.registered ?? 0}
                      {event.capacity && `/${event.capacity}`}
                    </span>
                  </div>

                  {event.capacity && (
                    <>
                      <ProgressBar
                        aria-label="Registration progress"
                        className="mt-2"
                        color={
                          getRegistrationPercentage() > 90
                            ? "danger"
                            : getRegistrationPercentage() > 70
                              ? "warning"
                              : "accent"
                        }
                        size="md"
                        value={getRegistrationPercentage()}
                      >
                        <ProgressBar.Track>
                          <ProgressBar.Fill />
                        </ProgressBar.Track>
                      </ProgressBar>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-default-500">
                          {getSpotsLeft()} spots remaining
                        </span>
                        <span
                          className={`font-semibold ${
                            getRegistrationPercentage() > 90
                              ? "text-danger"
                              : getRegistrationPercentage() > 70
                                ? "text-warning"
                                : "text-success"
                          }`}
                        >
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
                      isDisabled
                      aria-label={`${event.title} has ended`}
                      className="w-full font-bold text-lg"
                      variant="secondary"
                    >
                      Event ended
                    </Button>
                  ) : isPreview ? (
                    <Button
                      isDisabled
                      aria-label={`${event.title} is not open for registration`}
                      className="w-full font-bold text-lg"
                      variant="secondary"
                    >
                      Not open for registration
                    </Button>
                  ) : (
                    <Button
                      className="w-full font-bold text-lg"
                      isPending={registering}
                      variant={isRegistered ? "secondary" : "primary"}
                      onPress={handleRegister}
                    >
                      {registering
                        ? "Registering..."
                        : registrationStatus === "waitlisted"
                          ? "You're on the Waitlist"
                          : registrationStatus === "pending"
                            ? "Pending Approval"
                            : isRegistered
                              ? "You're Registered!"
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
                                className="text-xs text-success-700 dark:text-success-300 mt-1 inline-block underline underline-offset-2"
                                href={`/events/${eventId}/tickets`}
                              >
                                View and download your ticket
                              </Link>
                            </>
                          ) : (
                            <p className="text-xs text-success-700 dark:text-success-300 mt-1">
                              Your place is reserved. A ticket will be issued
                              once the organiser confirms your registration.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {isRegistered && registrationStatus === "waitlisted" && (
                    <div className="p-4 bg-warning-50 dark:bg-warning-900/20 rounded-xl border border-warning-200 dark:border-warning-800">
                      <p className="text-sm text-warning-700 dark:text-warning-300">
                        <span className="font-semibold">
                          You&apos;re on the waitlist.
                        </span>{" "}
                        We&apos;ll notify you if a place opens up.
                      </p>
                    </div>
                  )}

                  {isRegistered && registrationStatus === "pending" && (
                    <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
                      <p className="text-sm text-default-600">
                        <span className="font-semibold">
                          Awaiting approval.
                        </span>{" "}
                        The organiser reviews exclusive-event registrations
                        before issuing tickets.
                      </p>
                    </div>
                  )}

                  {!isRegistered &&
                    getSpotsLeft() !== null &&
                    getSpotsLeft()! < 10 && (
                      <div className="p-4 bg-warning-50 dark:bg-warning-900/20 rounded-xl border border-warning-200 dark:border-warning-800">
                        <div className="flex items-start gap-2">
                          <TrendingUp className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-warning-700 dark:text-warning-300">
                            <span className="font-semibold">Filling fast!</span>{" "}
                            Only {getSpotsLeft()} spots left
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
