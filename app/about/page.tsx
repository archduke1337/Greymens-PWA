"use client";

import Link from "next/link";
import { Button, Card } from "@heroui/react";
import { ArrowRight, Check, X } from "lucide-react";

const FOCUS = [
  "Cybersecurity: the core craft",
  "AI / ML: the force multiplier",
  "Web & software: where most projects live",
  "Digital forensics: follow the evidence",
  "CTFs & competitions: the team sport",
  "Research & open source: in the open, or it didn't happen",
];

const NOT_THAT = [
  "No fees, ever. Workshops cost nothing.",
  "No attendance policing. Show up when you can.",
  "No certificate-chasing. Work first, paper later.",
  "No question too basic. Everyone starts somewhere.",
];

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-16 px-4 py-12 sm:px-6 sm:py-16">
      {/* Hero */}
      <header className="space-y-4 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-5xl">
          A club for people who take things apart
        </h1>
        <p className="mx-auto max-w-xl text-base leading-relaxed text-muted sm:text-lg">
          GreyMens is ADYPU&apos;s student cybersecurity collective — every
          branch, every year. We learn by breaking (authorized) things, build
          what we learn into projects, and hand the knowledge down.
        </p>
      </header>

      {/* Focus */}
      <section aria-label="What we actually do" className="space-y-6">
        <div className="space-y-2 text-center">
          <h2 className="text-xl font-bold tracking-tight">What we actually do</h2>
          <p className="mx-auto max-w-md text-[15px] text-muted">
            Six threads, one rule: ethics before exploits, always.
          </p>
        </div>
        <div className="grid items-center gap-8 sm:grid-cols-2">
          <figure className="space-y-2 sm:order-1">
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
          <ul className="space-y-2.5 sm:order-2">
            {FOCUS.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-[15px]">
                <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* What we're not */}
      <section aria-label="What we're not" className="space-y-6">
        <Card variant="secondary">
          <Card.Content className="space-y-4 p-6 sm:p-8">
            <h2 className="text-center text-xl font-bold tracking-tight">
              What we&apos;re not
            </h2>
            <ul className="mx-auto grid max-w-lg gap-2.5 sm:grid-cols-2">
              {NOT_THAT.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </Card.Content>
        </Card>
      </section>

      {/* Story */}
      <section aria-label="Our story" className="space-y-4">
        <h2 className="text-center text-xl font-bold tracking-tight">How it started</h2>
        <div className="space-y-4 text-[15px] leading-relaxed text-muted">
          <p>
            A few students who couldn&apos;t stop talking about security stayed
            late after classes, arguing about capture-the-flags, demos, and
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
          <figure className="flex flex-wrap items-center justify-center gap-8 pt-4">
            <img
              src="/adypu-logo.png"
              alt="ADYPU"
              loading="lazy"
              className="h-10 w-auto object-contain"
            />
            <img
              src="/seamedu-logo.jpg"
              alt="Seamedu"
              loading="lazy"
              className="h-14 w-14 rounded-2xl object-cover"
            />
          </figure>
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
