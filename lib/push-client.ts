// lib/push-client.ts
// Browser side of Web Push: permission, service-worker subscription, and
// saving that subscription to the server. Client-safe on purpose — no
// node-appwrite, no VAPID secrets (the public key comes from
// GET /api/push/config).
//
// Platform reality, stated plainly for the UI: Android Chrome subscribes
// from the browser. iPhone Safari only delivers push to an installed home-
// screen app (iOS 16.4+) — a phone browser tab can subscribe the API but
// Apple will never wake it. The settings toggle says so instead of failing
// mysteriously.

export type PushState =
  | "unsupported"
  | "denied"
  | "subscribed"
  | "unsubscribed";

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isIOS(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent;

  if (/iPad|iPhone|iPod/.test(ua)) return true;

  // iPadOS 13+ reports a desktop UA — touch points give it away.
  return (
    navigator.platform === "MacIntel" &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1
  );
}

/** True when running as an installed app (home screen / standalone). */
export function isInstalledApp(): boolean {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPhones that can receive push only after installing the app. */
export function needsInstallForPush(): boolean {
  return isIOS() && !isInstalledApp();
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));

  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);

  return out;
}

async function serviceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();

  if (existing) return existing;

  return navigator.serviceWorker.register("/sw.js");
}

/** Current device state: subscription present, permission denied, or neither. */
export async function getPushState(): Promise<PushState> {
  if (!isPushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();

    return subscription ? "subscribed" : "unsubscribed";
  } catch {
    return "unsubscribed";
  }
}

/**
 * Request permission and subscribe this device, saving the subscription
 * server-side. Returns the state afterwards — "denied" when the member
 * refuses, so the UI can explain instead of spinning.
 */
export async function subscribePush(): Promise<PushState> {
  if (!isPushSupported()) return "unsupported";

  const permission = await Notification.requestPermission();

  if (permission !== "granted") return "denied";

  const configResponse = await fetch("/api/push/config", {
    credentials: "include",
  });

  if (!configResponse.ok) return "unsubscribed";
  const config = (await configResponse.json().catch(() => null)) as {
    publicKey?: string;
  } | null;

  if (!config?.publicKey) return "unsubscribed";

  const registration = await serviceWorkerRegistration();
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(config.publicKey),
  });

  const saveResponse = await fetch("/api/push/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(subscription.toJSON()),
  });

  if (!saveResponse.ok) {
    await subscription.unsubscribe().catch(() => undefined);

    return "unsubscribed";
  }

  return "subscribed";
}

/** Remove this device's subscription locally and server-side. */
export async function unsubscribePush(): Promise<PushState> {
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;

      await subscription.unsubscribe().catch(() => undefined);
      await fetch(
        `/api/push/subscriptions?endpoint=${encodeURIComponent(endpoint)}`,
        { method: "DELETE", credentials: "include" },
      ).catch(() => undefined);
    }
  } catch {
    // Local teardown best-effort; the server prunes dead endpoints on send.
  }

  return getPushState();
}
