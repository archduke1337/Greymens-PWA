// app/sponsors/page.tsx
"use client";

import { useState, useEffect } from "react";
import { title } from "@/components/primitives";
import type { Sponsor } from "@/lib/sponsors";
import { sponsorTiers } from "@/lib/sponsors";
import { getErrorMessage } from "@/lib/errorHandler";

import { TrendingUpIcon, UsersIcon, AwardIcon } from "lucide-react";
import { Button, Card, CardContent, CardFooter, CardHeader, Chip, Separator } from "@heroui/react";

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
      const payload = (await response.json()) as { sponsors?: Sponsor[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to load sponsors");
      setSponsors(payload.sponsors ?? []);
    } catch (error) {
      console.error("Error loading sponsors:", error);
      setLoadError(getErrorMessage(error) || "Unable to load sponsors");
      setSponsors([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4" role="status" aria-label="Loading sponsors">
          <div className="animate-spin rounded-full h-12 w-12 border-b-3 border-primary mx-auto" />
          <p className="text-default-500 font-medium">Loading sponsors...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <Card>
          <CardContent className="text-center py-16 space-y-4">
            <h3 className="text-xl font-semibold">Couldn&apos;t load sponsors</h3>
            <p className="text-default-500">{loadError}</p>
            <Button
              variant="primary"
              onPress={() => {
                setLoading(true);
                loadSponsors();
              }}
            >
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="max-w-7xl mx-auto px-4 py-12 space-y-16">
        {/* Hero */}
        
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          
          
          <h1 className={title({ size: "lg" })}>
            Our <span className={title({ color: "violet", size: "lg" })}>Amazing Sponsors</span>
          </h1>
          
          <p className="text-default-600 text-lg">
            Thank you to these incredible organizations for supporting our community
          </p>
        </div>

        {/* Sponsors Grid */}
        {sponsors.length === 0 ? (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="text-center py-16 space-y-4">
              <div className="w-16 h-16 rounded-full bg-default-100 flex items-center justify-center mx-auto">
                <UsersIcon className="w-8 h-8 text-default-400" />
              </div>
              <h3 className="text-xl font-semibold">No Sponsors Yet</h3>
              <p className="text-default-500">Be the first to support our community</p>
              <a
                href="mailto:sponsors@greymens.club"
                className="inline-flex items-center px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-opacity"
              >
                Become a Sponsor
              </a>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {sponsors.map((sponsor, index) => {
              const tierInfo = sponsorTiers[sponsor.tier as keyof typeof sponsorTiers];
              const card = (
                <Card
                  className="motion-safe:animate-[fadeIn_0.5s_ease-out_both]"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <CardHeader className="absolute z-10 top-1 right-1">
                    <Chip
                      size="sm"
                      variant="primary"
                      title={tierInfo?.label}
                    >
                      {tierInfo?.label ?? sponsor.tier.toUpperCase()}
                    </Chip>
                  </CardHeader>

                  <CardContent className="p-6 flex items-center justify-center h-40">
                    <img
                      src={sponsor.logo}
                      alt={sponsor.name}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                      className="max-w-full max-h-full object-contain grayscale group-hover:grayscale-0 transition-all duration-300 group-hover:scale-110 motion-reduce:transform-none"
                    />
                  </CardContent>

                  <CardFooter className="absolute bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                    <div className="w-full space-y-1">
                      <p className="text-white text-xs font-semibold line-clamp-1">
                        {sponsor.name}
                      </p>
                      {sponsor.category && (
                        <p className="text-white/70 text-[10px] uppercase tracking-wider">
                          {sponsor.category}
                        </p>
                      )}
                    </div>
                  </CardFooter>
                </Card>
              );
              return sponsor.website ? (
                <a
                  key={sponsor.$id}
                  href={sponsor.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${sponsor.name} (opens in new tab)`}
                  className="group rounded-xl focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {card}
                </a>
              ) : (
                <div key={sponsor.$id} className="group">
                  {card}
                </div>
              );
            })}
          </div>
        )}

        <Separator className="my-12" />

        {/* CTA */}
        <Card className="max-w-4xl mx-auto bg-muted">
          <CardContent className="p-8 md:p-12 text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center mx-auto">
              <AwardIcon className="w-10 h-10 text-white" />
            </div>
            
            <div className="space-y-3">
              <h2 className="text-3xl font-bold">Interested in Sponsoring?</h2>
              <p className="text-default-600 max-w-2xl mx-auto">
                Partner with Greymens to support our community and connect with top talent
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-4 pt-4">
              <Card variant="secondary">
                <CardContent className="p-4 text-center space-y-2">
                  <TrendingUpIcon className="w-6 h-6 text-primary mx-auto" />
                  <p className="text-sm font-semibold">Brand Visibility</p>
                  <p className="text-xs text-default-500">Reach 500+ students</p>
                </CardContent>
              </Card>

              <Card variant="secondary">
                <CardContent className="p-4 text-center space-y-2">
                  <UsersIcon className="w-6 h-6 text-primary mx-auto" />
                  <p className="text-sm font-semibold">Talent Pipeline</p>
                  <p className="text-xs text-default-500">Connect with top talent</p>
                </CardContent>
              </Card>

              <Card variant="secondary">
                <CardContent className="p-4 text-center space-y-2">
                  <AwardIcon className="w-6 h-6 text-blue-500 mx-auto" />
                  <p className="text-sm font-semibold">Community Impact</p>
                  <p className="text-xs text-default-500">Support education</p>
                </CardContent>
              </Card>
            </div>

            <a
              href="mailto:sponsors@greymens.club"
              className="inline-flex items-center px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              Become a Sponsor
            </a>
          </CardContent>
        </Card>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}