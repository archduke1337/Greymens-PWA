// components/PushToggle.tsx
// Per-device Web Push opt-in for the member inbox. Subscription existence
// IS the preference: on means this browser gets a tap for every notice,
// off (or never subscribed) means in-app + email only.
//
// iPhone honesty: Safari delivers push solely to the installed home-screen
// app (iOS 16.4+). A phone-browser tab that subscribes anyway hears nothing
// forever, so on an uninstalled iPhone the switch stays disabled behind an
// install note instead of performing a dead subscription.
"use client";

import { useEffect, useState } from "react";
import { Switch } from "@heroui/react";
import { toast } from "sonner";

import {
  getPushState,
  isPushSupported,
  needsInstallForPush,
  subscribePush,
  unsubscribePush,
  type PushState,
} from "@/lib/push-client";
import { logError } from "@/lib/logger";

export default function PushToggle() {
  const [state, setState] = useState<PushState>("unsubscribed");
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) {
      setState("unsupported");
      setChecking(false);

      return;
    }
    getPushState()
      .then(setState)
      .catch(() => setState("unsubscribed"))
      .finally(() => setChecking(false));
  }, []);

  const blockedByInstall = needsInstallForPush();

  const handleChange = async (next: boolean) => {
    setBusy(true);
    try {
      const result = next ? await subscribePush() : await unsubscribePush();

      setState(result);
      if (result === "subscribed") {
        toast.success("Push on — this device will tap you for every notice.");
      } else if (result === "denied") {
        toast.error(
          "Browser blocked notifications — allow them in site settings, then retry.",
        );
      } else if (next) {
        toast.error("Couldn't turn push on. Try again.");
      }
    } catch (error) {
      logError("Push toggle failed:", error);
      toast.error("Couldn't change push settings. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <div
        aria-label="Checking push status"
        className="rounded-2xl border border-default-200/70 p-4"
        role="status"
      >
        <p className="text-sm text-muted">Checking push status…</p>
      </div>
    );
  }

  if (state === "unsupported") {
    return (
      <div className="rounded-2xl border border-default-200/70 p-4">
        <p className="text-sm font-medium">Push notifications</p>
        <p className="mt-1 text-sm text-muted">
          This browser can&apos;t receive push — notices still land here and
          by email.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-default-200/70 p-4">
      <Switch
        isDisabled={busy || blockedByInstall}
        isSelected={state === "subscribed"}
        onChange={handleChange}
      >
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          Push notifications
        </Switch.Content>
      </Switch>
      <p className="mt-1.5 text-sm text-muted">
        {state === "subscribed"
          ? "On — this device gets a tap for every notice."
          : state === "denied"
            ? "Blocked — allow notifications in the browser's site settings, then flip this on."
            : "Off — turn on to get notices on this device too."}
      </p>
      {blockedByInstall && (
        <p className="mt-1.5 text-sm text-warning-700">
          On iPhone, push only reaches the installed app — add it via Share →
          Add to Home Screen first, then turn this on.
        </p>
      )}
    </div>
  );
}
