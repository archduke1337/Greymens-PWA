"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Chip } from "@heroui/react";
import {
  ShieldCheck,
  Code2,
  Trophy,
  FlaskConical,
  ArrowRight,
  CalendarDays,
  BookOpen,
  Users,
  Landmark,
} from "lucide-react";

import FeaturedSection from "@/components/FeaturedSection";
import GuitarStringDivider from "@/components/GuitarStringDivider";
import { Logo } from "@/components/icons";

const TRACKS = [
  {
    Icon: ShieldCheck,
    title: "Learn security, properly",
    text: "Labs, workshops, and CTFs inside authorized environments — with the ethics taught before the tools.",
  },
  {
    Icon: Code2,
    title: "Build real things",
    text: "Web, software, AI/ML, and systems projects with owners, reviews, and handovers — not demo-day throwaways.",
  },
  {
    Icon: Trophy,
    title: "Compete together",
    text: "Hackathons, CTFs, and competitions as a team sport. Beginners pair with experienced players.",
  },
  {
    Icon: FlaskConical,
    title: "Research and write",
    text: "Questions worth answering, write-ups worth reading — published with attribution through our editorial board.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Come to one open event",
    text: "No membership, no experience, no awkward introductions. Pick a workshop or meetup and just show up.",
  },
  {
    n: "02",
    title: "Join as a member",
    text: "A short application, a real human reading it. Your branch doesn't matter — curiosity does.",
  },
  {
    n: "03",
    title: "Find your crew",
    text: "Security, software, AI/data, infra, editorial, community — try teams until one feels like yours.",
  },
  {
    n: "04",
    title: "Lead something",
    text: "Run a workshop, ship a project, captain a CTF. Offices are earned by contribution, and handed over with care.",
  },
];

const EXPLORE_LINKS = [
  {
    href: "/events",
    Icon: CalendarDays,
    title: "Attend events",
    description: "Workshops, hackathons, and meetups",
  },
  {
    href: "/blog",
    Icon: BookOpen,
    title: "Read the blog",
    description: "Guides and stories from members",
  },
  {
    href: "/team",
    Icon: Users,
    title: "Meet the team",
    description: "The people running the club",
  },
  {
    href: "/governance",
    Icon: Landmark,
    title: "How we're run",
    description: "Student-led, written down, fair",
  },
];

export default function Home() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="w-full">
      {/* Hero */}
      <section className="relative mx-auto w-full max-w-6xl overflow-hidden px-4 pt-10 sm:px-6 sm:pt-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl"
        />
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <div
            className={`space-y-6 text-center transition-all duration-700 ease-out motion-reduce:transition-none lg:text-left ${
              isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <Chip color="success" variant="soft" size="sm">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              ADYPU SoE · Cybersecurity at the core
            </Chip>
            <div className="space-y-3">
              <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
                Greymens
              </h1>
              <p className="text-2xl font-semibold text-muted sm:text-3xl">
                Hack the problem, not the people.
              </p>
            </div>
            <p className="mx-auto max-w-xl text-base leading-relaxed text-muted sm:text-lg lg:mx-0">
              We&apos;re a student cybersecurity club for the endlessly curious —
              builders, breakers (the authorized kind), writers, and researchers.
              Come as you are; leave sharper than you arrived.
            </p>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-center lg:justify-start">
              <Link href="/register">
                <Button size="lg" className="w-full rounded-full px-8 sm:w-auto">
                  Join the club
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
              <Link href="/about">
                <Button size="lg" variant="secondary" className="w-full rounded-full px-8 sm:w-auto">
                  What we&apos;re about
                </Button>
              </Link>
            </div>
            <p className="text-xs text-muted">
              Free to join · Every branch welcome · No experience needed
            </p>
          </div>

          {/* Explore panel */}
          <div
            className={`flex justify-center transition-all delay-200 duration-700 ease-out motion-reduce:transition-none lg:justify-end ${
              isLoaded ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
            }`}
          >
            <Card className="w-full max-w-[500px] p-2">
              <Card.Header className="flex-row items-center gap-4 px-5 pt-5">
                <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-surface-secondary">
                  <Logo className="h-11 w-11" />
                </span>
                <div>
                  <Card.Title>Greymens Club</Card.Title>
                  <Card.Description>
                    Membership · Events · Projects · CTFs
                  </Card.Description>
                </div>
              </Card.Header>
              <Card.Content>
                <nav aria-label="Club highlights" className="space-y-1">
                  {EXPLORE_LINKS.map((link) => {
                    const Icon = link.Icon;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="flex items-center gap-3.5 rounded-2xl px-3.5 py-3 transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{link.title}</span>
                          <span className="block truncate text-[13px] text-muted">
                            {link.description}
                          </span>
                        </span>
                        <span aria-hidden="true" className="text-accent">
                          →
                        </span>
                      </Link>
                    );
                  })}
                </nav>
              </Card.Content>
            </Card>
          </div>
        </div>
      </section>

      {/* Tracks */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-16 sm:px-6" aria-label="What you can do here">
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            Four ways in
          </p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Pick a door. They all connect inside.
          </h2>
          <p className="text-sm leading-relaxed text-muted sm:text-base">
            Most members start in one track and wander into the others. That&apos;s
            the point — security people who can build, builders who think like
            attackers (ethically), researchers who can explain themselves.
          </p>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRACKS.map((track) => {
            const Icon = track.Icon;
            return (
              <Card key={track.title}>
                <Card.Content className="space-y-3 p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent-soft-foreground">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="font-semibold leading-snug">{track.title}</h3>
                  <p className="text-sm leading-relaxed text-muted">{track.text}</p>
                </Card.Content>
              </Card>
            );
          })}
        </div>
      </section>

      {/* How joining works */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-16 sm:px-6" aria-label="How joining works">
        <Card>
          <Card.Header className="px-6 pt-6 sm:px-8">
            <Card.Title className="text-xl sm:text-2xl">Getting in is deliberately boring</Card.Title>
            <Card.Description>
              No tests, no hazing, no “prove you belong”. Just show up, join, find
              your people, and eventually lead something.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <ol className="grid gap-5 px-6 pb-6 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
              {STEPS.map((step) => (
                <li key={step.n} className="space-y-2">
                  <p className="font-mono text-sm font-semibold text-accent">{step.n}</p>
                  <h3 className="text-sm font-semibold">{step.title}</h3>
                  <p className="text-[13px] leading-relaxed text-muted">{step.text}</p>
                </li>
              ))}
            </ol>
          </Card.Content>
        </Card>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <GuitarStringDivider />
      </div>
      <FeaturedSection />

      {/* Governance strip */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6" aria-label="Governance">
        <Card>
          <Card.Content className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:p-8">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-warning-soft text-warning">
              <Landmark className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold">Run by students, written down, fair by design</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Elected leaders, appointed specialists, published rules, and a
                Constitution that outlasts any of us. Authority always traces back
                to a rule — and membership is never permission to test a system.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link href="/governance">
                <Button variant="secondary" className="rounded-full">
                  Governance
                </Button>
              </Link>
              <Link href="/constitution">
                <Button className="rounded-full">
                  Constitution
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
            </div>
          </Card.Content>
        </Card>
      </section>
    </div>
  );
}
