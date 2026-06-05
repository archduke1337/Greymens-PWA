import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_ROUTES = ["/admin"];
const PROTECTED_API_ROUTES = ["/api/test-db"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminRoute = ADMIN_ROUTES.some((route) => pathname.startsWith(route));
  const isProtectedApi = PROTECTED_API_ROUTES.some((route) => pathname.startsWith(route));

  if (isAdminRoute || isProtectedApi) {
    const cookies = request.cookies;
    const hasSession = Array.from(cookies).some(
      ([name]) => name.startsWith("a_session_") && name !== "a_session_"
    );

    if (isAdminRoute && !hasSession) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (isProtectedApi && !hasSession) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
  }

  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/test-db/:path*"],
};
