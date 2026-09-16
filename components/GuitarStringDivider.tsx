"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";

export default function GuitarStringDivider() {
  const stringRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const vibrationTimeline = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const string = stringRef.current;
    const path = pathRef.current;
    if (!string || !path) return;

    const initialPath = "M 50 100 Q 500 100 950 100";

    // 🎶 Smooth idle vibration setup
    const startVibration = () => {
      if (vibrationTimeline.current) vibrationTimeline.current.kill();

      const tl = gsap.timeline({ repeat: -1, yoyo: true });
      tl.to(path, {
        attr: { d: "M 50 100 Q 500 95 950 100" },
        duration: 0.5,
        ease: "sine.inOut",
      })
        .to(path, {
          attr: { d: "M 50 100 Q 500 105 950 100" },
          duration: 0.5,
          ease: "sine.inOut",
        });
      vibrationTimeline.current = tl;
    };

    const stopVibration = () => {
      vibrationTimeline.current?.kill();
      vibrationTimeline.current = null;
    };

    // 🖱 Interactive bending
    const handleMouseMove = (e: MouseEvent) => {
      stopVibration();

      const rect = string.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const scaledX = (x / rect.width) * 1000;
      const scaledY = (y / rect.height) * 200;

      const newPath = `M 50 100 Q ${scaledX} ${scaledY} 950 100`;

      gsap.to(path, {
        attr: { d: newPath },
        duration: 0.3,
        ease: "power3.out",
      });
    };

    const handleMouseLeave = () => {
      gsap.to(path, {
        attr: { d: initialPath },
        duration: 1.2,
        ease: "elastic.out(1, 0.2)",
        onComplete: startVibration, // restart vibration when mouse leaves
      });
    };

    string.addEventListener("mousemove", handleMouseMove);
    string.addEventListener("mouseleave", handleMouseLeave);

    startVibration(); // start idle vibration on load

    return () => {
      string.removeEventListener("mousemove", handleMouseMove);
      string.removeEventListener("mouseleave", handleMouseLeave);
      stopVibration();
    };
  }, []);

  return (
    <div className="relative w-full py-6 overflow-hidden">
      <div
        ref={stringRef}
        id="string"
        className="relative w-full h-24 cursor-pointer"
      >
        <svg
          className="w-full h-full"
          viewBox="0 0 1000 200"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="stringGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="50%" stopColor="#ec4899" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
          </defs>

          <path
            ref={pathRef}
            d="M 50 100 Q 500 100 950 100"
            stroke="url(#stringGradient)"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
