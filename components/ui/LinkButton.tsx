// components/ui/LinkButton.tsx
//
// Button-styled navigation without nested interactives.
//
// HeroUI v3's Button renders a <button> and accepts no href, so wrapping it
// in next/link produces <a><button></button></a> — invalid HTML that
// screen readers announce as two competing controls. This renders a single
// <a> with the exact buttonVariants classes instead: same visuals, valid
// markup, client-side navigation.
import type { ComponentProps, ReactNode } from "react";

import Link from "next/link";
import { buttonVariants } from "@heroui/react";

type VariantProps = NonNullable<Parameters<typeof buttonVariants>[0]>;

type LinkButtonProps = {
  href: ComponentProps<typeof Link>["href"];
  target?: string;
  rel?: string;
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
} & Pick<VariantProps, "variant" | "size" | "fullWidth" | "isIconOnly">;

export default function LinkButton({
  href,
  target,
  rel,
  ariaLabel,
  children,
  className,
  variant,
  size,
  fullWidth,
  isIconOnly,
}: LinkButtonProps) {
  return (
    <Link
      aria-label={ariaLabel}
      className={buttonVariants({
        variant,
        size,
        fullWidth,
        isIconOnly,
        className,
      })}
      href={href}
      rel={rel}
      target={target}
    >
      {children}
    </Link>
  );
}
