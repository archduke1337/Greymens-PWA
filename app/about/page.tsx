"use client";

import Link from "next/link";
import {
  Lightbulb,
  Handshake,
  Rocket,
  Award,
  ShieldCheck,
  ArrowRight,
  Landmark,
} from "lucide-react";
import { Button, Card, Chip } from "@heroui/react";
import { Logo } from "@/components/icons";

const DO_LIST = [
  {
    icon: ShieldCheck,
    title: "Practice security responsibly",
    text: "Authorized labs, CTFs, and workshops where the ethics come before the exploits — membership is never permission to test a system.",
  },
  {
    icon: Lightbulb,
    title: "Build across disciplines",
    text: "Software, web, AI/ML, data, and systems. Your branch doesn't decide what you're allowed to be curious about.",
  },
  {
    icon: Handshake,
    title: "Learn out loud, together",
    text: "Peer sessions, code reviews, write-ups, and competitions. Beginners pair with experienced members — everyone teaches something.",
  },
  {
    icon: Rocket,
    title: "Ship work that lasts",
    text: "Projects with owners, milestones, and handovers. Research with attribution. Events with documentation. No throwaway work.",
  },
];

const VALUES = [
  {
    icon: Lightbulb,
    title: "Curiosity over credentials",
    description:
      "Nobody arrives knowing everything. We reward good questions, honest write-ups, and the courage to try the hard track.",
  },
  {
    icon: Handshake,
    title: "People before prestige",
    description:
      "Competitions are team sports here, credit is shared loudly, and newcomers get mentors — not gatekeepers.",
  },
  {
    icon: Award,
    title: "Responsibility with power",
    description:
      "Security knowledge comes with obligations: authorization first, disclosure done right, systems and people protected always.",
  },
  {
    icon: Rocket,
    title: "Continuity over heroes",
    description:
      "Everything important is written down and handed over. The club must thrive after any of us — including its founders — move on.",
  },
];

const TEAM_WORDS = ["Security", "Builders", "Writers", "Mentors", "Friends"];

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-12 px-4 py-10 sm:px-6">
      {/* Hero */}
      <div className="mx-auto max-w-3xl space-y-4 text-center">
        <Chip color="accent" variant="soft" size="sm">
          About Greymens
        </Chip>
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          A cybersecurity club for the endlessly curious
        </h1>
        <p className="text-base leading-relaxed text-muted sm:text-lg">
          We&apos;re students of the School of Engineering, ADYPU, who believe the
          best way to learn technology is to build it, break it (where
          we&apos;re allowed to), and explain it to each other.
        </p>
        <div className="flex flex-wrap justify-center gap-2.5">
          <Link href="/register">
            <Button className="rounded-full px-6">
              Join us
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </Link>
          <Link href="/governance">
            <Button variant="secondary" className="rounded-full px-6">
              How we&apos;re run
            </Button>
          </Link>
        </div>
      </div>

      {/* Story */}
      <Card>
        <Card.Header className="px-6 pt-6 sm:px-8">
          <Card.Title className="text-xl sm:text-2xl">Our story, honestly told</Card.Title>
          <Card.Description>
            Founded by students, coordinated with faculty, open to everyone
          </Card.Description>
        </Card.Header>
        <Card.Content className="space-y-4 px-6 pb-6 text-[15px] leading-relaxed text-muted sm:px-8 sm:pb-8">
          <p>
            Greymens began the way good clubs do: a few students who couldn&apos;t
            stop talking about security, staying late after classes to argue about
            capture-the-flags, demos, and ideas too big for a group chat. They
            decided the conversation deserved a room — and then a club.
          </p>
          <p>
            Today that room is bigger. Under founding student coordinator{" "}
            <span className="font-medium text-foreground">Aditya Yadav</span>, with
            faculty coordinators{" "}
            <span className="font-medium text-foreground">
              Ranjana Singh and Suyog Deshmukh
            </span>
            , we run workshops, CTFs, projects, and research across cybersecurity,
            software, AI/ML, and systems. What hasn&apos;t changed is the culture:
            show up curious, leave sharper, bring someone with you next time.
          </p>
          <p>
            We&apos;re deliberately work-centric. Events and certificates are
            supporting acts — the main show is members building competence,
            judgment, and friendships that outlast any semester.
          </p>
        </Card.Content>
      </Card>

      {/* What we do */}
      <section aria-label="What we do" className="space-y-5">
        <div className="max-w-2xl space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            What we actually do
          </p>
          <h2 className="text-2xl font-bold tracking-tight">Four habits, repeated weekly</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {DO_LIST.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title}>
                <Card.Content className="flex gap-4 p-6">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-soft-foreground">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{item.text}</p>
                  </span>
                </Card.Content>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Values */}
      <section aria-label="Our values" className="space-y-5">
        <div className="max-w-2xl space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            What we optimize for
          </p>
          <h2 className="text-2xl font-bold tracking-tight">Our values</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {VALUES.map((value) => {
            const Icon = value.icon;
            return (
              <Card key={value.title}>
                <Card.Content className="flex gap-4 p-6">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-tertiary">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <h3 className="font-semibold">{value.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">
                      {value.description}
                    </p>
                  </span>
                </Card.Content>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Team + governance */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <Card.Content className="space-y-4 p-6 text-center sm:p-8">
            <span className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-surface-secondary">
              <Logo className="h-11 w-11" />
            </span>
            <div>
              <h2 className="text-xl font-bold">Real people, real register</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                Our leadership page lists actual office bearers from the
                club&apos;s designation register — never placeholder faces.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5" aria-hidden="true">
              {TEAM_WORDS.map((word) => (
                <Chip key={word} size="sm" variant="soft">
                  {word}
                </Chip>
              ))}
            </div>
            <div>
              <Link href="/team">
                <Button variant="secondary" className="rounded-full px-6">
                  Meet the leadership
                </Button>
              </Link>
            </div>
          </Card.Content>
        </Card>
        <Card>
          <Card.Content className="space-y-4 p-6 sm:p-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning-soft text-warning">
              <Landmark className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-bold">Governed, not improvised</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                An elected Executive Board, an appointed Technical Directorate, a
                General Council that keeps the lights on — and a Constitution
                that says exactly who may do what. Fair process isn&apos;t a vibe
                here; it&apos;s Articles 64 through 79.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/constitution">
                <Button className="rounded-full px-5" size="sm">
                  Read the Constitution
                </Button>
              </Link>
              <Link href="/contact">
                <Button variant="secondary" className="rounded-full px-5" size="sm">
                  Talk to us
                </Button>
              </Link>
            </div>
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}
