"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";

import FeaturedSection from "@/components/FeaturedSection";
import GuitarStringDivider from "@/components/GuitarStringDivider";
import { Logo } from "@/components/icons";

const QUICK_LINKS = [
  {
    href: "/events",
    title: "Attend events",
    description: "Workshops, hackathons, and meetups",
  },
  {
    href: "/blog",
    title: "Read the blog",
    description: "Guides and stories from members",
  },
  {
    href: "/team",
    title: "Meet the team",
    description: "The people running the club",
  },
];

export default function Home() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="w-full">
      <section className="min-h-screen flex items-center justify-center relative overflow-hidden -mt-16 pt-16">
        <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10 px-4">
          {/* Hero Content */}
          <div
            className={`space-y-6 text-center lg:text-left transition-all duration-700 ease-out motion-reduce:transition-none ${
              isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <div className="space-y-4">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-foreground">
                Greymens
              </h1>
              <h2 className="text-3xl sm:text-4xl font-semibold text-gray-700 dark:text-gray-300">
                Where Ideas Connect
              </h2>
            </div>

            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-xl mx-auto lg:mx-0">
              Join our community of innovators, thinkers, and creators. Connect,
              collaborate, and bring your ideas to life.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4">
              <Link
                href="/register"
                className="px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-lg shadow-sm hover:opacity-90 transition-opacity duration-150 text-center"
              >
                Join the Club
              </Link>
              <Link
                href="/about"
                className="px-8 py-4 border border-border text-foreground font-semibold rounded-lg hover:bg-muted transition-colors duration-150 text-center"
              >
                Explore More
              </Link>
            </div>
          </div>

          {/* Brand panel */}
          <div
            className={`flex justify-center lg:justify-end transition-all duration-700 ease-out motion-reduce:transition-none delay-300 ${
              isLoaded ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
            }`}
          >
            <div className="w-full max-w-[500px] rounded-2xl border border-border bg-card p-8 shadow-xl">
              <div className="flex items-center gap-4">
                <Logo className="w-16 h-16 md:w-20 md:h-20" />
                <div>
                  <p className="text-xl font-bold tracking-tight">Greymens Club</p>
                  <p className="text-sm text-default-500">
                    Membership · Events · Tickets
                  </p>
                </div>
              </div>
              <nav aria-label="Club highlights" className="mt-6 space-y-2">
                {QUICK_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-between gap-4 rounded-xl px-4 py-3 hover:bg-muted transition-colors focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <span>
                      <span className="block font-semibold">{link.title}</span>
                      <span className="block text-sm text-default-500">
                        {link.description}
                      </span>
                    </span>
                    <span aria-hidden="true" className="text-primary text-lg">→</span>
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </div>
      </section>

      <GuitarStringDivider />
      <FeaturedSection />
    </div>
  );
}
