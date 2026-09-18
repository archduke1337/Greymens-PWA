"use client";

import Link from "next/link";
import { Button } from "@heroui/react";
import { ArrowRight, Check } from "lucide-react";

const FOCUS = [
  "Cybersecurity",
  "AI / ML",
  "Web Development",
  "Digital Forensics",
  "CTF & Competitions",
  "Research & Innovation",
  "Open Source",
  "Workshops & Events",
  "Community Building",
];

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-16 px-4 py-12 sm:px-6 sm:py-16">
      {/* Hero */}
      <header className="space-y-4 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">About</h1>
        <p className="mx-auto max-w-xl text-base leading-relaxed text-muted sm:text-lg">
          GreyMens is a student-led technical collective focused on
          cybersecurity, technology, and real-world problem solving. We learn,
          build, research, and collaborate — for a safer, more open digital
          world.
        </p>
      </header>

      {/* Focus */}
      <section aria-label="Our focus" className="space-y-6">
        <h2 className="text-center text-xl font-bold tracking-tight">Our focus</h2>
        <div className="grid items-center gap-8 sm:grid-cols-2">
          <ul className="space-y-2.5">
            {FOCUS.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-[15px]">
                <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <figure className="space-y-2">
            <div className="overflow-hidden rounded-3xl border border-default-200/70 bg-black">
              <img
                src="/Assets/Objects/Brain.webp"
                alt="A brain resting on crumpled paper"
                loading="lazy"
                className="w-full object-cover"
              />
            </div>
            <figcaption className="text-center text-sm text-muted">
              Research starts on paper, ends in the open.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Story */}
      <section aria-label="Our story" className="space-y-4">
        <h2 className="text-center text-xl font-bold tracking-tight">How it started</h2>
        <div className="space-y-4 text-[15px] leading-relaxed text-muted">
          <p>
            A few students who couldn&apos;t stop talking about security stayed
            late after classes — arguing about capture-the-flags, demos, and
            ideas too big for a group chat. The conversation deserved a room.
            Then a club.
          </p>
          <p>
            Today that room is bigger. Founded by student coordinator{" "}
            <span className="text-foreground">Aditya Yadav</span>, with faculty
            coordinators{" "}
            <span className="text-foreground">
              Ranjana Singh and Suyog Deshmukh
            </span>
            , in ADYPU&apos;s School of Engineering. The culture hasn&apos;t
            changed: show up curious, leave sharper, bring someone with you
            next time.
          </p>
          <blockquote className="border-l-2 border-foreground/70 pl-4 text-base text-foreground">
            Technology should empower people, not control them.
          </blockquote>
        </div>
      </section>

      {/* Community */}
      <section aria-label="Community" className="space-y-6 text-center">
        <img
          src="/Assets/Media/team-ideas.gif"
          alt="Hands fitting puzzle pieces together"
          loading="lazy"
          className="mx-auto h-44 w-44 rounded-3xl border border-default-200/70 object-cover"
        />
        <div className="space-y-3">
          <h2 className="text-xl font-bold tracking-tight">Built like a puzzle, together</h2>
          <p className="mx-auto max-w-md text-[15px] leading-relaxed text-muted">
            Security people who can build. Builders who think like attackers —
            ethically. Researchers who can explain themselves. Everyone holds a
            different piece.
          </p>
          <div className="flex flex-wrap justify-center gap-2.5 pt-1">
            <Link href="/team">
              <Button variant="secondary" className="rounded-full px-6">
                Meet the leadership
              </Button>
            </Link>
            <Link href="/register">
              <Button className="rounded-full px-6">
                Join us
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
