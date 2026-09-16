/**
 * Validation for profile writes, shared by the member-facing `/api/profile`
 * route and the administrator console.
 *
 * Two callers with different trust levels use these rules, which is exactly why
 * they live in one place: if the console had its own copy, the two would drift
 * and the looser one would become the effective contract. Lengths track the
 * Appwrite column sizes, so a request that passes validation here can never be
 * rejected by the database afterwards.
 */

const STRING_FIELDS = new Map<string, number>([
  ["bio", 5000],
  ["githubUrl", 500],
  ["linkedinUrl", 500],
  ["portfolioUrl", 500],
  ["phone", 50],
  ["urn", 50],
  ["program", 100],
  ["branch", 100],
  ["year", 20],
  ["semester", 20],
  ["address", 2000],
  ["dateOfBirth", 30],
]);

const URL_FIELDS = new Set(["githubUrl", "linkedinUrl", "portfolioUrl"]);

// Constrained fields must match the unions declared in lib/types.
const ENUM_FIELDS = new Map<string, readonly string[]>([
  [
    "pronouns",
    ["he/him", "she/her", "they/them", "he/they", "she/they", "prefer_to_say"],
  ],
  ["gender", ["male", "female", "other", "prefer_not_to_say"]],
  ["availability", ["full", "partial", "event_only"]],
  ["profileVisibility", ["public", "members_only", "private"]],
]);

const ARRAY_FIELDS = new Map<string, number>([
  ["skills", 50],
  ["interests", 50],
]);

/**
 * The governance tiers an administrator may assign directly.
 *
 * Only `admin` and `dev` appear here, because only they are *stored* rather
 * than derived. Membership status lives on the membership row, seniority lives
 * on designation assignments, and existence lives on the profile — so there is
 * no `status` column on `profiles` and no writable status enum. Assigning a
 * value like `member` or `lead` means changing the record that owns it, which
 * is why the console exposes membership and designation actions separately.
 */
export const GOVERNANCE_ROLES = ["admin", "dev"] as const;

export const EDITABLE_PROFILE_FIELDS = new Set([
  ...STRING_FIELDS.keys(),
  ...ENUM_FIELDS.keys(),
  ...ARRAY_FIELDS.keys(),
  "showOnAboutPage",
]);

export function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);

    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export type ProfilePatchResult =
  { data: Record<string, unknown> } | { error: string };

/**
 * Validate a profile patch.
 *
 * `unknownFields` decides what happens to keys outside the allowlist:
 *  - `"reject"` (default) is for member self-service, where an unexpected key
 *    means the caller is probing for a field it should not be able to set.
 *  - `"ignore"` is for the administrator console, which round-trips a whole
 *    profile document and therefore legitimately carries immutable keys such as
 *    `$id`, `userId` and `avatar`. Those are dropped rather than written, so
 *    ignoring cannot become mass assignment.
 */
export function validateProfilePatch(
  body: Record<string, unknown>,
  options: { unknownFields?: "reject" | "ignore" } = {},
): ProfilePatchResult {
  const unknownFields = options.unknownFields ?? "reject";

  if (unknownFields === "reject") {
    const unknownField = Object.keys(body).find(
      (key) => !EDITABLE_PROFILE_FIELDS.has(key),
    );

    if (unknownField) {
      return { error: `Field "${unknownField}" cannot be updated here` };
    }
  }

  const data: Record<string, unknown> = {};

  for (const [field, maxLength] of STRING_FIELDS) {
    if (body[field] === undefined) continue;
    const value = body[field];

    if (value !== null && typeof value !== "string")
      return { error: `Invalid ${field}` };
    const text = typeof value === "string" ? value.trim() : "";

    if (text.length > maxLength) return { error: `Invalid ${field}` };
    if (URL_FIELDS.has(field) && text.length > 0 && !isValidHttpUrl(text)) {
      return { error: `Invalid ${field}` };
    }
    data[field] = text || null;
  }

  for (const [field, allowed] of ENUM_FIELDS) {
    if (body[field] === undefined) continue;
    const value = body[field];

    if (value === null || value === "") {
      data[field] = null;
      continue;
    }
    if (typeof value !== "string" || !allowed.includes(value))
      return { error: `Invalid ${field}` };
    data[field] = value;
  }

  for (const [field, maxItems] of ARRAY_FIELDS) {
    if (body[field] === undefined) continue;
    const value = body[field];

    if (!Array.isArray(value)) return { error: `Invalid ${field}` };
    const cleaned: string[] = [];

    for (const item of value) {
      if (typeof item !== "string") return { error: `Invalid ${field}` };
      const trimmed = item.trim();

      if (!trimmed || trimmed.length > 100)
        return { error: `Invalid ${field}` };
      if (!cleaned.includes(trimmed)) cleaned.push(trimmed);
    }
    if (cleaned.length > maxItems) return { error: `Invalid ${field}` };
    data[field] = cleaned;
  }

  if (body.showOnAboutPage !== undefined) {
    if (typeof body.showOnAboutPage !== "boolean")
      return { error: "Invalid showOnAboutPage" };
    data.showOnAboutPage = body.showOnAboutPage;
  }

  return { data };
}

/**
 * The governance role is separated from `validateProfilePatch` because only an
 * administrator may set it. Keeping it out of the shared allowlist means a
 * member calling `/api/profile` cannot escalate themselves even if the shared
 * validator is later loosened.
 */
export function validateGovernanceRole(value: unknown): "admin" | "dev" | null {
  if (typeof value !== "string") return null;
  const role = value.trim();

  return (GOVERNANCE_ROLES as readonly string[]).includes(role)
    ? (role as "admin" | "dev")
    : null;
}
