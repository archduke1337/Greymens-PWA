"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ThemeProvider as NextThemesProvider, type Attribute } from "next-themes";
import { HeroUIProvider } from "@heroui/react";

export interface ProvidersProps {
  children: React.ReactNode;
  themeProps?: {
    attribute?: Attribute | Attribute[];
    defaultTheme?: string;
    storageKey?: string;
  };
}

declare module "@react-types/shared" {
  interface RouterConfig {
    routerOptions: NonNullable<
      Parameters<ReturnType<typeof useRouter>["push"]>[1]
    >;
  }
}

export function Providers({ children, themeProps }: ProvidersProps) {
  const router = useRouter();

  return (
    <NextThemesProvider {...themeProps}>{children}</NextThemesProvider>
  );
}
