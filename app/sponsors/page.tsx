// app/sponsors/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader, CardFooter } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { title, subtitle } from "@/components/primitives";
import { sponsorService, Sponsor, sponsorTiers } from "@/lib/sponsors";
import { ExternalLinkIcon, MailIcon, TrendingUpIcon, UsersIcon, AwardIcon, SparklesIcon, ArrowRightIcon } from "lucide-react";

export default function SponsorsPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSponsors();
  }, []);

  const loadSponsors = async () => {
    try {
      const allSponsors = await sponsorService.getActiveSponsors();
      setSponsors(allSponsors);
    } catch (error) {
      console.error("Error loading sponsors:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-3 border-primary mx-auto" />
          <p className="text-default-500 font-medium">Loading sponsors...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

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
          <Card className="max-w-2xl mx-auto" shadow="sm">
            <CardBody className="text-center py-16 space-y-4">
              <div className="w-16 h-16 rounded-full bg-default-100 flex items-center justify-center mx-auto">
                <UsersIcon className="w-8 h-8 text-default-400" />
              </div>
              <h3 className="text-xl font-semibold">No Sponsors Yet</h3>
              <p className="text-default-500">Be the first to support our community</p>
              <Button
                as="a"
                href="mailto:sponsors@mindmesh.club"
                color="primary"
                variant="shadow"
                endContent={<MailIcon className="w-4 h-4" />}
              >
                Become a Sponsor
              </Button>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {sponsors.map((sponsor, index) => {
              const tierInfo = sponsorTiers[sponsor.tier as keyof typeof sponsorTiers];
              
              return (
                <Card
                  key={sponsor.$id}
                  isPressable
                  isHoverable
                  as="a"
                  href={sponsor.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group"
                  shadow="sm"
                  style={{
                    animationDelay: `${index * 30}ms`,
                    animation: 'fadeIn 0.5s ease-out forwards',
                    opacity: 0
                  }}
                >
                  <CardHeader className="absolute z-10 top-1 right-1">
                    <Chip 
                      size="sm" 
                      variant="flat"
                      classNames={{
                        base: `bg-gradient-to-r ${tierInfo.color} opacity-0 group-hover:opacity-100 transition-opacity`,
                        content: "text-white text-[10px] font-semibold px-1"
                      }}
                    >
                      {sponsor.tier.toUpperCase()}
                    </Chip>
                  </CardHeader>
                  
                  <CardBody className="p-6 flex items-center justify-center h-40">
                    <img
                      src={sponsor.logo}
                      alt={sponsor.name}
                      className="max-w-full max-h-full object-contain grayscale group-hover:grayscale-0 transition-all duration-300 group-hover:scale-110"
                    />
                  </CardBody>
                  
                  <CardFooter className="absolute bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
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
            })}
          </div>
        )}

        <Divider className="my-12" />

        {/* CTA */}
        <Card className="max-w-4xl mx-auto bg-gradient-to-br from-purple-500/10 to-pink-500/10" shadow="lg">
          <CardBody className="p-8 md:p-12 text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto">
              <AwardIcon className="w-10 h-10 text-white" />
            </div>
            
            <div className="space-y-3">
              <h2 className="text-3xl font-bold">Interested in Sponsoring?</h2>
              <p className="text-default-600 max-w-2xl mx-auto">
                Partner with MIND Mesh to support our community and connect with top talent
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-4 pt-4">
              <Card shadow="none" className="bg-white/50 dark:bg-default-100/50">
                <CardBody className="p-4 text-center space-y-2">
                  <TrendingUpIcon className="w-6 h-6 text-purple-500 mx-auto" />
                  <p className="text-sm font-semibold">Brand Visibility</p>
                  <p className="text-xs text-default-500">Reach 500+ students</p>
                </CardBody>
              </Card>

              <Card shadow="none" className="bg-white/50 dark:bg-default-100/50">
                <CardBody className="p-4 text-center space-y-2">
                  <UsersIcon className="w-6 h-6 text-pink-500 mx-auto" />
                  <p className="text-sm font-semibold">Talent Pipeline</p>
                  <p className="text-xs text-default-500">Connect with top talent</p>
                </CardBody>
              </Card>

              <Card shadow="none" className="bg-white/50 dark:bg-default-100/50">
                <CardBody className="p-4 text-center space-y-2">
                  <AwardIcon className="w-6 h-6 text-blue-500 mx-auto" />
                  <p className="text-sm font-semibold">Community Impact</p>
                  <p className="text-xs text-default-500">Support education</p>
                </CardBody>
              </Card>
            </div>

            <Button
              as="a"
              href="mailto:sponsors@mindmesh.club"
              color="primary"
              size="lg"
              variant="shadow"
              endContent={<ArrowRightIcon className="w-4 h-4" />}
              className="font-semibold"
            >
              Become a Sponsor
            </Button>
          </CardBody>
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