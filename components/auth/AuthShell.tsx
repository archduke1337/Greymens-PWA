// components/auth/AuthShell.tsx
// One layout for every auth page (login, register, forgot/reset password):
// art strip on small screens, art panel beside the form on large screens.
// A single place to keep spacing, radius, and captions consistent instead of
// copy-pasting the grid into each page.
"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { Card } from "@heroui/react";

interface AuthShellProps {
  artSrc: string;
  artAlt: string;
  caption: string;
  title: string;
  description: string;
  children: ReactNode;
}

export default function AuthShell({
  artSrc,
  artAlt,
  caption,
  title,
  description,
  children,
}: AuthShellProps) {
  return (
    <div className="mx-auto grid w-full max-w-5xl items-center gap-6 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:gap-10 lg:py-14">
      {/* Compact art strip on small screens */}
      <figure className="overflow-hidden rounded-3xl border border-default-200/70 lg:hidden">
        <Image
          alt=""
          aria-hidden="true"
          className="h-36 w-full object-cover object-top sm:h-44"
          height={1024}
          loading="lazy"
          src={artSrc}
          width={1536}
        />
      </figure>

      {/* Art panel on large screens */}
      <figure className="hidden space-y-3 lg:block">
        <div className="overflow-hidden rounded-3xl border border-default-200/70">
          <Image
            alt={artAlt}
            className="w-full object-cover"
            height={1024}
            src={artSrc}
            width={1536}
          />
        </div>
        <figcaption className="text-center text-sm text-muted">
          {caption}
        </figcaption>
      </figure>

      {/* Form */}
      <Card className="w-full">
        <Card.Header>
          <Card.Title>{title}</Card.Title>
          <Card.Description>{description}</Card.Description>
        </Card.Header>
        {children}
      </Card>
    </div>
  );
}
