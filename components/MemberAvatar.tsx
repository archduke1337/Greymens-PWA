"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@heroui/react";

interface MemberAvatarProps {
  /** Uploaded profile-picture URL. When absent, the name initial shows. */
  src?: string | null;
  /** Person's display name: alt text + fallback initial source. */
  name?: string | null;
  className?: string;
}

/**
 * Single avatar renderer for people everywhere: uploaded picture first,
 * name initial second, "?" last. Centralized so a new person-avatar surface
 * cannot accidentally ship as initials-only when a picture exists. Sizing
 * comes from className (e.g. "w-8 h-8") to match each surface.
 */
export default function MemberAvatar({ src, name, className }: MemberAvatarProps) {
  const label = (name ?? "").trim();
  return (
    <Avatar className={className}>
      {src ? <AvatarImage src={src} alt={label || "Member"} /> : null}
      <AvatarFallback>{label.charAt(0).toUpperCase() || "?"}</AvatarFallback>
    </Avatar>
  );
}
