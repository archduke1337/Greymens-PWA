"use client";

import { useState, useEffect } from "react";
import { readApiError } from "@/lib/errorHandler";
import type { Sponsor } from "@/lib/sponsors";

export function FooterSponsors() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    void fetch("/api/sponsors", { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as { sponsors?: Sponsor[]; error?: string };
        if (!response.ok) throw new Error(readApiError(payload, "Unable to load sponsors"));
        setSponsors((payload.sponsors ?? []).slice(0, 6));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Error loading footer sponsors:", error);
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
              href={sponsor.website}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${sponsor.name} (opens in new tab)`}
              className="group"
            >
              <img
                src={sponsor.logo}
                alt={sponsor.name}
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
                className="w-20 h-20 object-contain grayscale group-hover:grayscale-0 transition-all duration-300"
              />
            </a>
          ) : null,
        )}
      </div>
    </div>
  );
}