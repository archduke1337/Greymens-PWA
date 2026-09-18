import type { Metadata } from "next";

import Link from "next/link";
import Image from "next/image";
import { Card, Chip } from "@heroui/react";
import { ArrowRight } from "lucide-react";

import {
  CHARTER_METADATA,
  CONSTITUTIONAL_PRINCIPLES,
  GOVERNANCE_OFFICES,
  MEMBERSHIP_CATEGORIES,
} from "@/lib/governance";

export const metadata: Metadata = {
  title: "Governance",
  description:
    "How Greymens Club governs itself: student-led teams, institutional oversight, and fair process.",
};

const LAYERS = [
  {
    id: "executive",
    title: "Executive Board",
    tagline: "The principal student governing body",
    text: "President, Vice President, General Secretary, Treasurer, CTO, Cybersecurity Lead, and Research & Projects Director. They set direction, keep the books honest, and answer for the club — to members and to the Institution.",
  },
  {
    id: "general_council",
    title: "General Council",
    tagline: "Chaired by the General Secretary",
    text: "Communications, editorial, marketing, social media, documentation, membership, and community. The people who keep the club legible: notices go out, records stay straight, newcomers find their way in.",
  },
  {
    id: "technical",
    title: "Technical Directorate",
    tagline: "Led by the CTO",
    text: "Software and web, AI/ML and data, infrastructure and systems, plus project and research teams. Owns the club's technical standards — and the rule that every critical system has a named owner and a handover.",
  },
  {
    id: "security",
    title: "Security & Competition",
    tagline: "Led by the Cybersecurity Lead",
    text: "Authorized security work, labs, responsible disclosure, and the CTF team. Holds one hard line: no permission, no testing — with the authority to pause access fast when something looks compromised.",
  },
] as const;

export default function GovernancePage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-16 px-4 py-12 sm:px-6 sm:py-16">
      {/* Hero */}
      <header className="mx-auto max-w-2xl space-y-4 text-center">
        <Chip size="sm" variant="soft">
          Governance · Constitution v{CHARTER_METADATA.version} in force
        </Chip>
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          Run by students, written down
        </h1>
        <p className="text-base leading-relaxed text-muted sm:text-lg">
          Every office, every authority, every fair-process rule — in one
          Constitution, so the club outlasts any of us.
        </p>
      </header>

      {/* Arch: structures that outlast people */}
      <figure className="space-y-3">
        <div className="overflow-hidden rounded-3xl border border-default-200/70">
          <Image
            alt="A hand-drawn landscape with an ancient stone arch standing under the moon"
            className="aspect-[16/8] w-full object-cover"
            height={1075}
            loading="lazy"
            src="/Assets/Banners/about_hero.webp"
            width={1920}
          />
        </div>
        <figcaption className="text-center text-sm text-muted">
          Old arches outlive their builders. That&apos;s the idea — authority
          tied to offices, not individuals.
        </figcaption>
      </figure>

      {/* Layers */}
      <section aria-label="Governance layers" className="space-y-6">
        <h2 className="text-center text-xl font-bold tracking-tight">
          Four bodies, one charter
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {LAYERS.map((layer) => {
            const offices = GOVERNANCE_OFFICES.filter(
              (office) => office.layer === layer.id,
            );

            return (
              <Card key={layer.id}>
                <Card.Header>
                  <Card.Title>{layer.title}</Card.Title>
                  <Card.Description>{layer.tagline}</Card.Description>
                </Card.Header>
                <Card.Content className="space-y-4">
                  <p className="text-sm leading-relaxed text-muted">
                    {layer.text}
                  </p>
                  <p className="text-[13px] leading-relaxed text-muted">
                    {offices.map((office) => office.title).join(" · ")}
                  </p>
                </Card.Content>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Membership + institution */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <Card.Header>
            <Card.Title>Membership, plainly</Card.Title>
            <Card.Description>From first day to office bearer</Card.Description>
          </Card.Header>
          <Card.Content>
            <ol className="space-y-3">
              {MEMBERSHIP_CATEGORIES.map((category) => (
                <li key={category.id}>
                  <p className="text-sm font-medium">{category.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted">
                    {category.description}
                  </p>
                </li>
              ))}
            </ol>
          </Card.Content>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <Card.Header>
              <Card.Title>Student-led, institutionally home</Card.Title>
            </Card.Header>
            <Card.Content className="space-y-3 text-sm leading-relaxed text-muted">
              <p>
                The club lives in the {CHARTER_METADATA.school}, coordinated by{" "}
                {CHARTER_METADATA.facultyCoordinators.join(" and ")}. Day-to-day
                work is student-led; coordinators step in where safety, law, or
                policy require it.
              </p>
              <p>
                Founded by {CHARTER_METADATA.president} (
                {CHARTER_METADATA.batch}), backed by eight faculty advisors.
              </p>
            </Card.Content>
          </Card>
          <Card>
            <Card.Header>
              <Card.Title>Fair when it matters</Card.Title>
            </Card.Header>
            <Card.Content className="space-y-3 text-sm leading-relaxed text-muted">
              <p>
                Notice before serious decisions. A chance to respond. Appeals
                heard by someone uninvolved. Protection first, judgment after
                evidence.
              </p>
              <Link
                className="inline-flex items-center gap-1.5 font-medium text-foreground underline underline-offset-4"
                href="/constitution"
              >
                Read the full Constitution
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
            </Card.Content>
          </Card>
        </div>
      </section>

      {/* Principles */}
      <section aria-label="Principles" className="space-y-6">
        <h2 className="text-center text-xl font-bold tracking-tight">
          What we optimize for
        </h2>
        <ul className="mx-auto grid max-w-4xl gap-x-8 gap-y-2.5 sm:grid-cols-2">
          {CONSTITUTIONAL_PRINCIPLES.map((principle) => (
            <li
              key={principle}
              className="border-t border-default-200/70 pt-2.5 text-sm leading-relaxed text-muted"
            >
              {principle}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
