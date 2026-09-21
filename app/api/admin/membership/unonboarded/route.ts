import { NextRequest } from "next/server";

import { requireCapability } from "@/lib/access-control";
import { listNonOnboardedContacts } from "@/lib/server-onboarding";
import { ok, fail } from "@/lib/api";
import { logError } from "@/lib/logger";

const LIST_LIMIT = 300;

/**
 * Accounts that registered but never started the onboarding form (no
 * profile row). Feeds the membership console's "Not onboarded" tab and the
 * notification composer's recipient preview — both need the same list.
 */
export async function GET(request: NextRequest) {
  const authenticated = await requireCapability(
    request,
    "membership.view_applications",
  );

  if (!authenticated.user) return authenticated.response;

  try {
    const contacts = await listNonOnboardedContacts(LIST_LIMIT + 1);

    return ok({
      contacts: contacts.slice(0, LIST_LIMIT).map((contact) => ({
        userId: contact.userId,
        name: contact.name,
        email: contact.email,
        createdAt: contact.createdAt,
      })),
      total: contacts.length,
      capped: contacts.length > LIST_LIMIT,
    });
  } catch (error) {
    logError("Non-onboarded lookup error:", error);

    return fail("INTERNAL", "Unable to load non-onboarded accounts", 500);
  }
}
