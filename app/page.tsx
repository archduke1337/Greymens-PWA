"use client";
import React, { useEffect, useState, Suspense, lazy } from 'react';
import { useRouter } from 'next/navigation';
import FeaturedSection from '@/components/FeaturedSection';
import GuitarStringDivider from '@/components/GuitarStringDivider';

// Dynamic import Three.js components to reduce initial bundle size
const ThreeCanvas = lazy(() => import('@/components/ThreeCanvas'));

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
        {/* Animated background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-float-delayed" />
        </div>

        <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10 px-4">
          {/* Hero Content */}
          <div className={`space-y-6 text-center lg:text-left transition-all duration-700 ease-out ${
            isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
            <div className="space-y-4">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold">
                <span className="bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent">
                  Mind Mesh
                </span>
              </h1>
              <h2 className="text-3xl sm:text-4xl font-semibold text-gray-700 dark:text-gray-300">
                Where Ideas Connect
              </h2>
            </div>
            
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-xl mx-auto lg:mx-0">
              Join our community of innovators, thinkers, and creators. 
              Connect, collaborate, and bring your ideas to life.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4">
              <button 
                onClick={() => router.push('/contact')}
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
              >
                Join the Club
              </button>
              <button 
                onClick={() => router.push('/about')}
                className="px-8 py-4 border-2 border-purple-600 text-purple-600 dark:text-purple-400 dark:border-purple-400 font-semibold rounded-full hover:bg-purple-50 dark:hover:bg-purple-950 transition-all duration-200"
              >
                Explore More
              </button>
            </div>
          </div>

          {/* 3D Model Canvas - Dynamically imported */}
          <div className={`flex justify-center lg:justify-end transition-all duration-700 ease-out delay-300 ${
            isLoaded ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
          }`}>
            <div className="relative">
              <Suspense fallback={
                <div className="w-full max-w-[500px] h-[500px] flex items-center justify-center">
                  <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              }>
                <ThreeCanvas />
              </Suspense>
            </div>
          </div>
        </div>
      </section>
      
      <GuitarStringDivider />
      <FeaturedSection />

      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) translateX(0px);
          }
          50% {
            transform: translateY(-20px) translateX(10px);
          }
        }

        @keyframes float-delayed {
          0%, 100% {
            transform: translateY(0px) translateX(0px);
          }
          50% {
            transform: translateY(15px) translateX(-15px);
          }
        }

        .animate-float {
          animation: float 8s ease-in-out infinite;
        }

        .animate-float-delayed {
          animation: float-delayed 10s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
