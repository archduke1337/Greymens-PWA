import { sendContactMessage } from "@/lib/contact-mailer";
import { consumeRateLimit, getClientAddress } from "@/lib/rate-limit";
import {
  TEXT_LIMITS,
  isEmailAddress,
  isRecord,
  readOptionalString,
  readString,
} from "@/lib/validation";
import { ok, fail } from "@/lib/api";

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;

const FEEDBACK_TYPES = new Map<string, string>([
  ["bug", "Bug Report"],
  ["feature", "Feature Request"],
  ["support", "Support"],
  ["general", "General Feedback"],
]);

export async function POST(request: Request) {
  const address = getClientAddress(request);
  const limited = consumeRateLimit(
    `feedback:${address}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );

  if (!limited.allowed) {
    return fail(
      "RATE_LIMITED",
      "Too many submissions. Please try again shortly.",
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
  const email = readOptionalString(body.email, TEXT_LIMITS.email);
  const subject = readString(body.subject, TEXT_LIMITS.subject);
  const message = readString(body.message, TEXT_LIMITS.message);
  const type = readString(body.type, 20) || "general";
  const typeLabel = FEEDBACK_TYPES.get(type);

  if (!name || !subject || !message) {
    return fail("VALIDATION", "Missing or invalid required fields", 400);
  }
  if (!typeLabel) {
    return fail("VALIDATION", "Invalid feedback type", 400);
  }
  if (email === null || (email && !isEmailAddress(email))) {
    return fail("VALIDATION", "Enter a valid email address", 400);
  }

  // The type is carried in the subject line so the existing inbox template routes
  // it without any template change.
  const result = await sendContactMessage({
    name,
    // Anonymous feedback carries no sender: record that honestly instead of
    // forging a same-domain address the club never owns in this context.
    email: email || "anonymous (no address given)",
    subject: `[${typeLabel}] ${subject}`,
    message,
  });

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
