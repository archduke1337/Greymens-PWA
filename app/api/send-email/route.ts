import { sendContactMessage } from "@/lib/contact-mailer";
import { consumeRateLimit, getClientAddress } from "@/lib/rate-limit";
import {
  TEXT_LIMITS,
  isEmailAddress,
  isRecord,
  readString,
} from "@/lib/validation";
import { ok, fail } from "@/lib/api";

// This endpoint is unauthenticated and spends a metered third-party quota, so it
// is rate limited per client address.
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  const address = getClientAddress(request);
  const limited = consumeRateLimit(
    `send-email:${address}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );

  if (!limited.allowed) {
    return fail(
      "RATE_LIMITED",
      "Too many messages sent. Please try again shortly.",
      429,
      undefined,
      { "Retry-After": String(limited.retryAfter) },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION", "Invalid request body", 400);
  }

  if (!isRecord(body)) {
    return fail("VALIDATION", "Invalid request body", 400);
  }

  const name = readString(body.name, TEXT_LIMITS.name);
  const email = readString(body.email, TEXT_LIMITS.email);
  const subject = readString(body.subject, TEXT_LIMITS.subject);
  const message = readString(body.message, TEXT_LIMITS.message);

  if (!name || !email || !subject || !message) {
    return fail("VALIDATION", "Missing or invalid required fields", 400);
  }
  if (!isEmailAddress(email)) {
    return fail("VALIDATION", "Enter a valid email address", 400);
  }

  const result = await sendContactMessage({ name, email, subject, message });

  if (!result.ok) {
    return fail(
      result.status === 400
        ? "VALIDATION"
        : result.status === 401
          ? "UNAUTHENTICATED"
          : result.status === 403
            ? "FORBIDDEN"
            : result.status === 404
              ? "NOT_FOUND"
              : result.status === 409
                ? "CONFLICT"
                : result.status === 429
                  ? "RATE_LIMITED"
                  : "INTERNAL",
      result.error,
      result.status,
    );
  }

  return ok({ success: true });
}
