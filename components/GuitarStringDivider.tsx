"use client";
import { useEffect, useId, useRef } from "react";
import gsap from "gsap";

export default function GuitarStringDivider() {
  const stringRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const vibrationTimeline = useRef<gsap.core.Timeline | null>(null);
  const gradientId = useId();

  useEffect(() => {
    const string = stringRef.current;
    const path = pathRef.current;

    if (!string || !path) return;

    // Motion-sensitive visitors get a still string: no idle vibration, no
    // pointer bending, no snap-back.
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const initialPath = "M 50 100 Q 500 100 950 100";

    // 🎶 Smooth idle vibration setup
    const startVibration = () => {
      if (vibrationTimeline.current) vibrationTimeline.current.kill();

      const tl = gsap.timeline({ repeat: -1, yoyo: true });

      tl.to(path, {
        attr: { d: "M 50 100 Q 500 95 950 100" },
        duration: 0.5,
        ease: "sine.inOut",
      }).to(path, {
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

    // 🖱 Interactive bending (rAF-throttled so pointer storms don't jank).
    let bending = false;
    let lastEvent: MouseEvent | null = null;
    const applyBend = () => {
      bending = false;
      if (!lastEvent) return;
      const e = lastEvent;

      lastEvent = null;
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
    const handleMouseMove = (e: MouseEvent) => {
      lastEvent = e;
      if (!bending) {
        bending = true;
        requestAnimationFrame(applyBend);
      }
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

  const glowId = `${gradientId}-glow`;
  const neonGradientId = `${gradientId}-neon`;

  return (
    <div aria-hidden="true" className="relative w-full py-6 overflow-hidden">
      <div ref={stringRef} className="relative w-full h-24">
        <svg
          className="w-full h-full"
          preserveAspectRatio="none"
          viewBox="0 0 1000 200"
        >
          <defs>
            <linearGradient id={neonGradientId} x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="#00FF88" />
              <stop offset="50%" stopColor="#39FF14" />
              <stop offset="100%" stopColor="#7FFF00" />
            </linearGradient>
            <filter id={glowId} x="-20%" y="-50%" width="140%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="4.5" result="blur" />
              <feColorMatrix
                type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1.4 0"
                result="brightBlur"
              />
              <feMerge>
                <feMergeNode in="brightBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Keep legacy gradient id for backwards compat if referenced elsewhere */}
            <linearGradient id={gradientId} x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="#00FF88" />
              <stop offset="50%" stopColor="#39FF14" />
              <stop offset="100%" stopColor="#7FFF00" />
            </linearGradient>
          </defs>

          {/* Glow layer */}
          <path
            d="M 50 100 Q 500 100 950 100"
            fill="none"
            stroke={`url(#${neonGradientId})`}
            strokeLinecap="round"
            strokeWidth="7"
            opacity="0.35"
            style={{ filter: `url(#${glowId})` }}
          />
          {/* Core neon string */}
          <path
            ref={pathRef}
            d="M 50 100 Q 500 100 950 100"
            fill="none"
            stroke={`url(#${neonGradientId})`}
            strokeLinecap="round"
            strokeWidth="3.5"
            style={{ filter: `url(#${glowId})` }}
          />
        </svg>
      </div>
    </div>
  );
}
