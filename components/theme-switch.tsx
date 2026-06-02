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

  const onChange = () => {
    setTheme(isLight ? "dark" : "light");
  };

  return (
    <button
      role="switch"
      aria-label={`Switch to ${isLight ? "dark" : "light"} mode`}
      checked={isLight}
      onClick={onChange}
      className={clsx(
        "px-px transition-opacity hover:opacity-80 cursor-pointer",
        "inline-flex items-center justify-center w-auto h-auto",
        "bg-transparent rounded-lg",
        className
      )}
    >
      {isLight ? <SunFilledIcon size={22} /> : <MoonFilledIcon size={22} />}
    </button>
  );
};
