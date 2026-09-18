import type { Metadata } from "next";
import Link from "next/link";
import { Card, Chip } from "@heroui/react";
import {
  Landmark,
  Users,
  Cpu,
  ShieldCheck,
  Vote,
  Scale,
  ArrowRight,
  BookOpen,
} from "lucide-react";
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
    icon: Landmark,
    title: "Executive Board",
    tagline: "The principal student governing body",
    text: "President, Vice President, General Secretary, Treasurer, CTO, Cybersecurity Lead, and Research & Projects Director. Sets strategy, keeps the books honest, and answers for the club — to members and to the Institution.",
  },
  {
    id: "general_council",
    icon: Users,
    title: "General Council",
    tagline: "Chaired by the General Secretary",
    text: "Communications, editorial, marketing, social media, documentation, membership, and community. The people who make the club legible: notices go out, records stay straight, newcomers find their way in.",
  },
  {
    id: "technical",
    icon: Cpu,
    title: "Technical Directorate",
    tagline: "Led by the CTO",
    text: "Software & web, AI/ML & data, infrastructure & systems, plus project and research teams. Owns the club's technical standards, shared systems, and the rule that every critical resource has a named owner and a handover.",
  },
  {
    id: "security",
    icon: ShieldCheck,
    title: "Security & Competition",
    tagline: "Led by the Cybersecurity Lead",
    text: "Authorized security activity, labs, responsible disclosure, and the CTF team. Holds a hard line: no permission, no testing — and the authority to pause access fast when something looks compromised.",
  },
] as const;

const HOW_IT_WORKS = [
  {
    icon: Vote,
    title: "Elected where it counts",
    text: "President, Vice President, General Secretary, and Treasurer are elected by the General Body. Technical and council leads are appointed for competence through a documented process — skill matters more than speeches there.",
  },
  {
    icon: Scale,
    title: "Fair when it matters",
    text: "Warnings before sanctions, notice and a chance to respond before serious decisions, appeals to someone uninvolved, and no one deciding their own case. Protection first, judgment after evidence.",
  },
  {
    icon: BookOpen,
    title: "Written down, handed over",
    text: "Minutes, resolutions, officer records, and asset registers live with the General Secretary. Outgoing officers hand over properly — the club must survive any one person leaving, including its founders.",
  },
];

export default function GovernancePage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-12 px-4 py-10 sm:px-6">
      <header className="max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip color="warning" variant="soft" size="sm">
            {CHARTER_METADATA.status}
          </Chip>
          <Chip size="sm" variant="soft">
            Charter v{CHARTER_METADATA.version}
          </Chip>
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          Student-led, accountable, and built to outlast us
        </h1>
        <p className="text-base leading-relaxed text-muted sm:text-lg">
          Greymens Club is run by students, overseen with the Institution, and
          governed by a written Constitution — so authority always traces back
          to a rule, and every office can survive the person holding it.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <Link
            href="/constitution"
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Read the Constitution
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/team"
            className="inline-flex items-center rounded-full border border-default-300 px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-surface-secondary"
          >
            Meet the office bearers
          </Link>
        </div>
      </header>

      <section aria-label="Governance layers" className="grid gap-4 md:grid-cols-2">
        {LAYERS.map((layer) => {
          const Icon = layer.icon;
          const offices = GOVERNANCE_OFFICES.filter((office) => office.layer === layer.id);
          return (
            <Card key={layer.id}>
              <Card.Header>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <Card.Title>{layer.title}</Card.Title>
                    <Card.Description>{layer.tagline}</Card.Description>
                  </div>
                </div>
              </Card.Header>
              <Card.Content className="space-y-3">
                <p className="text-sm leading-relaxed text-muted">{layer.text}</p>
                <div className="flex flex-wrap gap-1.5">
                  {offices.map((office) => (
                    <Chip
                      key={office.id}
                      size="sm"
                      color={office.elected ? "accent" : "default"}
                      variant="soft"
                    >
                      {office.title}
                      {office.elected ? " · elected" : ""}
                    </Chip>
                  ))}
                </div>
              </Card.Content>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <Card.Header>
            <Card.Title>Who can be a member — and vote</Card.Title>
            <Card.Description>
              From first-day newcomer to office bearer, there is a path
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <ol className="space-y-3">
              {MEMBERSHIP_CATEGORIES.map((category, index) => (
                <li key={category.id} className="flex gap-3">
                  <span className="font-mono text-sm text-accent">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{category.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted">
                      {category.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card.Content>
        </Card>
        <Card className="lg:col-span-2">
          <Card.Header>
            <Card.Title>Institutional home</Card.Title>
            <Card.Description>Freedom inside a frame</Card.Description>
          </Card.Header>
          <Card.Content className="space-y-3 text-sm leading-relaxed text-muted">
            <p>
              The club lives in the {CHARTER_METADATA.school}, coordinated by{" "}
              {CHARTER_METADATA.facultyCoordinators.join(" and ")}. Day-to-day
              work is student-led; coordinators step in where safety, law,
              policy, or reputation require it.
            </p>
            <p>
              President {CHARTER_METADATA.president} ({CHARTER_METADATA.batch})
              holds the founding student mandate, and eight faculty advisors
              back the club&apos;s mentoring and research.
            </p>
            <Link
              href="/about"
              className="inline-flex items-center gap-1.5 font-medium text-foreground underline underline-offset-4"
            >
              Our story and values
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </Card.Content>
        </Card>
      </section>

      <section aria-label="How governance works in practice" className="space-y-5">
        <h2 className="text-2xl font-bold tracking-tight">How it works in practice</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {HOW_IT_WORKS.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title}>
                <Card.Content className="space-y-3 p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-tertiary">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-muted">{item.text}</p>
                </Card.Content>
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-label="Principles" className="space-y-5">
        <h2 className="text-2xl font-bold tracking-tight">The principles behind it</h2>
        <div className="grid gap-2.5 md:grid-cols-2">
          {CONSTITUTIONAL_PRINCIPLES.map((principle, index) => (
            <Card key={principle}>
              <Card.Content className="flex gap-3 p-4">
                <span className="font-mono text-sm text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="text-sm leading-relaxed">{principle}</p>
              </Card.Content>
            </Card>
          ))}
        </div>
      </section>

      <Card>
        <Card.Content className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-bold">Want the full text?</h2>
            <p className="mt-1 text-sm text-muted">
              Eighteen parts, eighty-six articles, seven schedules — the complete
              v{CHARTER_METADATA.version} draft, set like the document it is.
            </p>
          </div>
          <Link
            href="/constitution"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Open the Constitution
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Card.Content>
      </Card>
    </div>
  );
}
