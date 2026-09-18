"use client";

import Link from "next/link";
import { ArrowUpRight, KeyRound } from "lucide-react";

import { usePermissions } from "@/context/PermissionContext";
import { accessiblePages } from "@/lib/governance";

/**
 * The places this member's roles, offices and powers actually open.
 *
 * Replaces the old "My Powers" card, which listed power *names* — a grant you
 * cannot act on is noise. This lists destinations instead, so a holder of, say,
 * `blog_creator` sees a link to the editor rather than the word "Blog Creator".
 *
 * Renders nothing for a wildcard account: an admin already has the console
 * sidebar, which is this same list, and would otherwise see every row.
 */
export default function AccessCard() {
  const { capabilities } = usePermissions();

  if (capabilities.includes("*")) return null;
  const pages = accessiblePages(capabilities);

  if (pages.length === 0) return null;

  return (
    <section
      aria-label="Your access"
      className="rounded-2xl border border-border bg-surface p-6"
    >
      <div className="mb-1 flex items-center gap-2">
        <KeyRound aria-hidden className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-semibold">Your access</h2>
      </div>
      <p className="mb-4 text-xs text-muted">
        Opened by your roles, offices and powers. Revocation takes effect
        immediately.
      </p>
      <div className="space-y-1">
        {pages.map((page) => (
          <Link
            key={page.href}
            className="group -mx-2 flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface-secondary"
            href={page.href}
          >
            <span className="truncate text-sm transition-colors group-hover:text-foreground">
              {page.label}
            </span>
            <ArrowUpRight
              aria-hidden
              className="ml-auto h-3.5 w-3.5 shrink-0 text-muted"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
