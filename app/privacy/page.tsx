import type { Metadata } from "next";

import Link from "next/link";
import {
  Accordion,
  AccordionItem,
  AccordionHeading,
  AccordionTrigger,
  AccordionIndicator,
  AccordionPanel,
  AccordionBody,
  Card,
  Chip,
  Separator,
} from "@heroui/react";
import { Lock, EyeOff, UserCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Greymens Club collects, uses, and protects your personal data.",
};

const LAST_UPDATED = "September 18, 2026";

const SECTIONS = [
  {
    id: "collect",
    title: "What we collect",
    body: [
      "Account basics: your name, email, and whatever you add to your profile — bio, avatar, skills, and portfolio links. Profiles marked private stay private and never appear on public pages like Leadership.",
      "Membership and participation: applications, attendance, roles, offices, and contributions to events, projects, and competitions.",
      "Content you share: blog drafts and posts, gallery uploads, comments, and feedback — plus the metadata needed to review and attribute them.",
      "Operational traces: audit entries for governance actions (who approved what, and when), ticket registrations, and basic security logs that keep everyone's accounts safe.",
    ],
  },
  {
    id: "use",
    title: "How we use it",
    body: [
      "To run the club: membership decisions, event organization, tickets at the door, project coordination, and official notices.",
      "To recognize contribution: publishing your work with attribution, certificates, and the public leadership register — only with your opt-in.",
      "To keep people safe: verifying eligibility, enforcing the authorized-activity rule, investigating reports, and protecting Club systems.",
      "We never sell personal data. Anonymized, aggregate statistics (like headcounts) may be shared with sponsors — never individual records.",
    ],
  },
  {
    id: "sharing",
    title: "Who can see your data",
    body: [
      "Members see what you choose to make public: your opt-in profile, published posts, and event participation where relevant.",
      "Officers see what their role needs and nothing more. The Treasurer sees payment records; the Membership Lead sees applications; the Cybersecurity Lead sees security-relevant logs. This is least privilege, and it is enforced by the system — not by promise.",
      "Faculty Coordinators and institutional authorities may receive records where safety, discipline, or institutional compliance requires it.",
      "Our infrastructure provider (Appwrite) stores the data on our behalf. We don't hand personal data to advertisers, data brokers, or unrelated third parties.",
    ],
  },
  {
    id: "security",
    title: "How we protect it",
    body: [
      "Access is role-based and audited. Sensitive actions — grants, approvals, Coffee? No. Grants, approvals, role changes — leave an audit trail.",
      "Credentials and secrets are protected, never shared unnecessarily, and revoked when roles end. Club-controlled accounts belong to the Club, with named owners and handover paths.",
      "No system is perfect. If a breach affects your data, we will tell you what happened, what we did about it, and what you can do — promptly, not eventually.",
    ],
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: [
      "Active accounts: for as long as you are a member, plus the records the Charter requires us to keep (governance minutes, audit trail, financial records).",
      "After you leave: profile and participation data is removed or anonymized on request, except records we must retain for institutional, legal, or audit reasons — and we will tell you which ones those are.",
      "Published work with attribution stays published unless removal is agreed, since others may have built on it. We handle these case by case, fairly.",
    ],
  },
  {
    id: "rights",
    title: "Your rights",
    body: [
      "See what we hold about you, correct what's wrong, and ask for deletion where the Charter and institutional rules allow it.",
      "Control visibility: keep your profile private, stay off the public leadership page, and opt out of event photography in advance.",
      "Opt out of non-essential communications at any time. Official governance notices (like election announcements) may still reach you while you are a member.",
      "Write to privacy@greymens.club. A real officer — not an autoresponder — handles these requests.",
    ],
  },
  {
    id: "cookies",
    title: "Cookies and this website",
    body: [
      "We use the minimum needed to keep you signed in and remember preferences like theme. No advertising trackers, no cross-site profiling.",
      "Embedded content (event images, linked videos) may set its own cookies per that provider's policy. Your browser controls remain yours.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip color="accent" size="sm" variant="soft">
            <Lock aria-hidden="true" className="h-3.5 w-3.5" />
            Privacy Policy
          </Chip>
          <Chip size="sm" variant="soft">
            Last updated · {LAST_UPDATED}
          </Chip>
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Your data stays yours
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted">
          We collect the minimum needed to run a student club, protect it like
          it matters — because it does — and never sell it. Here is exactly what
          that means.
        </p>
      </header>

      <Card>
        <Card.Header>
          <Card.Title>The short version</Card.Title>
          <Card.Description>Three promises, kept by design</Card.Description>
        </Card.Header>
        <Card.Content>
          <ul className="grid gap-2.5 text-sm leading-relaxed text-muted sm:grid-cols-3">
            <li className="flex gap-2">
              <EyeOff
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-accent"
              />
              Private means private — your profile visibility choice is enforced
              everywhere.
            </li>
            <li className="flex gap-2">
              <UserCheck
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-accent"
              />
              Officers see only what their role needs. Everything sensitive is
              audited.
            </li>
            <li className="flex gap-2">
              <Lock
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-accent"
              />
              No sale of personal data, ever. Aggregates only, for sponsors.
            </li>
          </ul>
        </Card.Content>
      </Card>

      <Card>
        <Card.Content className="p-2 sm:p-4">
          <Accordion>
            {SECTIONS.map((section) => (
              <AccordionItem
                key={section.id}
                className="text-sm"
                id={section.id}
              >
                <AccordionHeading>
                  <AccordionTrigger>
                    {section.title}
                    <AccordionIndicator />
                  </AccordionTrigger>
                </AccordionHeading>
                <AccordionPanel>
                  <AccordionBody>
                    <div className="space-y-2.5">
                      {section.body.map((paragraph, index) => (
                        <p key={index} className="leading-relaxed text-muted">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </AccordionBody>
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        </Card.Content>
      </Card>

      <Separator />

      <p className="text-center text-sm text-muted">
        Questions about your data?{" "}
        <a
          className="font-medium text-foreground underline underline-offset-4"
          href="mailto:privacy@greymens.club"
        >
          privacy@greymens.club
        </a>{" "}
        · See also our{" "}
        <Link
          className="font-medium text-foreground underline underline-offset-4"
          href="/terms"
        >
          Terms of Service
        </Link>
        .
      </p>
    </div>
  );
}
