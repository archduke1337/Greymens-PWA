"use client";

import Link from "next/link";
import Image from "next/image";
import { Card } from "@heroui/react";
import { ArrowRight, Check, X } from "lucide-react";

import LinkButton from "@/components/ui/LinkButton";
import { useAuth } from "@/context/AuthContext";

const FOCUS = [
  { text: "Cybersecurity: the core craft", href: "/events", link: "Workshops" },
  {
    text: "AI / ML: the force multiplier",
    href: "/projects",
    link: "Projects",
  },
  {
    text: "Web & software: where most projects live",
    href: "/projects",
    link: "Projects",
  },
  {
    text: "Digital forensics: follow the evidence",
    href: "/blog",
    link: "Write-ups",
  },
  {
    text: "CTFs & competitions: the team sport",
    href: "/events",
    link: "Events",
  },
  {
    text: "Research & open source: in the open, or it didn't happen",
    href: "/blog",
    link: "Posts",
  },
];

const NOT_THAT = [
  "No fees, ever. Open events stay open.",
  "No forms to attend. Just show up.",
  "No certificate-chasing. Work first, paper later.",
  "No question too basic. Everyone starts somewhere.",
];

export default function AboutPage() {
  // Signed-in members already belong — the join button is for visitors.
  const { user } = useAuth();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-16 px-4 py-12 sm:px-6 sm:py-16">
      {/* Hero */}
      <header className="space-y-4 text-center">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <span className="flex h-14 items-center rounded-2xl bg-white px-3">
            <Image
              alt="Ajeenkya D Y Patil University"
              className="h-9 w-auto object-contain"
              height={260}
              loading="lazy"
              src="/adypu-logo.png"
              width={1024}
            />
          </span>
          <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white">
            <Image
              alt="Seamedu"
              className="h-12 w-12 object-contain"
              height={96}
              loading="lazy"
              src="/seamedu-logo.jpg"
              width={96}
            />
          </span>
        </div>
        <p className="text-sm text-muted">
          A student club of Ajeenkya D Y Patil University
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-5xl">
          A club for people who take things apart
        </h1>
        <p className="mx-auto max-w-xl text-base leading-relaxed text-muted sm:text-lg">
          Greymens is ADYPU&apos;s student cybersecurity collective — every
          branch, every year. We learn by breaking things we&apos;re invited to
          break, build what we learn into projects, and hand the knowledge down.
        </p>
      </header>

      {/* Focus */}
      <section aria-label="What we actually do" className="space-y-6">
        <div className="space-y-2 text-center">
          <h2 className="text-xl font-bold tracking-tight">
            What we actually do
          </h2>
          <p className="mx-auto max-w-md text-[15px] text-muted">
            Six threads, one rule: ethics before exploits, always.
          </p>
        </div>
        <div className="grid items-center gap-8 sm:grid-cols-2">
          <figure className="space-y-2 sm:order-1">
            <div className="overflow-hidden rounded-3xl border border-default-200/70 bg-black">
              <Image
                alt="A brain resting on crumpled paper"
                className="w-full object-cover"
                height={513}
                loading="lazy"
                src="/Assets/Objects/Brain.webp"
                width={768}
              />
            </div>
            <figcaption className="text-center text-sm text-muted">
              Research starts on paper, ends in the open.
            </figcaption>
          </figure>
          <ul className="space-y-2.5 sm:order-2">
            {FOCUS.map((item) => (
              <li
                key={item.text}
                className="flex items-center gap-2.5 text-[15px]"
              >
                <Check aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span>
                  {item.text}{" "}
                  <Link
                    aria-label={`See ${item.link.toLowerCase()} at Greymens`}
                    className="whitespace-nowrap text-sm font-medium text-muted underline underline-offset-4 hover:text-foreground focus-visible:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
                    href={item.href}
                  >
                    {item.link} <span aria-hidden="true">→</span>
                  </Link>
                </span>
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
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-sm leading-relaxed"
                >
                  <X
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </Card.Content>
        </Card>
      </section>

      {/* Story */}
      <section aria-label="Our story" className="space-y-4">
        <h2 className="text-center text-xl font-bold tracking-tight">
          How it started
        </h2>
        <div className="space-y-4 text-[15px] leading-relaxed text-muted">
          <p>
            A few students who couldn&apos;t stop talking about security stayed
            late after classes, arguing about capture-the-flags, demos, and
            ideas too big for a group chat. The conversation deserved a room.
            Then a club.
          </p>
          <p>
            Today that room is bigger. Founded in 2026 by student coordinator{" "}
            <span className="text-foreground">Aditya Yadav</span>, with faculty
            coordinators{" "}
            <span className="text-foreground">
              Ranjana Singh and Suyog Deshmukh
            </span>
            , in ADYPU&apos;s School of Engineering. The culture hasn&apos;t
            changed: show up curious, leave sharper, bring someone with you next
            time.{" "}
            <Link
              className="font-medium text-foreground underline underline-offset-4"
              href="/team"
            >
              Meet the current leadership
            </Link>
            .
          </p>
        </div>
      </section>

      {/* Community */}
      <section aria-label="Community" className="space-y-6 text-center">
        <Image
          alt="A matchbox full of tiny people"
          className="mx-auto h-44 w-44 rounded-3xl border border-default-200/70 object-cover"
          height={352}
          loading="lazy"
          src="/Assets/Media/matchbox-of-humans.webp"
          width={352}
        />
        <div className="space-y-3">
          <h2 className="text-xl font-bold tracking-tight">
            Plenty of pieces. Bring yours.
          </h2>
          <p className="mx-auto max-w-md text-[15px] leading-relaxed text-muted">
            Security people who can build. Builders who think like attackers —
            ethically. Researchers who can explain themselves. Everyone holds a
            different piece.
          </p>
          <div className="flex flex-wrap justify-center gap-2.5 pt-1">
            <LinkButton
              className="rounded-full px-6"
              href="/team"
              variant="secondary"
            >
              Meet the leadership
            </LinkButton>
            {!user && (
              <LinkButton className="rounded-full px-6" href="/register">
                Join us
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </LinkButton>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
