"use client";
import Link from "next/link";
import { Card, Chip } from "@heroui/react";
import {
  FileText,
  Lock,
  ScrollText,
  Landmark,
  ShieldCheck,
  LifeBuoy,
  ArrowRight,
  ArrowUpRight,
} from "lucide-react";

const GUIDES = [
  {
    href: "/terms",
    Icon: FileText,
    title: "Terms of Service",
    text: "Membership, events, content, and conduct — in plain English.",
    meta: "Updated Sep 2026",
  },
  {
    href: "/privacy",
    Icon: Lock,
    title: "Privacy Policy",
    text: "What we collect, why, who can see it, and your rights.",
    meta: "Updated Sep 2026",
  },
  {
    href: "/constitution",
    Icon: ScrollText,
    title: "Constitution",
    text: "The full governing charter: XVIII parts, 86 articles, 7 schedules.",
    meta: "In force",
  },
  {
    href: "/governance",
    Icon: Landmark,
    title: "Governance",
    text: "Boards, councils, elections, and fair process — the friendly tour.",
    meta: "Start here",
  },
  {
    href: "/security/report",
    Icon: ShieldCheck,
    title: "Security reporting",
    text: "Authorization requests and incident reports, handled responsibly.",
    meta: "Responsible disclosure",
  },
  {
    href: "/help-feedback",
    Icon: LifeBuoy,
    title: "Help & feedback",
    text: "Stuck, confused, or full of opinions? This is the place.",
    meta: "We reply",
  },
];

const QUICK_ANSWERS = [
  {
    q: "How do I join?",
    a: "Apply on the register page — a human reviews every application. No permission-asking needed beforehand.",
    href: "/register",
    cta: "Apply",
  },
  {
    q: "Do I need experience?",
    a: "No. Most members arrive as beginners; workshops assume curiosity, not background.",
    href: "/events",
    cta: "See open events",
  },
  {
    q: "Can I hold office?",
    a: "Members in good standing can stand or be appointed. Elections and eligibility are published in advance.",
    href: "/governance",
    cta: "How governance works",
  },
  {
    q: "Something feels wrong — what now?",
    a: "Report it. Complaints, safety concerns, and vulnerabilities all have confidential paths with fair process.",
    href: "/security/report",
    cta: "Report",
  },
];

export default function DocsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 px-4 py-10 sm:px-6">
      <header className="max-w-2xl space-y-3">
        <Chip color="accent" variant="soft" size="sm">
          Member handbook
        </Chip>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Rules, guides, and answers
        </h1>
        <p className="text-base leading-relaxed text-muted">
          Everything that governs the club and helps you use it — the short
          guides first, the full Constitution when you want the source of truth.
        </p>
      </header>

      <div className="overflow-hidden rounded-3xl border border-default-200/70" aria-hidden="true">
        <img
          src="/Assets/Background/texture.png"
          alt=""
          loading="lazy"
          className="h-28 w-full object-cover sm:h-36"
        />
      </div>

      <section aria-label="Guides" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GUIDES.map((guide) => {
          const Icon = guide.Icon;
          return (
            <Link
              key={guide.href}
              href={guide.href}
              className="group rounded-3xl focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Card className="h-full transition-shadow duration-200 group-hover:shadow-lg">
                <Card.Content className="space-y-3 p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent-soft-foreground">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-semibold transition-colors group-hover:text-accent">
                      {guide.title}
                    </h2>
                    <ArrowUpRight
                      className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="text-sm leading-relaxed text-muted">{guide.text}</p>
                  <p className="text-xs font-medium text-muted">{guide.meta}</p>
                </Card.Content>
              </Card>
            </Link>
          );
        })}
      </section>

      <section aria-label="Quick answers" className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight">Quick answers</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {QUICK_ANSWERS.map((item) => (
            <Card key={item.q}>
              <Card.Content className="space-y-2 p-6">
                <h3 className="font-semibold">{item.q}</h3>
                <p className="text-sm leading-relaxed text-muted">{item.a}</p>
                <Link
                  href={item.href}
                  className="inline-flex items-center gap-1 text-sm font-medium text-accent"
                >
                  {item.cta}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </Card.Content>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
