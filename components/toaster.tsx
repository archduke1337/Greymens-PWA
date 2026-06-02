"use client";

import { Toaster as SonnerToaster } from "sonner";
import { useTheme } from "next-themes";

export function Toaster() {
  const { theme } = useTheme();

  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      theme={theme as "light" | "dark" | undefined}
      toastOptions={{
        duration: 4000,
      }}
    />
  );
}
