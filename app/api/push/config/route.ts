import { NextRequest } from "next/server";

import { requireAuthenticatedUser } from "@/lib/server-auth";
import { isPushConfigured, pushPublicKey } from "@/lib/server-push";
import { ok, fail } from "@/lib/api";

/**
 * Public VAPID key for the browser subscribe flow. The private key never
 * leaves the server — the client needs only this to mint a subscription.
 */
export async function GET(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);

  if (!authenticated.user) return authenticated.response;

  if (!isPushConfigured()) {
    return fail("UNAVAILABLE", "Push notifications are not configured", 503);
  }

  return ok({ publicKey: pushPublicKey() });
}
