// components/OnboardingNudge.tsx
// One-shot-per-session reminder for signed-in accounts that never submitted
// the onboarding form. Mounted in the root layout so it follows the member
// anywhere — except the form itself, auth pages, and the console, where it
// would nag instead of help. Dismissal lasts the session; submitting the
// form silences it forever (the server then reports exists: true).
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Button,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";

import { useAuth } from "@/context/AuthContext";

const DISMISSED_KEY = "onboarding-nudge-dismissed";

const HIDDEN_PREFIXES = [
  "/onboarding",
  "/login",
  "/register",
  "/logout",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/admin",
];

export default function OnboardingNudge() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    if (
      HIDDEN_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
      )
    ) {
      return;
    }
    try {
      if (sessionStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      return;
    }

    let cancelled = false;
    // A beat after load: greeting the member first, interrupting second.
    const timer = setTimeout(() => {
      fetch("/api/onboarding", {
        credentials: "include",
        cache: "no-store",
      })
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as {
            exists?: boolean;
          } | null;

          if (!cancelled && response.ok && payload?.exists !== true) {
            setShow(true);
          }
        })
        .catch(() => {});
    }, 1500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loading, user, pathname]);

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Storage unavailable: the popup simply returns next navigation.
    }
    setShow(false);
  };

  const goToOnboarding = () => {
    dismiss();
    router.push("/onboarding");
  };

  if (!show) return null;

  return (
    <Modal>
      <ModalBackdrop
        isOpen={show}
        onOpenChange={(next) => {
          if (!next) dismiss();
        }}
      >
        <ModalContainer>
          <ModalDialog>
            <ModalHeader>One step left — join the club properly</ModalHeader>
            <ModalBody>
              <p className="text-sm leading-relaxed text-muted">
                You have an account, but you haven&apos;t filled the
                onboarding form yet — and that form is what turns an account
                into a membership. No application, no member events, no
                departments, no vote. It takes a few minutes, and the club
                is better with you in it.
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="secondary" onPress={dismiss}>
                Later
              </Button>
              <Button variant="primary" onPress={goToOnboarding}>
                Complete onboarding
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
}
