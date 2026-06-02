"use client";

import { useState, useCallback } from "react";

/**
 * Compatibility wrapper for useDisclosure (removed in HeroUI v3).
 * Provides isOpen, onOpen, onClose, onOpenChange, onToggle.
 */
export function useDisclosure(defaultIsOpen = false) {
  const [isOpen, setIsOpen] = useState(defaultIsOpen);

  const onOpen = useCallback(() => setIsOpen(true), []);
  const onClose = useCallback(() => setIsOpen(false), []);
  const onOpenChange = useCallback((open: boolean) => setIsOpen(open), []);
  const onToggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return { isOpen, onOpen, onClose, onOpenChange, onToggle };
}

/**
 * Compatibility wrapper for SelectItem (removed in HeroUI v3).
 * Renders a simple <option> element inside a native <select>.
 */
export function SelectItem({
  children,
  key,
  textValue,
  value,
  ...props
}: {
  children: React.ReactNode;
  key?: string;
  textValue?: string;
  value?: string;
  [key: string]: unknown;
}) {
  return (
    <option key={key} value={value || key || textValue} {...props}>
      {children}
    </option>
  );
}

/**
 * Compatibility wrapper for AvatarGroup (removed in HeroUI v3).
 * Renders avatars in a flex container with overlap.
 */
export function AvatarGroup({
  children,
  max,
  className = "",
  ...props
}: {
  children: React.ReactNode;
  max?: number;
  className?: string;
  [key: string]: unknown;
}) {
  return (
    <div className={`flex -space-x-2 ${className}`} {...props}>
      {children}
    </div>
  );
}
