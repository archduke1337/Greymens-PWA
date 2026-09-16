import { NextRequest } from "next/server";
import { getAuthenticatedUser, isAdminUser } from "@/lib/server-auth";
import { ok, fail, ApiError } from "@/lib/api";

/**
 * Reports whether the currently authenticated session belongs to an
 * administrator.
 *
 * The request body is deliberately ignored. An earlier version trusted a
 * client-supplied `email`, so anyone could obtain `{ isAdmin: true }` by
 * sending an address listed in ADMIN_EMAILS alongside any `a_session_` cookie.
 * Admin identity is now resolved from the verified session only.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return fail("UNAUTHENTICATED", "Unauthorized", 401);
  }

  return ok({ isAdmin: await isAdminUser(user) });
}
