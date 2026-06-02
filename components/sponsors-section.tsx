// components/sponsors-section.tsx
"use client";

import React from "react";
import { Card } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Sponsor, sponsorTiers } from "@/lib/sponsors";

interface SponsorsSectionProps {
  sponsors: Sponsor[];
  title?: string;
  showTiers?: boolean;
}

export function SponsorsSection({ 
  sponsors, 
  title = "Our Sponsors",
  showTiers = true 
}: SponsorsSectionProps) {
  // Group sponsors by tier
  const sponsorsByTier = sponsors.reduce((acc, sponsor) => {
    if (!acc[sponsor.tier]) {
      acc[sponsor.tier] = [];
    }
    acc[sponsor.tier].push(sponsor);
    return acc;
  }, {} as Record<string, Sponsor[]>);

  const tierOrder = ["platinum", "gold", "silver", "bronze", "partner"];

  return (
    <section className="py-16 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">{title}</h2>
          <p className="text-lg text-default-600">
            Thank you to our amazing sponsors for supporting our community
          </p>
        </div>

        {showTiers ? (
          // Display by tiers
          <div className="space-y-12">
            {tierOrder.map((tier) => {
              const tierSponsors = sponsorsByTier[tier];
              if (!tierSponsors || tierSponsors.length === 0) return null;

              const tierInfo = sponsorTiers[tier as keyof typeof sponsorTiers];

              return (
                <div key={tier}>
                  <div className="flex items-center justify-center mb-8">
                    <Chip
                      className={`bg-gradient-to-r ${tierInfo.color} text-white font-bold px-6 py-2 text-lg`}
                      size="lg"
                    >
                      {tierInfo.label}
                    </Chip>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 items-center justify-items-center">
                    {tierSponsors.map((sponsor) => (
                      <a
                        key={sponsor.$id}
                        href={sponsor.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group"
                      >
                        <Card className="p-6 hover:shadow-xl transition-all duration-300 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
                          <img
                            src={sponsor.logo}
                            alt={sponsor.name}
                            className="w-full h-auto object-contain grayscale group-hover:grayscale-0 transition-all duration-300"
                            style={{ maxWidth: tierInfo.maxWidth }}
                          />
                        </Card>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Simple grid display
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 items-center justify-items-center">
            {sponsors.map((sponsor) => (
              <a
                key={sponsor.$id}
                href={sponsor.website}
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <img
                  src={sponsor.logo}
                  alt={sponsor.name}
                  className="w-24 h-24 object-contain grayscale group-hover:grayscale-0 transition-all duration-300"
                />
              </a>
            ))}
          </div>
        )}

        {/* Become a Sponsor CTA */}
        <div className="mt-16 text-center">
          <Card className="p-8 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
            <h3 className="text-2xl font-bold mb-4">Interested in Sponsoring?</h3>
            <p className="text-default-600 mb-6">
              Partner with us to support our community and gain visibility among talented students
            </p>
            <a
              href="mailto:sponsors@mindmesh.club"
              className="inline-block px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-semibold hover:shadow-lg transition-all"
            >
              Become a Sponsor
            </a>
          </Card>
        </div>
      </div>
    </section>
  );
}