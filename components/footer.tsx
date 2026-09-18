// components/footer.tsx
"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Separator } from "@heroui/react";

import { FooterSponsors } from "./footer-sponsors";

const CLUB_LINKS = [
  { href: "/about", label: "About" },
  { href: "/governance", label: "Governance" },
  { href: "/constitution", label: "Constitution" },
  { href: "/team", label: "Leadership" },
  { href: "/contact", label: "Contact" },
];

const LEARN_LINKS = [
  { href: "/events", label: "Events" },
  { href: "/projects", label: "Projects" },
  { href: "/blog", label: "Blog" },
  { href: "/gallery", label: "Gallery" },
  { href: "/resources", label: "Resources" },
  { href: "/sponsors", label: "Sponsors" },
];

const TRUST_LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/docs", label: "Handbook" },
  { href: "/security/report", label: "Report a security issue" },
  { href: "/help-feedback", label: "Help & feedback" },
];

const SOCIALS = [
  { label: "LinkedIn", href: "https://www.linkedin.com/company/greymens" },
  { label: "Instagram", href: "https://www.instagram.com/greymens?igsh=bzhycW1rMG12Z2Vh" },
  { label: "X", href: "https://twitter.com/GreymensADYPU" },
  { label: "Discord", href: "https://discord.gg/6v89E3SaZT" },
];

export const Footer = () => {
  return (
    <footer className="w-full border-t border-default-200/60">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <FooterSponsors />

        {/* One-line invitation */}
        <div className="flex flex-col gap-3 py-10 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-lg leading-snug tracking-tight">
            Curious about security? Come to one workshop.{" "}
            <span className="text-muted">No experience needed.</span>
          </p>
          <Link
            href="/register"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium underline underline-offset-4"
          >
            Join the club
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        <Separator />

        {/* Link columns */}
        <div className="grid grid-cols-2 gap-8 py-10 md:grid-cols-4">
          <div className="col-span-2 space-y-3 md:col-span-1">
            <p className="text-[15px] font-bold tracking-[0.22em]">GREYMENS</p>
            <p className="max-w-xs text-sm leading-relaxed text-muted">
              A student cybersecurity club at ADYPU&apos;s School of
              Engineering. Curious minds, secure tomorrows.
            </p>
          </div>

          <nav aria-label="Club" className="space-y-3">
            <h3 className="text-xs font-medium uppercase tracking-widest text-muted">Club</h3>
            <ul className="space-y-2">
              {CLUB_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-muted transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Learn" className="space-y-3">
            <h3 className="text-xs font-medium uppercase tracking-widest text-muted">Learn</h3>
            <ul className="space-y-2">
              {LEARN_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-muted transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Trust" className="space-y-3">
            <h3 className="text-xs font-medium uppercase tracking-widest text-muted">Trust</h3>
            <ul className="space-y-2">
              {TRUST_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-muted transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <Separator />

        <div className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted">
            © {new Date().getFullYear()} Greymens Club · Constitution v1.0 · In force
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {SOCIALS.map((social) => (
              <li key={social.label}>
                <a
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted transition-colors hover:text-foreground"
                >
                  {social.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
};
