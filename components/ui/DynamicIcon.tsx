"use client";

import * as Lucide from "lucide-react";

/**
 * Renders a lucide icon by name. Falls back to text when the name is not a
 * known lucide export — this keeps old rows that still store an emoji visible
 * until the next seed, instead of rendering nothing.
 */
export function DynamicIcon({
  name,
  className = "w-5 h-5",
  fallback,
}: {
  name?: string | null;
  className?: string;
  fallback?: React.ReactNode;
}) {
  if (!name) return fallback ? <>{fallback}</> : null;
  const Icon = (Lucide as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name];
  if (Icon) return <Icon className={className} aria-hidden="true" />;
  // Legacy emoji or unknown string: render as text so old data stays visible
  return <span aria-hidden="true" className={className}>{name}</span>;
}

/**
 * For the 12x12 colored square that used to show `{icon || firstLetter}`.
 * Shows the lucide icon when known, otherwise the first letter.
 */
export function IconBadge({
  name,
  fallbackLetter,
  className = "w-6 h-6 text-white",
}: {
  name?: string | null;
  fallbackLetter: string;
  className?: string;
}) {
  if (!name) {
    return <span aria-hidden="true">{fallbackLetter.charAt(0).toUpperCase()}</span>;
  }
  const Icon = (Lucide as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name];
  if (Icon) return <Icon className={className} aria-hidden="true" />;
  // If stored value is an emoji (legacy), show it; else show first letter
  const isEmoji = /\p{Extended_Pictographic}/u.test(name);
  if (isEmoji) return <span aria-hidden="true">{name}</span>;
  return <span aria-hidden="true">{fallbackLetter.charAt(0).toUpperCase()}</span>;
}
