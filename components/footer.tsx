// components/footer.tsx
"use client";

import Link from "next/link";
import { ShieldCheck, ArrowRight, MapPin } from "lucide-react";
import { Chip, Separator } from "@heroui/react";

import { FooterSponsors } from "./footer-sponsors";
import { Logo } from "./icons";

const CLUB_LINKS = [
  { href: "/about", label: "About us", hint: "Who we are and why we exist" },
  { href: "/governance", label: "Governance", hint: "How the club is run" },
  { href: "/constitution", label: "Constitution", hint: "The full governing charter" },
  { href: "/team", label: "Leadership", hint: "Office bearers and teams" },
  { href: "/contact", label: "Contact", hint: "Talk to a human, not a bot" },
];

const LEARN_LINKS = [
  { href: "/events", label: "Events" },
  { href: "/projects", label: "Projects" },
  { href: "/blog", label: "Blog" },
  { href: "/gallery", label: "Gallery" },
  { href: "/resources", label: "Resources" },
  { href: "/sponsors", label: "Sponsors" },
];

const LEGAL_LINKS = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/docs", label: "Member handbook" },
  { href: "/security/report", label: "Report a security issue" },
  { href: "/help-feedback", label: "Help & feedback" },
];

const SOCIALS = [
  {
    label: "LinkedIn",
    handle: "Greymens Club",
    href: "https://www.linkedin.com/company/greymens",
  },
  {
    label: "Instagram",
    handle: "@greymens",
    href: "https://www.instagram.com/greymens?igsh=bzhycW1rMG12Z2Vh",
  },
  {
    label: "X (Twitter)",
    handle: "@GreymensADYPU",
    href: "https://twitter.com/GreymensADYPU",
  },
  {
    label: "Discord",
    handle: "Join the server",
    href: "https://discord.gg/6v89E3SaZT",
  },
];

export const Footer = () => {
  return (
    <footer className="w-full border-t border-default-200/60 bg-surface-secondary/40">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <FooterSponsors />

        {/* Join band */}
        <div className="mt-8 flex flex-col gap-5 rounded-3xl border border-default-200/70 bg-background p-6 shadow-sm sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <Chip color="success" variant="soft" size="sm">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Open to every ADYPU student — no experience needed
            </Chip>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              Curious about cybersecurity? Come to one workshop and decide.
            </h2>
            <p className="text-sm leading-relaxed text-muted">
              We are a student-run club with cybersecurity at the core and room for
              builders, writers, designers, and researchers. Bring curiosity —
              we will help with the rest.
            </p>
          </div>
          <div className="flex flex-col gap-2.5 sm:flex-row lg:flex-col xl:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
            >
              Join the club
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/events"
              className="inline-flex items-center justify-center rounded-full border border-default-300 px-6 py-3 text-sm font-semibold transition-colors hover:bg-surface-secondary"
            >
              See open events
            </Link>
          </div>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 gap-8 py-12 md:grid-cols-4 lg:grid-cols-5">
          <div className="col-span-2 space-y-4 lg:col-span-2">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-background shadow-sm">
                <Logo className="h-8 w-8" />
              </span>
              <span className="flex flex-col leading-none">
                <span className="text-lg font-bold tracking-tight">Greymens Club</span>
                <span className="text-xs text-muted">Cybersecurity · ADYPU SoE</span>
              </span>
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-muted">
              A continuous student technology community — practical, responsible,
              and welcoming. We learn by building, competing, researching, and
              looking after each other&apos;s growth.
            </p>
            <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              School of Engineering, ADYPU · Coordinated by Ranjana Singh and
              Suyog Deshmukh
            </p>
          </div>

          <nav aria-label="Club" className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">Club</h3>
            <ul className="space-y-2">
              {CLUB_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    title={link.hint}
                    className="text-sm text-foreground/80 transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Learn" className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">Learn & build</h3>
            <ul className="space-y-2">
              {LEARN_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-foreground/80 transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="col-span-2 space-y-3 md:col-span-4 lg:col-span-1">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">Trust & legal</h3>
            <ul className="space-y-2">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-foreground/80 transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="pt-2">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">Follow along</h3>
              <ul className="mt-2 space-y-1.5">
                {SOCIALS.map((social) => (
                  <li key={social.label}>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group text-sm text-foreground/80 transition-colors hover:text-foreground"
                    >
                      {social.label}
                      <span className="text-muted"> · {social.handle}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex flex-col items-center justify-between gap-3 py-6 text-center sm:flex-row sm:text-left">
          <p className="text-xs text-muted">
            © {new Date().getFullYear()} Greymens Club · Constitution v0.9 draft for ratification
          </p>
          <p className="text-xs text-muted">
            Student-led within institutional oversight · Membership is never permission to test a system
          </p>
        </div>
      </div>
    </footer>
  );
};
