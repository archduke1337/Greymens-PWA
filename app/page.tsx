import type { Metadata } from "next";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import FeaturedSection from "@/components/FeaturedSection";
import GuitarStringDivider from "@/components/GuitarStringDivider";
import LinkButton from "@/components/ui/LinkButton";
import { HeroCta, JoinBand, ProofStrip } from "@/components/home/HomeClient";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Greymens — ADYPU's student cybersecurity club",
  description:
    "Weekly workshops, real member projects, and people who pair with you from day one. Open to every branch at ADYPU — no experience needed.",
  openGraph: {
    title: "Greymens — ADYPU's student cybersecurity club",
    description:
      "Break things. Build things. Belong. Weekly workshops and real projects, open to every branch — no experience needed.",
  },
};

const LEARN_ROW = {
  title: "Learn out loud",
  text: "Weekly workshops and peer sessions, ethics before exploits. Beginners pair up — nobody sits out while others type.",
  href: "/events",
  cta: "See upcoming events",
  src: "/Assets/Media/matchbox-of-humans.webp",
  alt: "Match heads peeking from a matchbox, one stepping out",
};

const BUILD_ROW = {
  title: "Build with owners",
  text: "Projects with a named lead, a scope, and a handover — web, AI, systems. Demos that refuse to stay demos.",
  href: "/projects",
  cta: "Browse member projects",
  src: "/Assets/Media/Do-something.webp",
  alt: "A hand rising out of a hole holding a sign that reads DO SOMETHING",
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
    text: "One event is enough to know. Then a one-minute form and a few days of review.",
  },
];

export default function Home() {
  return (
    <div className="w-full">
      {/* Hero — the crowd is the hero, but it never reads as a pasted photo:
          four background-token gradients dissolve every edge into the page,
          so the image sits inside the UI like atmosphere. Type uses the
          theme's own foreground over a matching scrim — legible in both
          themes. CSS-only entrance (motion-safe); keyframes live in
          styles/globals.css. next/image with priority: this is the LCP
          element, with responsive sizes so mobile doesn't fetch desktop
          weight. Institutional marks live in the footer, not here — the
          headline is the first thing a visitor should read. */}
      <section className="relative flex h-[min(88vh,900px)] min-h-[560px] w-full items-end overflow-hidden">
        <Image
          fill
          priority
          alt="A crowd of students at a Greymens gathering"
          className="object-cover"
          sizes="100vw"
          src="/Assets/Banners/clut.jpg"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-[var(--background)] to-transparent sm:h-44"
        />
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[var(--background)] to-transparent sm:w-40"
        />
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[var(--background)] to-transparent sm:w-40"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/45 to-transparent"
        />
        <div className="relative mx-auto w-full max-w-6xl space-y-6 px-4 pb-16 pt-32 sm:px-6 sm:pb-20 motion-safe:animate-[heroIn_0.7s_ease-out_both]">
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-balance text-foreground sm:text-6xl">
            Break things. Build things. Belong.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-muted">
            Greymens is ADYPU&apos;s student cybersecurity club. Weekly
            workshops, real projects, and people who pair with you from day one
            — no experience needed.
          </p>
          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <HeroCta />
            <LinkButton
              className="rounded-full px-8"
              href={siteConfig.links.discord}
              rel="noopener noreferrer"
              size="lg"
              target="_blank"
              variant="secondary"
            >
              Join the Discord
              <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </LinkButton>
          </div>
          <p className="text-sm text-muted">
            One open event is all it takes to fall in love with the club.
          </p>
        </div>
      </section>

      <ProofStrip />

      {/* Learn / Build — image first on small screens, alternating on large */}
      <section
        aria-label="What happens here"
        className="mx-auto w-full max-w-5xl space-y-16 px-4 pt-20 sm:px-6 sm:pt-28"
        id="what-happens-here"
      >
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <figure>
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-default-200/70">
              <Image
                fill
                alt={LEARN_ROW.alt}
                className="object-cover"
                loading="lazy"
                sizes="(max-width: 1024px) 100vw, 50vw"
                src={LEARN_ROW.src}
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
              className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4"
              href={LEARN_ROW.href}
            >
              {LEARN_ROW.cta}
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="grid items-center gap-8 lg:grid-cols-2">
          <figure className="lg:order-2">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-default-200/70">
              <Image
                fill
                alt={BUILD_ROW.alt}
                className="object-cover"
                loading="lazy"
                sizes="(max-width: 1024px) 100vw, 50vw"
                src={BUILD_ROW.src}
              />
            </div>
          </figure>
          <div className="space-y-3 lg:order-1">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {BUILD_ROW.title}
            </h2>
            <p className="max-w-md text-[15px] leading-relaxed text-muted">
              {BUILD_ROW.text}
            </p>
            <Link
              className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4"
              href={BUILD_ROW.href}
            >
              {BUILD_ROW.cta}
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* First month — an ordered path, so the numbers are earned.
          Ends in a CTA: a funnel with no next step leaks everyone. */}
      <section
        aria-label="Your first month"
        className="mx-auto w-full max-w-5xl px-4 pt-20 sm:px-6 sm:pt-28"
        id="first-month"
      >
        <div className="max-w-xl space-y-2">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Your first month
          </h2>
          <p className="text-[15px] leading-relaxed text-muted">
            Three steps, and the second one is just walking through a door.
          </p>
        </div>
        <ol className="grid gap-8 pt-8 sm:grid-cols-3">
          {FIRST_MONTH.map((step) => (
            <li
              key={step.n}
              className="space-y-2 border-t-2 border-foreground/80 pt-4"
            >
              <p className="font-mono text-xs text-muted">{step.n}</p>
              <h3 className="font-bold tracking-tight">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-3 pt-8 sm:flex-row">
          <LinkButton className="rounded-full px-6" href="/events">
            Start with step one
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </LinkButton>
          <LinkButton
            className="rounded-full px-6"
            href="/register"
            variant="secondary"
          >
            Skip to the form
          </LinkButton>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <GuitarStringDivider />
      </div>
      <FeaturedSection />

      <JoinBand />
    </div>
  );
}
