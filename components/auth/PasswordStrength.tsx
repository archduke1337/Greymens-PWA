// components/auth/PasswordStrength.tsx
// Plain-language password feedback for the register form. Four checks, a
// four-segment bar, no scores or jargon — the label says what to do next.
"use client";

function checks(password: string): Array<{ ok: boolean; label: string }> {
  return [
    { ok: password.length >= 8, label: "At least 8 characters" },
    {
      ok: /[a-z]/.test(password) && /[A-Z]/.test(password),
      label: "Upper and lower case",
    },
    { ok: /\d/.test(password), label: "A number" },
    { ok: /[^a-zA-Z0-9]/.test(password), label: "A symbol" },
  ];
}

export default function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  const results = checks(password);
  const passed = results.filter((c) => c.ok).length;
  const missing = results.find((c) => !c.ok);

  return (
    <div aria-live="polite" className="space-y-1.5">
      <div aria-hidden="true" className="flex gap-1.5">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={`h-1.5 flex-1 rounded-full ${
              index < passed
                ? passed >= 4
                  ? "bg-success-300"
                  : passed >= 2
                    ? "bg-warning-300"
                    : "bg-danger-900"
                : "bg-default-200"
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-muted">
        {passed >= 4 ? "Strong password." : `Add ${missing?.label.toLowerCase() ?? "more characters"}.`}
      </p>
    </div>
  );
}
