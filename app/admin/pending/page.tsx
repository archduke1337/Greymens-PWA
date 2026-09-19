"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import { Button, Card, CardContent, Chip, Spinner } from "@heroui/react";

import { logError } from "@/lib/logger";

interface PendingItem {
  id: string;
  title: string;
  detail?: string;
  submitterName?: string | null;
  createdAt?: string;
}

interface QueueGroup {
  key: string;
  href: string;
  label: string;
  items: PendingItem[];
}

/** "3d ago" / "today" — enough to judge how stale a queue is at a glance. */
function age(createdAt?: string): string {
  if (!createdAt) return "";

  const days = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000),
  );

  if (!Number.isFinite(days) || days < 0) return "";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";

  return `${days}d ago`;
}

export default function PendingOverviewPage() {
  const [groups, setGroups] = useState<QueueGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setFailed(false);
      const response = await fetch("/api/admin/pending", {
        credentials: "include",
      });

      if (!response.ok) throw new Error("Unable to load pending work");
      const payload = (await response.json().catch(() => null)) as {
        queues?: QueueGroup[];
      } | null;

      setGroups((payload?.queues ?? []).filter((g) => g.items.length > 0));
    } catch (error) {
      logError("Failed to load the pending overview:", error);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <header className="mb-6 md:mb-8">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Awaiting review
        </h1>
        <p className="mt-1 text-sm text-default-500 md:text-base">
          Everything waiting on a decision, across the areas you can decide —
          newest first, ten per queue. Open a queue to see the rest.
        </p>
      </header>

      {loading && (
        <div className="flex justify-center py-16" role="status">
          <Spinner size="lg" />
          <span className="sr-only">Loading pending work</span>
        </div>
      )}

      {!loading && failed && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg text-default-600">
              Couldn&apos;t load what&apos;s pending.
            </p>
            <p className="mt-1 text-sm text-default-500">
              Nothing was denied — the request failed. Retrying is safe.
            </p>
            <Button className="mt-4" variant="primary" onPress={() => load()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !failed && total === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Inbox aria-hidden className="mb-3 size-8 text-default-400" />
            <p className="text-lg font-medium">Nothing is waiting on you</p>
            <p className="mt-1 max-w-md text-sm text-default-500">
              Every submission in your areas has been decided. New ones appear
              here — and as a count beside each console section.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !failed && total > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((group) => (
            <Card key={group.key} className="border-none shadow-md">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-bold">{group.label}</h2>
                  <Chip size="sm" variant="soft">
                    {group.items.length}
                    {group.items.length === 10 ? "+" : ""}
                  </Chip>
                </div>
                <ul className="divide-y divide-separator">
                  {group.items.map((item) => (
                    <li key={item.id} className="py-2.5">
                      <p className="truncate font-medium">{item.title}</p>
                      <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-default-500">
                        {item.detail && <span>{item.detail}</span>}
                        {item.submitterName && (
                          <span>{item.submitterName}</span>
                        )}
                        {age(item.createdAt) && (
                          <span>{age(item.createdAt)}</span>
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
                <Link
                  className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                  href={group.href}
                >
                  Open queue
                  <ArrowRight aria-hidden className="size-3.5" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
