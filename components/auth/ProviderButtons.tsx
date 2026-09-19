// components/auth/ProviderButtons.tsx
// Shared Google + GitHub sign-in buttons for the auth surfaces.
//
// Canonical HeroUI v3 social treatment (see Button docs "Social"): equal
// visual weight, neutral `tertiary` variant, real provider marks — the
// email submit keeps the page's single accent fill. Typing never assigns
// anything here; each button only starts its provider's token flow, and the
// parent disables both while either is pending.
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
        isDisabled={disabled}
        isPending={googlePending}
        variant="tertiary"
        onPress={onGoogle}
      >
        {({ isPending }) => (
          <>
            {isPending ? <Spinner color="current" size="sm" /> : <GoogleIcon />}
            {isPending ? "Connecting to Google…" : `${verb} Google`}
          </>
        )}
      </Button>
      <Button
        fullWidth
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
