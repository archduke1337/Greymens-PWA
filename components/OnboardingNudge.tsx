// components/OnboardingNudge.tsx
// Repeat reminder for signed-in accounts that never submitted the onboarding
// form. Mounted in the root layout so it follows the member anywhere
// members go — dashboard, console included — except the form itself and
// auth pages, where it would nag instead of help.
//
// Deliberately persistent: dismissing ("Later") hides it only until the
// next navigation, then it returns. It stops for good exactly one way —
// submitting the form, after which the server reports exists: true.
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

const HIDDEN_PREFIXES = [
  "/onboarding",
  "/login",
  "/register",
  "/logout",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

export default function OnboardingNudge() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Fresh evaluation per page: a dismissal on the previous screen must
    // not leak a stale open modal (or a stale suppression) into this one.
    setShow(false);
    if (loading || !user) return;
    if (
      HIDDEN_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
      )
    ) {
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
    // Later means later this visit, not never: the next navigation
    // re-evaluates and shows it again for anyone still not onboarded.
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
