"use client";
import React, { useEffect, useState, Suspense, lazy } from "react";
import { useRouter } from "next/navigation";

import FeaturedSection from "@/components/FeaturedSection";
import GuitarStringDivider from "@/components/GuitarStringDivider";

// Dynamic import Three.js components to reduce initial bundle size
const ThreeCanvas = lazy(() => import("@/components/ThreeCanvas"));

export default function Home() {
  const router = useRouter();
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
            className={`space-y-6 text-center lg:text-left transition-all duration-700 ease-out ${
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
              <button
                className="px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-lg shadow-sm hover:opacity-90 transition-opacity duration-150"
                onClick={() => router.push("/contact")}
              >
                Join the Club
              </button>
              <button
                className="px-8 py-4 border border-border text-foreground font-semibold rounded-lg hover:bg-muted transition-colors duration-150"
                onClick={() => router.push("/about")}
              >
                Explore More
              </button>
            </div>
          </div>

          {/* 3D Model Canvas - Dynamically imported */}
          <div
            className={`flex justify-center lg:justify-end transition-all duration-700 ease-out delay-300 ${
              isLoaded ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
            }`}
          >
            <div className="relative">
              <Suspense
                fallback={
                  <div className="w-full max-w-[500px] h-[500px] flex items-center justify-center">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                }
              >
                <ThreeCanvas />
              </Suspense>
            </div>
          </div>
        </div>
      </section>

      <GuitarStringDivider />
      <FeaturedSection />
    </div>
  );
}
