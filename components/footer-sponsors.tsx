"use client";

import type { Sponsor } from "@/lib/sponsors";

import { useState, useEffect } from "react";
import Image from "next/image";

import { readApiError } from "@/lib/errorHandler";
import { logError } from "@/lib/logger";

export function FooterSponsors() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    void fetch("/api/sponsors", { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as {
          sponsors?: Sponsor[];
          error?: string;
        };

        if (!response.ok)
          throw new Error(readApiError(payload, "Unable to load sponsors"));
        setSponsors((payload.sponsors ?? []).slice(0, 6));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        logError("Error loading footer sponsors:", error);
      });

    return () => controller.abort();
  }, []);

  if (sponsors.length === 0) return null;

  return (
    <div className="border-t border-default-200 pt-8 mt-8">
      <div className="text-center mb-6">
        <p className="text-sm text-default-500 font-semibold">
          PROUDLY SUPPORTED BY
        </p>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-6 items-center justify-items-center opacity-60 hover:opacity-100 transition-opacity">
        {sponsors.map((sponsor) =>
          sponsor.website ? (
            <a
              key={sponsor.$id}
              aria-label={`${sponsor.name} (opens in new tab)`}
              className="group"
              href={sponsor.website}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Image
                alt={sponsor.name}
                className="w-20 h-20 object-contain grayscale group-hover:grayscale-0 transition-all duration-300"
                height={80}
                loading="lazy"
                src={sponsor.logo}
                width={80}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </a>
          ) : null,
        )}
      </div>
    </div>
  );
}
