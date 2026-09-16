import { Card, CardContent, CardHeader, Chip, Link } from "@heroui/react";
import { ShieldCheck, Users, Building2, BookOpen, AlertTriangle } from "lucide-react";
import {
  CHARTER_METADATA,
  CONSTITUTIONAL_PRINCIPLES,
  GOVERNANCE_OFFICES,
  MEMBERSHIP_CATEGORIES,
} from "@/lib/governance";

const officeLayers = [
  { id: "executive", title: "Executive Board", description: "Principal student governing body." },
  { id: "general_council", title: "General Council", description: "Administrative, communications, editorial, membership, and community portfolios." },
  { id: "technical", title: "Technical Directorate", description: "Technical architecture, development, infrastructure, AI/ML, data, and research." },
  { id: "security", title: "Security & Competition", description: "Cybersecurity governance, authorized activity, CTFs, and responsible disclosure." },
] as const;

export default function ConstitutionPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 py-12">
      <header className="max-w-3xl space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Chip color="warning" variant="soft">{CHARTER_METADATA.status}</Chip>
          <Chip color="default" variant="soft">Version {CHARTER_METADATA.version}</Chip>
        </div>
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{CHARTER_METADATA.name}</h1>
        <p className="text-lg text-[var(--muted)]">
          The governing framework for GREYMEN’s CLUB: student-led, institutionally accountable,
          technically responsible, and designed for continuity beyond any one officer.
        </p>
      </header>

      <Card className="border-warning/40 bg-warning/5">
        <CardContent className="flex gap-4 p-6">
          <AlertTriangle className="mt-1 h-6 w-6 shrink-0 text-warning" />
          <div className="space-y-2">
            <h2 className="font-semibold">Draft for ratification</h2>
            <p className="text-sm text-[var(--muted)]">
              This page summarizes the foundational draft. It becomes operative only after the
              required student and institutional approval process. Where this Charter conflicts
              with law or binding institutional policy, the higher authority prevails.
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" aria-label="Charter metadata">
        {[
          ["School", CHARTER_METADATA.school],
          ["President", `${CHARTER_METADATA.president} (${CHARTER_METADATA.presidentUrn})`],
          ["Batch", CHARTER_METADATA.batch],
          ["Faculty Coordinators", CHARTER_METADATA.facultyCoordinators.join("; ")],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="space-y-2 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
              <p className="font-medium">{value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-5">
        <div className="flex items-center gap-3"><Building2 className="h-6 w-6 text-[var(--accent)]" /><h2 className="text-2xl font-bold">Governance architecture</h2></div>
        <div className="grid gap-4 md:grid-cols-2">
          {officeLayers.map((layer) => (
            <Card key={layer.id}>
              <CardHeader className="pb-2"><h3 className="text-lg font-semibold">{layer.title}</h3></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-[var(--muted)]">{layer.description}</p>
                <div className="flex flex-wrap gap-2">
                  {GOVERNANCE_OFFICES.filter((office) => office.layer === layer.id).map((office) => (
                    <Chip key={office.id} color={office.elected ? "accent" : "default"} variant="soft">
                      {office.title}{office.elected ? " · elected" : " · appointed"}
                    </Chip>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center gap-3"><Users className="h-6 w-6 text-[var(--accent)]" /><h2 className="text-xl font-bold">Membership categories</h2></CardHeader>
          <CardContent className="space-y-4">
            {MEMBERSHIP_CATEGORIES.map((category) => (
              <div key={category.id} className="border-b border-[var(--border)] pb-3 last:border-0 last:pb-0">
                <h3 className="font-semibold">{category.title}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{category.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center gap-3"><ShieldCheck className="h-6 w-6 text-[var(--success)]" /><h2 className="text-xl font-bold">Technical safety</h2></CardHeader>
          <CardContent className="space-y-4 text-sm text-[var(--muted)]">
            <p className="font-semibold text-foreground">Membership is not permission to access or test a system.</p>
            <p>Every security activity must have explicit, verifiable authorization with a defined target, scope, time period, technique, data boundary, and purpose.</p>
            <p>Access is least-privilege, credentials are protected, incidents are contained and escalated, and sensitive findings follow responsible disclosure.</p>
            <p>Club repositories, domains, infrastructure, accounts, and records are organizational resources with documented ownership and handover paths.</p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-5">
        <div className="flex items-center gap-3"><BookOpen className="h-6 w-6 text-[var(--accent)]" /><h2 className="text-2xl font-bold">Foundational principles</h2></div>
        <div className="grid gap-3 md:grid-cols-2">
          {CONSTITUTIONAL_PRINCIPLES.map((principle, index) => (
            <Card key={principle}><CardContent className="flex gap-3 p-4"><span className="font-mono text-sm text-[var(--accent)]">{String(index + 1).padStart(2, "0")}</span><p className="text-sm">{principle}</p></CardContent></Card>
          ))}
        </div>
      </section>

      <footer className="space-y-3 border-t border-[var(--border)] pt-6 text-sm text-[var(--muted)]">
        <p>Review cycle: {CHARTER_METADATA.reviewCycle}. Ratification and amendment records should be maintained by the General Secretary.</p>
        <Link href="/security/report">Security activity authorization and incident reporting →</Link>
      </footer>
    </main>
  );
}
