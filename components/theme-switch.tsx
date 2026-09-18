"use client";

import { FC } from "react";
import { useTheme } from "next-themes";
import { useIsSSR } from "@react-aria/ssr";
import clsx from "clsx";

import { SunFilledIcon, MoonFilledIcon } from "@/components/icons";

export interface ThemeSwitchProps {
  className?: string;
}

export const ThemeSwitch: FC<ThemeSwitchProps> = ({ className }) => {
  const { theme, setTheme } = useTheme();
  const isSSR = useIsSSR();
  const isLight = theme === "light" || isSSR;
  const isDark = !isLight;

  const onChange = () => {
    setTheme(isLight ? "dark" : "light");
  };

  return (
    <button
      aria-checked={isDark}
      aria-label={`Switch to ${isLight ? "dark" : "light"} mode`}
      className={clsx(
        "px-px transition-opacity hover:opacity-80 cursor-pointer",
        "inline-flex items-center justify-center min-w-11 min-h-11",
        "bg-transparent rounded-lg",
        "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
        className,
      )}
      role="switch"
      onClick={onChange}
    >
      {isLight ? <SunFilledIcon size={22} /> : <MoonFilledIcon size={22} />}
    </button>
  );
};
