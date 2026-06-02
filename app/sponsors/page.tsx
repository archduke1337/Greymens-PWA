// app/sponsors/page.tsx
"use client";

import { Card, CardContent, CardHeader, CardFooter, Button, Chip, Separator } from "@heroui/react";
import { useState, useEffect } from "react";
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
          <Card className="max-w-2xl mx-auto shadow-sm">
            <CardContent className="text-center py-16 space-y-4">
              <div className="w-16 h-16 rounded-full bg-default-100 flex items-center justify-center mx-auto">
                <UsersIcon className="w-8 h-8 text-default-400" />
              </div>
              <h3 className="text-xl font-semibold">No Sponsors Yet</h3>
              <p className="text-default-500">Be the first to support our community</p>
              <Button
                as="a"
                href="mailto:sponsors@mindmesh.club"
                variant="primary"
              endContent={<ArrowRightIcon className="w-4 h-4" />}
              className="font-semibold"
            >
              Become a Sponsor
            </Button>
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