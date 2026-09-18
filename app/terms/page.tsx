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
import { FileText, Handshake, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The plain-English terms for membership, events, and content in Greymens Club.",
};

const LAST_UPDATED = "September 18, 2026";

const SECTIONS = [
  {
    id: "who",
    title: "Who these terms cover",
    body: [
      "These terms apply to everyone who joins Greymens Club, attends our events, posts on the blog or gallery, or uses this website — members, officers, volunteers, and guests alike.",
      "The club operates inside ADYPU and the School of Engineering. Where these terms conflict with institutional policy or the law, the higher authority wins.",
      "Our Constitution & Governance Charter is the governing document. These terms are the everyday version; the Charter prevails if they ever disagree.",
    ],
  },
  {
    id: "membership",
    title: "Membership and eligibility",
    body: [
      "Membership is open to ADYPU students of any program — your branch never limits which technical areas you can explore.",
      "Admission runs through the published membership process, and the Executive Board may set reasonable participation criteria for Active Member status (for example, showing up and contributing). Criteria are published before any vote they affect, and never used to engineer outcomes.",
      "Membership can be paused or ended for misconduct, following the Charter's fair process: notice, a chance to respond, and a proportionate decision. Protective restrictions (like temporary access suspension) are safety measures, not verdicts.",
    ],
  },
  {
    id: "responsibilities",
    title: "Your responsibilities",
    body: [
      "Treat people with respect. No harassment, intimidation, discrimination, or retaliation against anyone who reports a concern in good faith.",
      "The non-negotiable rule: membership is not permission to access, scan, exploit, or disrupt any system. Every security activity needs explicit, verifiable authorization with a defined scope — target, time, technique, and purpose.",
      "Protect credentials, private communications, and Club systems entrusted to you. If you find a vulnerability through Club activity, preserve evidence and follow responsible disclosure instead of publishing it.",
      "Only authorized people may speak for the Club, commit it to positions or spending, or use its name, logo, and channels.",
    ],
  },
  {
    id: "events",
    title: "Events, tickets, and attendance",
    body: [
      "Most events are free for members. Where a fee applies, the event page states it plainly, including what is refundable and until when.",
      "Your ticket is personal. Door teams check registration status, and waitlisted or pending registrations are exactly that — not confirmed seats.",
      "Paid event fees are refundable in full until 7 days before the event. Membership involves no mandatory fee; any voluntary contribution is confirmed in writing before you pay.",
      "Photos and videos may be taken at events for Club records and publications. Tell the organizers in advance if you prefer to opt out, and we will respect it.",
    ],
  },
  {
    id: "content",
    title: "Things you publish with us",
    body: [
      "Blog posts, gallery uploads, project write-ups, and comments go through the relevant review (editorial, moderation, or portfolio) before or shortly after publication.",
      "You keep ownership of your work subject to institutional rules and any project agreement you signed. By publishing with us you grant the Club a limited license to display and distribute it as part of Club channels, with attribution.",
      "Don't plagiarize, misrepresent others' work, or publish sensitive details — especially vulnerability specifics, private data, or anything outside an authorized scope.",
      "We may remove content that breaks these terms, the Charter, or institutional policy, and we will tell you why.",
    ],
  },
  {
    id: "accounts",
    title: "Accounts, access, and security",
    body: [
      "Your account is yours alone. Don't share passwords or session access, and tell us promptly if you suspect compromise.",
      "Technical access follows least privilege: you get what your role needs, for as long as it needs it. Access ends when the role ends.",
      "Club-controlled repositories, servers, domains, accounts, and records belong to the Club or the Institution — not to whoever created them. Every critical resource has a named owner and a handover path.",
      "If something looks wrong — a suspicious login, a leaked secret, a possible incident — report it through the security report page. Good-faith reports are never treated as misconduct, even if the concern turns out to be unfounded.",
    ],
  },
  {
    id: "liability",
    title: "Safety, liability, and common sense",
    body: [
      "Workshops and labs involve real tools. Follow safety instructions, stay within authorized environments, and ask before trying something you are unsure about.",
      "You participate at your own risk. The Club is not liable for injuries or losses except where the law does not allow such a limitation.",
      "External partnerships, sponsorships, and competitions follow institutional approval processes. No officer can bind the Institution without going through them.",
    ],
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: [
      "We review these terms at least once each academic year, alongside the Charter.",
      "Material changes are announced to members before they take effect. Continuing to participate after the effective date means you accept the updated terms.",
      "Questions? Write to legal@greymens.club or talk to the General Secretary — a human will answer.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip color="accent" size="sm" variant="soft">
            <FileText aria-hidden="true" className="h-3.5 w-3.5" />
            Member agreement
          </Chip>
          <Chip size="sm" variant="soft">
            Last updated · {LAST_UPDATED}
          </Chip>
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Terms of Service
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted">
          The everyday rules for being part of Greymens Club — written to be
          read, not to be scrolled past. Students first, lawyers second.
        </p>
      </header>

      <Card>
        <Card.Header>
          <Card.Title>The short version</Card.Title>
          <Card.Description>
            Everything below, in thirty seconds
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <ul className="grid gap-2.5 text-sm leading-relaxed text-muted sm:grid-cols-3">
            <li className="flex gap-2">
              <Handshake
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-accent"
              />
              Be kind, show up, and respect other people&apos;s work and
              privacy.
            </li>
            <li className="flex gap-2">
              <ShieldCheck
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-accent"
              />
              Never test or touch a system you don&apos;t have explicit
              permission for.
            </li>
            <li className="flex gap-2">
              <FileText
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-accent"
              />
              The Constitution governs; these terms explain it in plain words.
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
        Disagree with something, or spotted a gap?{" "}
        <Link
          className="font-medium text-foreground underline underline-offset-4"
          href="/contact"
        >
          Tell us
        </Link>{" "}
        — or read the full{" "}
        <Link
          className="font-medium text-foreground underline underline-offset-4"
          href="/constitution"
        >
          Constitution
        </Link>{" "}
        and our{" "}
        <Link
          className="font-medium text-foreground underline underline-offset-4"
          href="/privacy"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
