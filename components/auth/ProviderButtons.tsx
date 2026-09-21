// components/auth/ProviderButtons.tsx
// Shared Google + GitHub sign-in buttons for the auth surfaces.
//
// Bordered, full-height buttons with theme-aware marks (currentColor, never
// a fixed grey that reads "disabled" on dark). The email submit keeps the
// page's single accent fill; these stay neutral but unmistakably tappable.
// Typing never assigns anything here; each button only starts its
// provider's token flow, and the parent disables both while either is
// pending.
"use client";

import { Button, Spinner } from "@heroui/react";

import GitHubIcon from "@/components/auth/GitHubIcon";
import GoogleIcon from "@/components/auth/GoogleIcon";

interface ProviderButtonsProps {
  mode: "login" | "signup";
  disabled?: boolean;
  googlePending?: boolean;
  githubPending?: boolean;
  onGoogle: () => void;
  onGitHub: () => void;
}

export default function ProviderButtons({
  mode,
  disabled = false,
  googlePending = false,
  githubPending = false,
  onGoogle,
  onGitHub,
}: ProviderButtonsProps) {
  const verb = mode === "login" ? "Sign in with" : "Continue with";

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Button
        fullWidth
        className="h-12 rounded-2xl border border-default-200 bg-surface text-[15px] font-medium transition-colors hover:border-foreground/25 hover:bg-surface-secondary"
        isDisabled={disabled}
        isPending={googlePending}
        variant="tertiary"
        onPress={onGoogle}
      >
        {({ isPending }) => (
          <>
            {isPending ? (
              <Spinner color="current" size="sm" />
            ) : (
              <GoogleIcon />
            )}
            {isPending ? "Connecting to Google…" : `${verb} Google`}
          </>
        )}
      </Button>
      <Button
        fullWidth
        className="h-12 rounded-2xl border border-default-200 bg-surface text-[15px] font-medium transition-colors hover:border-foreground/25 hover:bg-surface-secondary"
        isDisabled={disabled}
        isPending={githubPending}
        variant="tertiary"
        onPress={onGitHub}
      >
        {({ isPending }) => (
          <>
            {isPending ? <Spinner color="current" size="sm" /> : <GitHubIcon />}
            {isPending ? "Connecting to GitHub…" : `${verb} GitHub`}
          </>
        )}
      </Button>
    </div>
  );
}
