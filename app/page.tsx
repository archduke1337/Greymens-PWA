"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card } from "@heroui/react";
import { ArrowRight } from "lucide-react";

import FeaturedSection from "@/components/FeaturedSection";
import GuitarStringDivider from "@/components/GuitarStringDivider";

const WEEKLY_RHYTHM = [
  {
    title: "Learn",
    text: "Workshops and peer sessions. Ethics before exploits, always.",
  },
  {
    title: "Build",
    text: "Projects with owners and handovers — web, software, AI, systems.",
  },
  {
    title: "Compete",
    text: "CTFs and hackathons as a team sport. Beginners pair up, never sit out.",
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
      {/* Hero — plainspoken, like a club noticeboard */}
      <section className="mx-auto w-full max-w-3xl px-4 pt-14 text-center sm:px-6 sm:pt-20">
        <div
          className={`space-y-6 transition-all duration-700 ease-out motion-reduce:transition-none ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Greymens Club
          </h1>
          <p className="text-lg text-muted sm:text-xl">
            Curious minds. Secure tomorrows.
          </p>
          <p className="mx-auto max-w-xl text-[15px] leading-relaxed text-muted">
            A student cybersecurity club at ADYPU — open to every branch, no
            experience needed. Whether you&apos;re new to security or already
            breaking (authorized) things, there&apos;s a seat for you.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 pt-1 sm:flex-row">
            <Link href="/register">
              <Button size="lg" className="rounded-full px-8">
                Join the club
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link href="/events">
              <Button size="lg" variant="secondary" className="rounded-full px-8">
                See events
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* The club on one desk — drawn, not rendered */}
      <section className="mx-auto w-full max-w-5xl px-4 pt-14 sm:px-6">
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

      {/* Weekly rhythm */}
      <section className="mx-auto w-full max-w-5xl px-4 pt-16 sm:px-6" aria-label="What happens here">
        <div className="grid gap-8 sm:grid-cols-3">
          {WEEKLY_RHYTHM.map((item, index) => (
            <div key={item.title} className="space-y-2">
              <p className="font-mono text-xs text-muted">0{index + 1}</p>
              <h2 className="text-lg font-bold tracking-tight">{item.title}</h2>
              <p className="text-sm leading-relaxed text-muted">{item.text}</p>
            </div>
          ))}
        </div>
        <p className="pt-8 text-center text-sm text-muted">
          Same human. Different intentions.{" "}
          <Link href="/about" className="font-medium text-foreground underline underline-offset-4">
            What we&apos;re about
          </Link>
        </p>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <GuitarStringDivider />
      </div>
      <FeaturedSection />

      {/* Join band */}
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
    </div>
  );
}
