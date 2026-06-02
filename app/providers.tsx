"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ThemeProvider as NextThemesProvider, type Attribute } from "next-themes";

export interface ProvidersProps {
  children: React.ReactNode;
  themeProps?: {
    attribute?: Attribute | Attribute[];
    defaultTheme?: string;
    storageKey?: string;
  };
}

export function Providers({ children, themeProps }: ProvidersProps) {
  return (
    <NextThemesProvider {...themeProps}>{children}</NextThemesProvider>
  );
}
