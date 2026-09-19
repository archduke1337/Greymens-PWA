"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input, Spinner } from "@heroui/react";
import { Search, UserRound, X } from "lucide-react";

import { readApiError } from "@/lib/errorHandler";
import { logError } from "@/lib/logger";

export interface MemberCandidate {
  userId: string;
  name: string;
  urn: string;
}

interface MemberPickerProps {
  query: string;
  onQueryChange: (query: string) => void;
  /** Fired when the admin picks a row — the label is `Name (URN)`-shaped. */
  onSelect: (userId: string, label: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

/**
 * Name/URN member picker for governance assignment flows.
 *
 * The consoles used to demand raw account ids, which no human knows — the
 * admin had to find the id elsewhere and paste it in. This picker searches
 * server-side (`GET /api/admin/members/search`, names via the Users API,
 * URNs via profiles) and hands back the chosen account id. Typing never
 * assigns: only an explicit pick does, so a near-miss can never attach the
 * wrong person.
 */
export default function MemberPicker({
  query,
  onQueryChange,
  onSelect,
  placeholder = "Search by name or URN…",
  ariaLabel = "Search members by name or URN",
}: MemberPickerProps) {
  const [results, setResults] = useState<MemberCandidate[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [failed, setFailed] = useState(false);
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = query.trim();

    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      setOpen(false);

      return;
    }
    setSearching(true);
    setFailed(false);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(
            `/api/admin/members/search?q=${encodeURIComponent(term)}&limit=8`,
            { credentials: "include", signal: controller.signal },
          );
          const payload = (await response.json()) as {
            candidates?: MemberCandidate[];
            error?: string;
          };

          if (!response.ok)
            throw new Error(readApiError(payload, "Unable to search members"));
          if (controller.signal.aborted) return;
          setResults(payload.candidates ?? []);
          setActiveIndex(-1);
          setOpen(true);
        } catch (error) {
          if (controller.signal.aborted) return;
          logError("MemberPicker search error:", error);
          setFailed(true);
          setResults([]);
          setOpen(true);
        } finally {
          if (!controller.signal.aborted) setSearching(false);
        }
      })();
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  // Close on outside click — the dropdown is positioned, not modal.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);

    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const pick = (candidate: MemberCandidate) => {
    const label =
      candidate.name && candidate.urn
        ? `${candidate.name} (${candidate.urn})`
        : candidate.name || candidate.urn || candidate.userId;

    onSelect(candidate.userId, label);
    setOpen(false);
  };

  const showDropdown = open && (searching || failed || results.length > 0);

  return (
    <div ref={containerRef} className="relative flex-1">
      <Input
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={showDropdown}
        aria-label={ariaLabel}
        placeholder={placeholder}
        role="combobox"
        value={query}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onQueryChange(e.target.value)
        }
        onFocus={() => {
          if (results.length > 0 || failed) setOpen(true);
        }}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Escape") {
            setOpen(false);
          } else if (e.key === "ArrowDown" && results.length > 0) {
            e.preventDefault();
            setOpen(true);
            setActiveIndex((i) => (i + 1) % results.length);
          } else if (e.key === "ArrowUp" && results.length > 0) {
            e.preventDefault();
            setActiveIndex((i) => (i - 1 + results.length) % results.length);
          } else if (e.key === "Enter" && open && activeIndex >= 0) {
            const candidate = results[activeIndex];

            if (candidate) {
              e.preventDefault();
              pick(candidate);
            }
          }
        }}
      />
      {query && (
        <button
          aria-label="Clear member search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-default-400 hover:text-default-700"
          type="button"
          onClick={() => {
            onQueryChange("");
            setResults([]);
            setOpen(false);
          }}
        >
          <X aria-hidden="true" className="w-4 h-4" />
        </button>
      )}
      {showDropdown && (
        <div
          aria-label="Matching members"
          className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
          id={listId}
          role="listbox"
        >
          {searching ? (
            <div className="flex items-center gap-2 p-3 text-sm text-default-500">
              <Spinner size="sm" />
              Searching…
            </div>
          ) : failed ? (
            <p className="p-3 text-sm text-danger">
              Search failed — type the full URN and press Add instead.
            </p>
          ) : (
            results.map((candidate, index) => (
              <button
                key={candidate.userId}
                aria-selected={index === activeIndex}
                className={`flex w-full items-center gap-3 p-2.5 text-left text-sm transition-colors hover:bg-surface-secondary ${
                  index === activeIndex ? "bg-surface-secondary" : ""
                }`}
                role="option"
                type="button"
                onClick={() => pick(candidate)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-default-100">
                  <UserRound
                    aria-hidden="true"
                    className="h-4 w-4 text-default-500"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {candidate.name || "Unnamed account"}
                  </span>
                  <span className="block truncate font-mono text-xs text-default-400">
                    {candidate.urn || candidate.userId.slice(0, 12) + "…"}
                  </span>
                </span>
              </button>
            ))
          )}
          {!searching && !failed && (
            <p className="flex items-center gap-1.5 border-t border-border px-3 py-2 text-xs text-default-400">
              <Search aria-hidden="true" className="h-3 w-3" />
              Pick a person, or paste a full URN and press Add.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
