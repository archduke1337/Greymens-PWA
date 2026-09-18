"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card } from "@heroui/react";
import { ArrowRight } from "lucide-react";

import FeaturedSection from "@/components/FeaturedSection";
import GuitarStringDivider from "@/components/GuitarStringDivider";
import { blogService } from "@/lib/blog";
import { useAuth } from "@/context/AuthContext";

const LEARN_ROW = {
  title: "Learn out loud",
  text: "Weekly workshops and peer sessions, ethics before exploits. Beginners pair up — nobody sits out while others type.",
  href: "/events",
  cta: "See upcoming events",
  src: "/Assets/Banners/clut.jpg",
  alt: "A crowd in black and white, one figure lit in green binary code",
};

const BUILD_ROW = {
  title: "Build with owners",
  text: "Projects with a named lead, a scope, and a handover — web, AI, systems. Demos that refuse to stay demos.",
  href: "/projects",
  cta: "Browse member projects",
  src: "/Assets/Media/team-ideas.gif",
  alt: "Hands fitting puzzle pieces together",
};

const FIRST_MONTH = [
  {
    n: "01",
    title: "Pick an open event",
    text: "Workshops are open to every branch. No application, no prep.",
  },
  {
    n: "02",
    title: "Show up",
    text: "Bring a laptop if you have one. Borrowed curiosity works too.",
  },
  {
    n: "03",
    title: "Decide if it's yours",
    text: "One event is enough to know. Joining takes a minute after that.",
  },
];

/**
 * Live proof strip: upcoming events, tracked projects, published posts.
 *
 * Every number comes from the same read APIs the product pages use, counted
 * at render time. If any source fails, the strip stays hidden — a marketing
 * page must never show a zero it cannot defend or a stale number baked in
 * at build time.
 */
function ProofStrip() {
  const [counts, setCounts] = useState<{
    events: number;
    projects: number;
    posts: number;
  } | null>(null);

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
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!counts) return null;

  const items = [
    { value: counts.events, label: "Upcoming events" },
    { value: counts.projects, label: "Projects tracked" },
    { value: counts.posts, label: "Posts published" },
  ];

  return (
    <section
      aria-label="The club in numbers"
      className="mx-auto w-full max-w-5xl px-4 pt-14 sm:px-6"
    >
      <dl className="grid grid-cols-3 gap-4 rounded-3xl border border-default-200/70 px-6 py-6 text-center sm:gap-8">
        {items.map((item) => (
          <div key={item.label} className="space-y-1">
            <dd className="text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">
              {item.value}
            </dd>
            <dt className="text-xs text-muted sm:text-sm">{item.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function Home() {
  const [isLoaded, setIsLoaded] = useState(false);
  // Signed-in members already belong — point them at the dashboard, and the
  // recruitment band below stays for visitors only.
  const { user } = useAuth();

  useEffect(() => {
    // Motion-sensitive visitors skip the entrance entirely.
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setIsLoaded(true);
      return;
    }
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="w-full">
      {/* Hero — type-only fold: language carries it, the desk waits below */}
      <section className="mx-auto w-full max-w-3xl px-4 pt-24 text-center sm:px-6 sm:pt-28">
        <div
          className={`space-y-6 transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-6xl">
            Hack things. Fix things. Belong here.
          </h1>
          <p className="mx-auto max-w-xl text-lg leading-relaxed text-muted sm:text-xl">
            Greymens is ADYPU&apos;s student cybersecurity club. Every branch,
            no experience needed — just curiosity.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 pt-1 sm:flex-row">
            {user ? (
              <Link href="/dashboard">
                <Button size="lg" className="rounded-full px-8">
                  Go to dashboard
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
            ) : (
              <Link href="/register">
                <Button size="lg" className="rounded-full px-8">
                  Join the club
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
            )}
            <Link href="/events">
              <Button size="lg" variant="secondary" className="rounded-full px-8">
                See events
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted">
            Free workshops · Open events · Students only
          </p>
        </div>
      </section>

      {/* The club on one desk — drawn, not rendered */}
      <section className="mx-auto w-full max-w-5xl px-4 pt-16 sm:px-6 sm:pt-20">
        <figure className="space-y-3">
          <div className="overflow-hidden rounded-3xl border border-default-200/70">
            <img
              src="/Assets/Objects/about.png"
              alt="A hand-drawn Greymens desk: mission poster, focus checklist, terminal, books, and a sleeping cat"
              loading="lazy"
              className="w-full object-cover"
            />
          </div>
          <figcaption className="text-center text-sm text-muted">
            The whole club on one desk — learn, build, share, grow together.
          </figcaption>
        </figure>
      </section>

      <ProofStrip />

      {/* Learn / Build — asymmetric rows with real rooms, not icons */}
      <section
        className="mx-auto w-full max-w-5xl space-y-16 px-4 pt-20 sm:px-6 sm:pt-28"
        aria-label="What happens here"
      >
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <figure className="space-y-2">
            <div className="overflow-hidden rounded-3xl border border-default-200/70">
              <img
                src={LEARN_ROW.src}
                alt={LEARN_ROW.alt}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
          </figure>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {LEARN_ROW.title}
            </h2>
            <p className="max-w-md text-[15px] leading-relaxed text-muted">
              {LEARN_ROW.text}
            </p>
            <Link
              href={LEARN_ROW.href}
              className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4"
            >
              {LEARN_ROW.cta}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div className="space-y-3 lg:order-1 lg:text-right">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {BUILD_ROW.title}
            </h2>
            <p className="max-w-md text-[15px] leading-relaxed text-muted lg:ml-auto">
              {BUILD_ROW.text}
            </p>
            <Link
              href={BUILD_ROW.href}
              className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4"
            >
              {BUILD_ROW.cta}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
          <figure className="space-y-2 lg:order-2">
            <div className="overflow-hidden rounded-3xl border border-default-200/70">
              <img
                src={BUILD_ROW.src}
                alt={BUILD_ROW.alt}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
          </figure>
        </div>
      </section>

      {/* First month — an ordered path, so the numbers are earned */}
      <section
        className="mx-auto w-full max-w-5xl px-4 pt-20 sm:px-6 sm:pt-28"
        aria-label="Your first month"
      >
        <div className="max-w-xl space-y-2">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Your first month
          </h2>
          <p className="text-[15px] leading-relaxed text-muted">
            No application gauntlet. Three steps, and the second one is just
            walking through a door.
          </p>
        </div>
        <ol className="grid gap-8 pt-8 sm:grid-cols-3">
          {FIRST_MONTH.map((step) => (
            <li key={step.n} className="space-y-2 border-t-2 border-foreground/80 pt-4">
              <p className="font-mono text-xs text-muted">{step.n}</p>
              <h3 className="font-bold tracking-tight">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <GuitarStringDivider />
      </div>
      <FeaturedSection />

      {/* Join band — visitors only */}
      {!user && (
        <section className="mx-auto w-full max-w-5xl px-4 pb-20 sm:px-6" aria-label="Join">
        <Card>
          <Card.Content className="flex flex-col items-center gap-5 p-8 text-center sm:p-10">
            <img
              src="/Assets/Media/point-out.gif"
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="h-24 w-24 rounded-2xl object-cover"
            />
            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                One open event is all it takes
              </h2>
              <p className="mx-auto max-w-md text-sm leading-relaxed text-muted">
                No application, no experience, no awkward introductions. Pick a
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
          </Card.Content>
        </Card>
        </section>
      )}
    </div>
  );
}
