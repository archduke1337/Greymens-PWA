import Link from "next/link";
import { Button } from "@heroui/react";
import { ArrowRight } from "lucide-react";

import FeaturedSection from "@/components/FeaturedSection";
import GuitarStringDivider from "@/components/GuitarStringDivider";
import { HeroCta, JoinBand, ProofStrip } from "@/components/home/HomeClient";

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
    text: "One event is enough to know. The form takes a minute; review takes a few days.",
  },
];

export default function Home() {
  return (
    <div className="w-full">
      {/* Institutional marks — quiet trust line between navbar and the fold.
          Centered like the about page; white tiles keep both logos' brand
          colors intact on the dark bg. */}
      <section
        aria-label="Institutional affiliation"
        className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-4 pb-5 pt-1 sm:flex-row sm:justify-center sm:gap-4"
      >
        <span className="flex h-11 items-center rounded-xl bg-white px-3.5">
          <img
            src="/adypu-logo.png"
            alt="Ajeenkya D Y Patil University"
            className="h-6 w-auto object-contain"
          />
        </span>
        <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white">
          <img
            src="/seamedu-logo.jpg"
            alt="Seamedu"
            className="h-8 w-8 object-contain"
          />
        </span>
        <p className="text-center text-xs text-muted sm:text-sm">
          A student club of Ajeenkya D Y Patil University
        </p>
      </section>

      {/* Hero — the crowd is the hero, but it never reads as a pasted photo:
          four background-token gradients dissolve every edge into the page,
          so the image sits inside the UI like atmosphere. Type uses the
          theme's own foreground over a matching scrim — legible in both
          themes. CSS-only entrance (motion-safe). */}
      <section className="relative flex h-[min(88vh,900px)] min-h-[560px] w-full items-end overflow-hidden">
        <img
          src="/Assets/Banners/clut.jpg"
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
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
            Curious minds. Secure tomorrows.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-muted">
            Greymens is ADYPU&apos;s student cybersecurity club. Every branch,
            no experience needed — just curiosity.
          </p>
          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <HeroCta />
            <Link
              href="https://discord.gg/6v89E3SaZT"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="lg" variant="secondary" className="rounded-full px-8">
                Join the Discord
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted">
            Free workshops · Open to every branch · No experience needed
          </p>
        </div>
      </section>

      <p className="mx-auto max-w-3xl px-4 pt-3 text-center text-xs text-muted sm:px-6">
        One figure in that crowd is already lit up. That&apos;s the club.
      </p>

      <style>{`
        @keyframes heroIn {
          from {
            opacity: 0;
            transform: translateY(32px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <ProofStrip />

      {/* Learn / Build — image first on small screens, alternating on large */}
      <section
        id="what-happens-here"
        className="mx-auto w-full max-w-5xl space-y-16 px-4 pt-20 sm:px-6 sm:pt-28"
        aria-label="What happens here"
      >
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <figure>
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
          <figure className="lg:order-2">
            <div className="overflow-hidden rounded-3xl border border-default-200/70">
              <img
                src={BUILD_ROW.src}
                alt={BUILD_ROW.alt}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover"
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
              href={BUILD_ROW.href}
              className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4"
            >
              {BUILD_ROW.cta}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* First month — an ordered path, so the numbers are earned */}
      <section
        id="first-month"
        className="mx-auto w-full max-w-5xl px-4 pt-20 sm:px-6 sm:pt-28"
        aria-label="Your first month"
      >
        <div className="max-w-xl space-y-2">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Your first month
          </h2>
          <p className="text-[15px] leading-relaxed text-muted">
            One short form and a few days of review. Three steps, and the
            second one is just walking through a door.
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

      <JoinBand />
    </div>
  );
}
