// app/sponsors/page.tsx
"use client";

import type { Sponsor } from "@/lib/sponsors";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button, Card, CardContent, Chip, Separator } from "@heroui/react";

import { sponsorTiers } from "@/lib/sponsors";
import { getErrorMessage, readApiError } from "@/lib/errorHandler";
import { logError } from "@/lib/logger";

export default function SponsorsPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadSponsors();
  }, []);

  const loadSponsors = async () => {
    try {
      setLoadError(null);
      const response = await fetch("/api/sponsors", { credentials: "include" });
      const payload = (await response.json()) as {
        sponsors?: Sponsor[];
        error?: string;
      };

      if (!response.ok)
        throw new Error(readApiError(payload, "Unable to load sponsors"));
      setSponsors(payload.sponsors ?? []);
    } catch (error) {
      logError("Error loading sponsors:", error);
      setLoadError(getErrorMessage(error) || "Unable to load sponsors");
      setSponsors([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div
        aria-label="Loading sponsors"
        className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6"
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-40 animate-pulse rounded-3xl bg-surface-secondary"
            />
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold">Sponsors wouldn&apos;t load</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{loadError}</p>
        <Button
          className="mt-5 rounded-full"
          variant="secondary"
          onPress={() => {
            setLoading(true);
            loadSponsors();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-14 px-4 py-12 sm:px-6 sm:py-16">
      <header className="mx-auto max-w-xl space-y-3 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Sponsors
        </h1>
        <p className="text-[15px] leading-relaxed text-muted">
          The organizations that keep our workshops free and our labs running.
        </p>
      </header>

      {sponsors.length === 0 ? (
        <Card className="mx-auto max-w-xl overflow-hidden">
          <Image
            alt="An empty billboard waiting for a name"
            className="h-48 w-full object-cover object-top"
            height={814}
            loading="lazy"
            src="/Assets/greymens-billboard.jpg"
            width={728}
          />
          <CardContent className="space-y-3 px-6 py-8 text-center">
            <h2 className="text-lg font-bold">This billboard is empty</h2>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-muted">
              We&apos;re a young club, and this wall is blank on purpose — the
              first names here will be real partners, not placeholders.
            </p>
            <a
              className="inline-flex items-center rounded-full bg-foreground px-6 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
              href="mailto:sponsors@greymens.club"
            >
              Put your name on it
            </a>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {sponsors.map((sponsor) => {
            const tierInfo =
              sponsorTiers[sponsor.tier as keyof typeof sponsorTiers];
            const body = (
              <>
                <span className="flex h-36 items-center justify-center p-6">
                  <Image
                    unoptimized
                    alt={sponsor.name}
                    className="max-h-full max-w-full object-contain grayscale"
                    height={160}
                    loading="lazy"
                    src={sponsor.logo}
                    width={320}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </span>
                <span className="flex items-center justify-between gap-2 border-t border-default-200/70 px-4 py-2.5">
                  <span className="truncate text-[13px] font-medium">
                    {sponsor.name}
                  </span>
                  <Chip size="sm" title={tierInfo?.label} variant="soft">
                    {tierInfo?.label ?? sponsor.tier}
                  </Chip>
                </span>
              </>
            );

            return (
              <li key={sponsor.$id}>
                <Card className="overflow-hidden">
                  {sponsor.website ? (
                    <a
                      aria-label={`${sponsor.name} (opens in new tab)`}
                      className="block rounded-[inherit] focus-visible:outline-2 focus-visible:outline-accent"
                      href={sponsor.website}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {body}
                    </a>
                  ) : (
                    body
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Separator />

      {/* Become a sponsor */}
      <section
        aria-label="Become a sponsor"
        className="mx-auto max-w-2xl space-y-5 text-center"
      >
        <h2 className="text-xl font-bold tracking-tight">Sponsor the club</h2>
        <p className="text-sm leading-relaxed text-muted">
          Money goes to venues, hardware, and travel to competitions — accounted
          openly under our Treasurer, per the Constitution&apos;s finance rules.
          In return: your name in front of students who actually build things,
          and first conversations with members entering the security industry.
        </p>
        <a
          className="inline-flex items-center rounded-full border border-default-300 px-6 py-2.5 text-sm font-semibold transition-colors hover:bg-surface-secondary"
          href="mailto:sponsors@greymens.club"
        >
          sponsors@greymens.club
        </a>
      </section>
    </div>
  );
}
