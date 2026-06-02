"use client";

import { Card, CardContent, CardFooter, Chip, Button, Avatar, Separator } from "@heroui/react";
import { useState, useEffect, useRef } from "react";
export default function TeamPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const coreTeam = [
    {
      name: "Alex Johnson",
      role: "President & Founder",
      avatar: "https://i.pravatar.cc/300?img=12",
      linkedin: "https://linkedin.com/in/alexjohnson",
      github: "https://github.com/alexjohnson",
      bio: "Visionary leader with 8+ years in tech. Passionate about building communities that drive innovation.",
      achievements: ["Forbes 30 Under 30", "TEDx Speaker"],
      color: "secondary" as const },
    {
      name: "Sarah Chen",
      role: "Vice President",
      avatar: "https://i.pravatar.cc/300?img=45",
      linkedin: "https://linkedin.com/in/sarahchen",
      github: "https://github.com/sarahchen",
      bio: "Strategic thinker with MBA from Stanford. Expert in scaling communities and driving engagement.",
      achievements: ["Top 100 Women in Tech", "Community Builder"],
      color: "primary" as const },
    {
      name: "Marcus Williams",
      role: "Technical Lead",
      avatar: "https://i.pravatar.cc/300?img=33",
      linkedin: "https://linkedin.com/in/marcuswilliams",
      github: "https://github.com/marcuswilliams",
      bio: "Full-stack engineer and open-source contributor. Building scalable solutions for tomorrow.",
      achievements: ["GitHub Stars 50k+", "Tech Innovation Award"],
      color: "warning" as const },
    {
      name: "Emily Rodriguez",
      role: "Creative Director",
      avatar: "https://i.pravatar.cc/300?img=47",
      linkedin: "https://linkedin.com/in/emilyrodriguez",
      github: "https://github.com/emilyrodriguez",
      bio: "Award-winning designer with a keen eye for aesthetics. Creating experiences that inspire.",
      achievements: ["Webby Award Winner", "Design Excellence"],
      color: "danger" as const },
    {
      name: "David Kim",
      role: "Operations Manager",
      avatar: "https://i.pravatar.cc/300?img=68",
      linkedin: "https://linkedin.com/in/davidkim",
      github: "https://github.com/davidkim",
      bio: "Operations expert with background in logistics. Making things run like clockwork.",
      achievements: ["Excellence in Operations", "Process Optimizer"],
      color: "success" as const },
    {
      name: "Maya Patel",
      role: "Community Manager",
      avatar: "https://i.pravatar.cc/300?img=49",
      linkedin: "https://linkedin.com/in/mayapatel",
      github: "https://github.com/mayapatel",
      bio: "Community advocate with heart. Connecting people and fostering meaningful relationships.",
      achievements: ["Community Champion", "Engagement Expert"],
      color: "primary" as const },
  ];

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        if (e.deltaY > 0) {
          // Scroll down - next
          if (currentIndex < coreTeam.length - 1) {
            setDirection("right");
            setTimeout(() => {
              setCurrentIndex(currentIndex + 1);
              setDirection(null);
            }, 50);
          }
        } else {
          // Scroll up - previous
          if (currentIndex > 0) {
            setDirection("left");
            setTimeout(() => {
              setCurrentIndex(currentIndex - 1);
              setDirection(null);
            }, 50);
          }
        }
      }, 100);
    };

    const container = document.getElementById('team-card-container');
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [currentIndex, coreTeam.length]);

  const handleNext = () => {
    if (currentIndex < coreTeam.length - 1) {
      setDirection("right");
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
        setDirection(null);
      }, 50);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setDirection("left");
      setTimeout(() => {
        setCurrentIndex(currentIndex - 1);
        setDirection(null);
      }, 50);
    }
  };

  const currentMember = coreTeam[currentIndex];

  return (
    <section className="flex flex-col items-center justify-center w-full min-h-screen relative overflow-hidden py-8 md:py-12">
      {/* Subtle Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-50/30 via-pink-50/20 to-blue-50/30 dark:from-purple-950/5 dark:via-pink-950/5 dark:to-blue-950/5" />
      </div>

      <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="space-y-8 md:space-y-12">
          {/* Header */}
          <div className="text-center space-y-4">
            <Chip 
              color="secondary" 
              variant="primary"
                onPress={handleNext}
                isDisabled={currentIndex === coreTeam.length - 1}
                size="sm"
                className="hover:scale-110 transition-transform disabled:opacity-30"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </Button>
            </div>

            {/* Counter */}
            <div className="text-center mt-4">
              <p className="text-xs text-default-500">
                <span className="text-sm font-semibold text-foreground">{currentIndex + 1}</span>
                <span className="mx-1">/</span>
                <span>{coreTeam.length}</span>
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 max-w-4xl mx-auto">
            {[
              { label: "Team Members", value: "6+" },
              { label: "Years Experience", value: "40+" },
              { label: "Events Organized", value: "150+" },
              { label: "Community Size", value: "8K+" },
            ].map((stat) => (
              <Card key={stat.label} className="border-none shadow-sm">
                <CardContent className="text-center p-4">
                  <p className="text-2xl md:text-3xl font-bold text-secondary">
                    {stat.value}
                  </p>
                  <p className="text-xs md:text-sm text-default-600 mt-1">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .perspective-1200 {
          perspective: 1200px;
        }
      `}</style>
    </section>
  );
}