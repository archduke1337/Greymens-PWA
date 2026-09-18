"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@heroui/react";
import { ArrowRight } from "lucide-react";

import { blogService } from "@/lib/blog";
import { useAuth } from "@/context/AuthContext";

/**
 * Hero primary action. Auth state resolves client-side; while it loads, a
 * same-size placeholder holds the space so the button never flashes between
 * "Join" and "Dashboard".
 */
export function HeroCta() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        aria-hidden="true"
        className="h-12 w-44 animate-pulse rounded-full bg-surface-secondary"
      />
    );
  }

  return (
    <Link href={user ? "/dashboard" : "/register"}>
      <Button size="lg" className="rounded-full px-8">
        {user ? "Go to dashboard" : "Join the club"}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </Link>
  );
}

/**
 * Live proof strip: upcoming events, tracked projects, published posts.
 *
 * Every number comes from the same read APIs the product pages use, counted
 * at render time, and each one links to the page it was counted from. Only
 * metrics above zero render — a strip of zeroes proves the opposite of what
 * it claims. While loading, a same-size skeleton holds the space so nothing
 * below jumps; if any source fails, the strip stays hidden — no proof beats
 * wrong proof.
 */
export function ProofStrip() {
  const [counts, setCounts] = useState<{
    events: number;
    projects: number;
    posts: number;
  } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [eventsRes, projectsRes, posts] = await Promise.all([
          fetch("/api/events", { cache: "no-store" }).then((res) =>
            res.ok ? res.json() : Promise.reject(new Error("events")),
          ),
          fetch("/api/projects", { cache: "no-store" }).then((res) =>
            res.ok ? res.json() : Promise.reject(new Error("projects")),
          ),
          blogService.getPublishedBlogs(),
        ]);
        if (cancelled) return;
        const now = Date.now();
        const upcoming = ((eventsRes.events ?? []) as Array<{ date?: string }>).filter(
          (event) => !event.date || new Date(event.date).getTime() >= now,
        ).length;
        setCounts({
          events: upcoming,
          projects: (projectsRes.projects ?? []).length,
          posts: posts.length,
        });
      } catch {
        // Stay hidden: no proof is better than wrong proof.
        if (!cancelled) setFailed(true);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Failed sources: render nothing. Loading: hold the strip's space with
  // a skeleton so sections below never jump when the numbers land.
  if (failed) return null;
  if (!counts) {
    return (
      <section
        aria-label="The club in numbers"
        className="mx-auto w-full max-w-5xl space-y-4 px-4 pt-14 sm:px-6"
      >
        <div
          aria-hidden="true"
          className="grid grid-cols-3 gap-4 rounded-3xl border border-default-200/70 px-6 py-6 sm:gap-8"
        >
          {[0, 1, 2].map((n) => (
            <div key={n} className="space-y-2 py-1">
              <div className="mx-auto h-9 w-16 animate-pulse rounded-full bg-surface-secondary sm:h-10" />
              <div className="mx-auto h-3 w-24 animate-pulse rounded-full bg-surface-secondary" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  const items = [
    { value: counts.events, label: "Upcoming events", href: "/events" },
    { value: counts.projects, label: "Projects tracked", href: "/projects" },
    { value: counts.posts, label: "Posts published", href: "/blog" },
  ].filter((item) => item.value > 0);

  return (
    <section
      aria-label="The club in numbers"
      className="mx-auto w-full max-w-5xl space-y-4 px-4 pt-14 sm:px-6"
    >
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-4 rounded-3xl border border-default-200/70 px-6 py-6 text-center sm:gap-8">
          {items.map((item) => (
            <div key={item.label} className="space-y-1">
              <p className="text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">
                <Link
                  href={item.href}
                  className="rounded-lg focus-visible:outline-2 focus-visible:outline-accent"
                  aria-label={`${item.value} ${item.label.toLowerCase()} — see all`}
                >
                  {item.value}
                </Link>
              </p>
              <p className="text-xs text-muted sm:text-sm">{item.label}</p>
            </div>
          ))}
        </div>
      )}
      <p className="text-center font-serif text-[15px] italic text-muted">
        “Technology should empower people, not control them.”{" "}
        <span className="not-italic">— the Greymens Charter</span>
      </p>
    </section>
  );
}

/**
 * Recruitment band, visitors only. Gated on auth loading so signed-in
 * members never see it flash in and out. No art: it follows the event
 * cards, so plain type gives the page a place to breathe — and animated
 * art here meant reduced-motion visitors got an empty box.
 */
export function JoinBand() {
  const { user, loading } = useAuth();

  if (loading || user) return null;

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-20 sm:px-6" aria-label="Join">
      <div className="rounded-3xl border border-default-200/70">
        <div className="flex flex-col items-center gap-5 p-8 text-center sm:p-10">
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              One open event is all it takes
            </h2>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-muted">
              No gauntlet, no experience, no awkward introductions. Pick a
              workshop, show up, decide for yourself.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2.5">
            <Link href="/events">
              <Button className="rounded-full px-6">
                Find an event
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="secondary" className="rounded-full px-6">
                Join directly
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
