"use client";

import { useEffect, useState } from "react";
import { Toaster as SonnerToaster } from "sonner";
import { useTheme } from "next-themes";

export function Toaster() {
  // resolvedTheme reflects the effective appearance (never "system"), so
  // toasts match a system-following app instead of falling back to light.
  const { resolvedTheme } = useTheme();
  // Thumb-zone on phones: top-right toasts collide with the floating navbar
  // and sit outside thumb reach. Bottom-center on small screens, top-right
  // on desktop — tracked live across rotations and resizes.
  const [isPhone, setIsPhone] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const sync = () => setIsPhone(query.matches);

    sync();
    query.addEventListener("change", sync);

    return () => query.removeEventListener("change", sync);
  }, []);

  return (
    <SonnerToaster
      closeButton
      richColors
      position={isPhone ? "bottom-center" : "top-right"}
      theme={(resolvedTheme === "dark" ? "dark" : "light") as "light" | "dark"}
      toastOptions={{
        duration: 4000,
      }}
    />
  );
}
