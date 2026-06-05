import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { name, email, type, subject, message } = await request.json();

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // TODO: Integrate with Resend or EmailJS when configured
    // For now, log the feedback server-side
    console.log("Feedback received:", { name, email, type, subject, message });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}
