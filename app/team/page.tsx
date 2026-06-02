"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardBody, CardFooter } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import { Avatar } from "@heroui/avatar";
import { Divider } from "@heroui/divider";

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
      color: "secondary" as const,
    },
    {
      name: "Sarah Chen",
      role: "Vice President",
      avatar: "https://i.pravatar.cc/300?img=45",
      linkedin: "https://linkedin.com/in/sarahchen",
      github: "https://github.com/sarahchen",
      bio: "Strategic thinker with MBA from Stanford. Expert in scaling communities and driving engagement.",
      achievements: ["Top 100 Women in Tech", "Community Builder"],
      color: "primary" as const,
    },
    {
      name: "Marcus Williams",
      role: "Technical Lead",
      avatar: "https://i.pravatar.cc/300?img=33",
      linkedin: "https://linkedin.com/in/marcuswilliams",
      github: "https://github.com/marcuswilliams",
      bio: "Full-stack engineer and open-source contributor. Building scalable solutions for tomorrow.",
      achievements: ["GitHub Stars 50k+", "Tech Innovation Award"],
      color: "warning" as const,
    },
    {
      name: "Emily Rodriguez",
      role: "Creative Director",
      avatar: "https://i.pravatar.cc/300?img=47",
      linkedin: "https://linkedin.com/in/emilyrodriguez",
      github: "https://github.com/emilyrodriguez",
      bio: "Award-winning designer with a keen eye for aesthetics. Creating experiences that inspire.",
      achievements: ["Webby Award Winner", "Design Excellence"],
      color: "danger" as const,
    },
    {
      name: "David Kim",
      role: "Operations Manager",
      avatar: "https://i.pravatar.cc/300?img=68",
      linkedin: "https://linkedin.com/in/davidkim",
      github: "https://github.com/davidkim",
      bio: "Operations expert with background in logistics. Making things run like clockwork.",
      achievements: ["Excellence in Operations", "Process Optimizer"],
      color: "success" as const,
    },
    {
      name: "Maya Patel",
      role: "Community Manager",
      avatar: "https://i.pravatar.cc/300?img=49",
      linkedin: "https://linkedin.com/in/mayapatel",
      github: "https://github.com/mayapatel",
      bio: "Community advocate with heart. Connecting people and fostering meaningful relationships.",
      achievements: ["Community Champion", "Engagement Expert"],
      color: "primary" as const,
    },
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
              variant="flat" 
              size="md"
            >
              Our Leadership
            </Chip>
            
            <div className="space-y-3">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
                Meet Our Team
              </h1>
              
              <p className="text-sm md:text-base text-default-600 max-w-2xl mx-auto">
                Passionate individuals dedicated to building an extraordinary community
              </p>
            </div>
          </div>

          {/* Card Display */}
          <div className="relative" id="team-card-container">
            <div className="max-w-lg mx-auto">
              {/* Card Stack */}
              <div className="relative h-[480px] sm:h-[500px] perspective-1200">
                {coreTeam.map((member, index) => {
                  const position = index - currentIndex;
                  const isActive = position === 0;
                  const isVisible = Math.abs(position) <= 2;

                  if (!isVisible) return null;

                  const translateX = position * 8;
                  const translateY = Math.abs(position) * 10;
                  const scale = 1 - Math.abs(position) * 0.05;
                  const opacity = 1 - Math.abs(position) * 0.4;
                  const zIndex = 20 - Math.abs(position);
                  const blur = Math.abs(position) * 1.5;

                  return (
                    <div
                      key={member.name}
                      className="absolute inset-0 transition-all duration-500 ease-out"
                      style={{
                        transform: `
                          translateX(${direction === 'right' ? translateX - 20 : direction === 'left' ? translateX + 20 : translateX}px)
                          translateY(${translateY}px)
                          scale(${scale})
                        `,
                        opacity: direction ? (isActive ? 0.3 : opacity) : opacity,
                        zIndex,
                        filter: `brightness(${isActive ? 1 : 0.7}) blur(${blur}px)`,
                        pointerEvents: isActive ? 'auto' : 'none',
                      }}
                    >
                      <Card 
                        className="h-full border-none overflow-hidden"
                        shadow="lg"
                      >
                        <CardBody className="p-6 md:p-8 relative overflow-hidden">
                          <div className="relative z-10 space-y-5">
                            {/* Avatar */}
                            <div className="flex justify-center">
                              <Avatar
                                src={member.avatar}
                                className="w-24 h-24 md:w-28 md:h-28 text-large"
                                isBordered
                                color={member.color}
                              />
                            </div>

                            {/* Name & Role */}
                            <div className="text-center space-y-2">
                              <h2 className="text-xl md:text-2xl font-bold">
                                {member.name}
                              </h2>
                              <Chip 
                                color={member.color} 
                                variant="flat"
                                size="sm"
                                className="font-medium"
                              >
                                {member.role}
                              </Chip>
                            </div>

                            {/* Bio */}
                            <p className="text-center text-default-600 text-sm md:text-base leading-relaxed">
                              {member.bio}
                            </p>

                            <Divider />

                            {/* Achievements */}
                            <div className="flex flex-wrap gap-2 justify-center">
                              {member.achievements.map((achievement) => (
                                <Chip
                                  key={achievement}
                                  size="sm"
                                  variant="bordered"
                                  color={member.color}
                                  className="text-xs"
                                >
                                  {achievement}
                                </Chip>
                              ))}
                            </div>
                          </div>
                        </CardBody>

                        <CardFooter className="flex flex-col gap-3 p-6 md:p-8 pt-0">
                          {/* Social Links */}
                          <div className="flex justify-center gap-2 w-full">
                            <Button
                              isIconOnly
                              as="a"
                              href={member.linkedin}
                              target="_blank"
                              rel="noopener noreferrer"
                              variant="flat"
                              color={member.color}
                              className="hover:scale-110 transition-transform"
                              size="md"
                              aria-label="LinkedIn Profile"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                              </svg>
                            </Button>
                            <Button
                              isIconOnly
                              as="a"
                              href={member.github}
                              target="_blank"
                              rel="noopener noreferrer"
                              variant="flat"
                              color={member.color}
                              className="hover:scale-110 transition-transform"
                              size="md"
                              aria-label="GitHub Profile"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                              </svg>
                            </Button>
                          </div>

                          {/* Connect Button */}
                          <Button
                            as="a"
                            href={member.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            color={member.color}
                            size="md"
                            className="w-full font-medium"
                            endContent={
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                            }
                          >
                            Connect
                          </Button>
                        </CardFooter>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Instructions */}
            <div className="text-center mt-4 mb-6">
              <p className="text-xs md:text-sm text-default-500">
                Scroll or use arrows to navigate
              </p>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-center gap-4 md:gap-6">
              <Button
                isIconOnly
                color="secondary"
                variant="flat"
                onPress={handlePrev}
                isDisabled={currentIndex === 0}
                size="sm"
                className="hover:scale-110 transition-transform disabled:opacity-30"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </Button>

              {/* Progress Dots */}
              <div className="flex items-center gap-2">
                {coreTeam.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      if (index !== currentIndex) {
                        setDirection(index > currentIndex ? "right" : "left");
                        setTimeout(() => {
                          setCurrentIndex(index);
                          setDirection(null);
                        }, 50);
                      }
                    }}
                    className={`rounded-full transition-all duration-300 ${
                      index === currentIndex 
                        ? 'h-2 w-10 bg-secondary' 
                        : 'h-2 w-2 bg-default-300 hover:bg-default-400'
                    }`}
                    aria-label={`View ${coreTeam[index].name}`}
                  />
                ))}
              </div>

              <Button
                isIconOnly
                color="secondary"
                variant="flat"
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
              <Card key={stat.label} className="border-none" shadow="sm">
                <CardBody className="text-center p-4">
                  <p className="text-2xl md:text-3xl font-bold text-secondary">
                    {stat.value}
                  </p>
                  <p className="text-xs md:text-sm text-default-600 mt-1">{stat.label}</p>
                </CardBody>
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