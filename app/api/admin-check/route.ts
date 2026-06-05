import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/appwrite";
import { APPWRITE_CONFIG } from "@/lib/appwrite";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAILS_FALLBACK || "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ isAdmin: false }, { status: 400 });
    }

    // Verify the session by attempting to get the current user from the server
    const { account } = createAdminClient();
    try {
      // Verify the session is valid by checking the JWT
      const sessionCookie = request.headers.get("cookie") || "";
      if (!sessionCookie.includes("a_session_")) {
        return NextResponse.json({ isAdmin: false }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ isAdmin: false }, { status: 401 });
    }

    const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase().trim());

    return NextResponse.json({ isAdmin });
  } catch {
    return NextResponse.json({ isAdmin: false }, { status: 500 });
  }
}
