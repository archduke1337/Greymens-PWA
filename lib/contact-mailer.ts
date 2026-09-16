import { redactEmail } from "@/lib/validation";

export interface ContactMessage {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export type DeliveryResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY;
const DEFAULT_INBOX = "hello@mindmesh.club";

export function isMailerConfigured(): boolean {
  return Boolean(EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY);
}

/**
 * Delivers an inbound public message to the club inbox.
 *
 * Shared by the contact and feedback routes so both forms either really send or
 * clearly fail; neither should report success for a message that goes nowhere.
 */
export async function sendContactMessage(message: ContactMessage): Promise<DeliveryResult> {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
    // Configuration problem, not a client problem. Never surface which secret is missing.
    console.error("Outbound mail is not configured");
    return { ok: false, status: 503, error: "Message delivery is temporarily unavailable" };
  }

  try {
    const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: {
          from_name: message.name,
          from_email: message.email,
          subject: message.subject,
          message: message.message,
          to_email: process.env.CONTACT_INBOX_EMAIL || DEFAULT_INBOX,
        },
      }),
    });

    if (!response.ok) {
      console.error("Message delivery failed:", {
        status: response.status,
        from: redactEmail(message.email),
      });
      return { ok: false, status: 502, error: "Failed to send message" };
    }

    return { ok: true };
  } catch (error) {
    console.error("Message delivery request error:", error instanceof Error ? error.message : "unknown error");
    return { ok: false, status: 502, error: "Failed to send message" };
  }
}
