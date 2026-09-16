"use client";

import { Toaster as SonnerToaster } from "sonner";
import { useTheme } from "next-themes";

export function Toaster() {
  // resolvedTheme reflects the effective appearance (never "system"), so
  // toasts match a system-following app instead of falling back to light.
  const { resolvedTheme } = useTheme();

  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      theme={(resolvedTheme === "dark" ? "dark" : "light") as "light" | "dark"}
      toastOptions={{
        duration: 4000,
      }}
    />
  );
}
