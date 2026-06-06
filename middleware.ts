import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedRoutes = ["/dashboard", "/admin", "/onboarding", "/profile", "/settings", "/notifications"];
const authRoutes = ["/login", "/register"];
const adminRoutes = ["/admin"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for session cookie (Appwrite uses a_session_legacy or a_session_<project>)
  const hasSession = request.cookies.getAll().some(
    (cookie) => cookie.name.startsWith("a_session_") || cookie.name === "a_session_legacy"
  );

  // Redirect logged-in users away from auth pages
  if (authRoutes.some((route) => pathname.startsWith(route)) && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Check protected routes
  if (protectedRoutes.some((route) => pathname.startsWith(route))) {
    if (!hasSession) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Basic admin route check (full role check happens client-side)
    if (adminRoutes.some((route) => pathname.startsWith(route))) {
      // We can't check admin status server-side with client-side auth
      // The PermissionContext handles this client-side
    }
  }

  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/onboarding/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/notifications/:path*",
    "/login",
    "/register",
  ],
};
