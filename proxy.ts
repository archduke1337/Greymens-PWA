import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Server-side admin email list (not exposed to client)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'sahilmanecode@gmail.com,mane50205@gmail.com')
  .split(',')
  .map((e) => e.trim());

// Protected admin routes
const ADMIN_ROUTES = ['/admin'];

// Protected API routes (require authentication)
const PROTECTED_API_ROUTES = ['/api/test-db'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if route is an admin route
  const isAdminRoute = ADMIN_ROUTES.some((route) => pathname.startsWith(route));

  // Check if route is a protected API route
  const isProtectedApi = PROTECTED_API_ROUTES.some((route) => pathname.startsWith(route));

  if (isAdminRoute || isProtectedApi) {
    // For admin routes, we check for Appwrite session cookie
    // Appwrite sets a session cookie named `a_session_<project_id>`
    // Since we can't decode JWT server-side without the secret,
    // we rely on the client-side check in admin/layout.tsx
    // BUT we add a basic server-side gate: redirect to login if no session hint

    const cookies = request.cookies;
    const hasSession = Array.from(cookies).some(
      ([name]) => name.startsWith('a_session_') && name !== 'a_session_'
    );

    // For admin routes, if no session cookie exists, redirect to login
    if (isAdminRoute && !hasSession) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // For protected API routes, require session cookie
    if (isProtectedApi && !hasSession) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
  }

  // Add security headers
  const response = NextResponse.next();

  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');

  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/test-db/:path*',
  ],
};
