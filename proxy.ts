/**
 * Request interception.
 *
 * Next.js 16 renamed this convention from `middleware.ts` to `proxy.ts` and
 * renamed the exported function accordingly; the old names are deprecated and
 * still work, but keeping both files would leave it ambiguous which one runs.
 * This file is the single interception point — there is deliberately no
 * `middleware.ts` beside it.
 *
 * What this file is allowed to do: decide whether a visitor is sent to the
 * login page, and send already-authenticated visitors away from the login and
 * registration pages. What it must never do: authorize. It only inspects the
 * presence of a session cookie, which proves nothing — a forged or expired
 * cookie passes here and is rejected later by the API routes and the server
 * data layer. Treating this as an access-control boundary is the mistake it
 * exists to avoid.
 */
import type { NextRequest } from "next/server";

import { NextResponse } from "next/server";

const protectedRoutes = [
  "/dashboard",
  "/admin",
  "/onboarding",
  "/profile",
  "/settings",
  "/notifications",
  "/security",
  "/resources",
];
const authRoutes = ["/login", "/register"];

/**
 * Match a path against a route prefix on segment boundaries, so that e.g.
 * `/resources` does not also match `/resources2`.
 */
function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Session presence is a routing hint only. Besides the native Appwrite
  // cookie, honor the first-party gm_session mirror (literal name kept here
  // to avoid pulling the SDK into the edge bundle; see SESSION_COOKIE_NAME
  // in lib/appwrite.ts). Without it, cross-domain logins pass the browser
  // check but bounce at every protected route.
  const hasSession = request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name === "gm_session" ||
        cookie.name.startsWith("a_session_") ||
        cookie.name === "a_session_legacy",
    );

  // Redirect logged-in users away from auth pages
  if (authRoutes.some((route) => matchesRoute(pathname, route)) && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Cookie presence is only a cheap pre-filter: it decides whether to send the
  // visitor to the login page. Real authorization lives in the API routes
  // (requireCapability) and is re-checked by the admin layout, so
  // this must never be treated as the access-control boundary.
  if (
    protectedRoutes.some((route) => matchesRoute(pathname, route)) &&
    !hasSession
  ) {
    const loginUrl = new URL("/login", request.url);

    loginUrl.searchParams.set("redirect", pathname);

    return NextResponse.redirect(loginUrl);
  }

  // Security headers are declared once in next.config.js so they also cover
  // routes outside this matcher.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/onboarding/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/notifications/:path*",
    "/security/:path*",
    "/resources/:path*",
    "/login",
    "/register",
  ],
};
