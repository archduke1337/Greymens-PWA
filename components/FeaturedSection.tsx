"use client";
import type { Event } from "@/lib/database";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  MapPin,
  Users,
  Star,
  Crown,
  ArrowRight,
  Sparkles,
} from "lucide-react";

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function FeaturedSection() {
  const [featuredEvents, setFeaturedEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        // Server-owned read: /api/events returns only published/active/approved.
        const res = await fetch("/api/events", { cache: "no-store" });

        if (!res.ok) throw new Error("Unable to load events");
        const data = (await res.json()) as { events?: Event[] };
        const featured = (data.events ?? [])
          .filter(
            (e) =>
              (e as Event & { isFeatured?: boolean }).isFeatured &&
              (e as Event & { status?: string }).status !== "draft",
          )
          .slice(0, 6);

        if (!cancelled) setFeaturedEvents(featured);
      } catch (error) {
        console.error("Error fetching featured events:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCardClick = (eventId: string) => {
    router.push(`/events/${eventId}`);
  };

  if (loading) {
    return (
      <section className="py-20 relative overflow-hidden bg-background">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center space-y-4">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent" />
            <p className="text-lg font-medium text-gray-600 dark:text-gray-400">
              Loading featured events...
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (featuredEvents.length === 0) {
    return null;
  }

  return (
    <section className="py-20 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted border border-border">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm text-foreground">
              Featured Events
            </span>
          </div>

          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            Don&apos;t Miss Out
          </h2>

          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Join our most anticipated events and be part of something
            extraordinary
          </p>
        </div>

        {/* Events Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {featuredEvents.map((event, index) => (
            <div
              key={event.$id}
              className="group cursor-pointer"
              style={{
                animation: `fadeInUp 0.6s ease-out ${index * 0.1}s both`,
              }}
              onClick={() => handleCardClick(event.$id!)}
            >
              <div className="relative bg-card rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 border border-border">
                {/* Image Section */}
                <div className="relative h-64 overflow-hidden">
                  <img
                    alt={event.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    src={event.image}
                  />

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

                  {/* Badges */}
                  <div className="absolute top-4 left-4 flex flex-col gap-2">
                    {event.isFeatured && (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium">
                        <Star className="w-3 h-3" />
                        Featured
                      </div>
                    )}
                    {event.isPremium && (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-medium">
                        <Crown className="w-3 h-3" />
                        Premium
                      </div>
                    )}
                  </div>

                  {/* Category */}
                  <div className="absolute top-4 right-4">
                    <span className="px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-semibold border border-white/30">
                      {event.category}
                    </span>
                  </div>

                  {/* Date Badge */}
                  <div className="absolute bottom-4 left-4">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/95 dark:bg-black/95 backdrop-blur-md shadow-lg">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span className="font-bold text-sm">
                        {formatDate(event.date)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-6 space-y-4">
                  {/* Title */}
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white line-clamp-2 group-hover:text-primary transition-colors">
                    {event.title}
                  </h3>

                  {/* Description */}
                  <p className="text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                    {event.description}
                  </p>

                  {/* Details */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <MapPin className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-medium">{event.location}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <Users className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-medium">
                        {event.registered} registered
                      </span>
                      {event.capacity && (
                        <span className="text-xs text-gray-500">
                          • {event.capacity - event.registered} spots left
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {(event.tags ?? []).slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-muted text-muted-foreground text-xs rounded-full font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Price & CTA */}
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div>
                      {event.discountPrice &&
                      event.discountPrice < event.price ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold text-foreground tabular-nums">
                            ${event.discountPrice}
                          </span>
                          <span className="text-sm text-muted-foreground line-through tabular-nums">
                            ${event.price}
                          </span>
                        </div>
                      ) : event.price === 0 ? (
                        <span className="text-xl font-bold text-foreground">
                          Free
                        </span>
                      ) : (
                        <span className="text-xl font-bold text-foreground tabular-nums">
                          ${event.price}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-primary font-medium">
                      <span className="text-sm">View details</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* View All Button */}
        <div className="text-center mt-16">
          <button
            className="group inline-flex items-center gap-3 px-8 py-4 bg-primary text-primary-foreground font-bold text-lg rounded-lg transition-opacity hover:opacity-90"
            onClick={() => router.push("/events")}
          >
            <span>Explore All Events</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  );
}
