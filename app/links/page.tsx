import type { Metadata } from "next";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Links | Greymens",
  description:
    "The bookmarks we'd hand a new member — coding, Linux, web security, red teaming, cloud, bug bounties, and free student tools, curated by Greymens.",
};

type ExternalLink = {
  title: string;
  blurb: string;
  href: string;
};

type LinkSection = {
  id: string;
  title: string;
  text: string;
  links: ExternalLink[];
};

const SECTIONS: LinkSection[] = [
  {
    id: "start-here",
    title: "Start here",
    text: "New to the club? These four pages are the fastest way in.",
    links: [
      {
        title: "Join the club",
        blurb: "Apply for membership — a human reviews every application.",
        href: "/register",
      },
      {
        title: "Events",
        blurb:
          "Workshops, CTFs, and meetups. Come to one, no experience needed.",
        href: "/events",
      },
      {
        title: "Member handbook",
        blurb: "Rules, guides, and quick answers in one place.",
        href: "/docs",
      },
      {
        title: "Help & feedback",
        blurb: "Stuck, or want to suggest a link for this page? Tell us here.",
        href: "/help-feedback",
      },
    ],
  },
  {
    id: "code",
    title: "Learn to code",
    text: "Security starts with building. Pick one track and finish it.",
    links: [
      {
        title: "Missing Semester — MIT",
        blurb: "The shell, Git, and tooling your degree skips over.",
        href: "https://missing.csail.mit.edu/",
      },
      {
        title: "freeCodeCamp",
        blurb:
          "Lessons, certificates, and coding-interview prep. Free forever.",
        href: "https://www.freecodecamp.org/",
      },
      {
        title: "edX",
        blurb: "Harvard's free introductory coding courses.",
        href: "https://www.edx.org/",
      },
      {
        title: "Advent of Code",
        blurb: "25 small challenges every December. Great winter habit.",
        href: "https://adventofcode.com/",
      },
    ],
  },
  {
    id: "linux",
    title: "Intro to Linux",
    text: "If the terminal scares you, start here. It stops scaring you fast.",
    links: [
      {
        title: "OverTheWire: Bandit",
        blurb: "Zero-to-hero Linux through a beginner wargame.",
        href: "https://overthewire.org/wargames/bandit/",
      },
      {
        title: "Linux Journey",
        blurb: "Bite-size lessons on the parts of Linux you'll actually use.",
        href: "https://linuxjourney.com/",
      },
    ],
  },
  {
    id: "web",
    title: "Intro to web security",
    text: "How the web breaks — and how to stop breaking it.",
    links: [
      {
        title: "Hacksplaining",
        blurb: "Short, visual lessons on web exploitation basics.",
        href: "https://www.hacksplaining.com/lessons",
      },
      {
        title: "PentesterLab",
        blurb: "Hands-on labs for learning to hack the web, step by step.",
        href: "https://pentesterlab.com/",
      },
      {
        title: "PortSwigger Web Security Academy",
        blurb: "Free labs from the makers of Burp Suite. The gold standard.",
        href: "https://portswigger.net/web-security",
      },
      {
        title: "Hacker101",
        blurb: "Free web-security course with bug-bounty practice.",
        href: "https://www.hacker101.com/",
      },
    ],
  },
  {
    id: "red-team",
    title: "Red team / penetration testing",
    text: "Offensive security practice — only on systems you own or are invited into.",
    links: [
      {
        title: "Hack The Box",
        blurb: "Pentesting labs and machines, from beginner to brutal.",
        href: "https://www.hackthebox.com/",
      },
      {
        title: "TryHackMe",
        blurb: "Guided rooms that hold your hand until you don't need it.",
        href: "https://tryhackme.com/",
      },
      {
        title: "Awesome Windows Security",
        blurb: "A curated list of Windows security and hacking resources.",
        href: "https://github.com/chryzsh/awesome-windows-security",
      },
      {
        title: "IRed.team",
        blurb: "Tools and techniques used by pentesters and red teamers.",
        href: "https://ired.team/",
      },
    ],
  },
  {
    id: "network-cloud-iot",
    title: "Networking, cloud & IoT",
    text: "Packets, clouds, and things that beep on your network.",
    links: [
      {
        title: "IT Security Lecture Notes",
        blurb: "Demos and notes on OSI, VPNs, Wireshark, and wireless.",
        href: "https://github.com/bkimminich/it-security-lecture/blob/master/slides/01-04-network_security.md",
      },
      {
        title: "Awesome Embedded & IoT Security",
        blurb: "Everything IoT security, from firmware to radios.",
        href: "https://github.com/fkie-cad/awesome-embedded-and-iot-security",
      },
      {
        title: "Awesome Serverless Security",
        blurb: "AWS, Azure, and Google Cloud security resources.",
        href: "https://github.com/puresec/awesome-serverless-security",
      },
      {
        title: "AWS Educate",
        blurb: "Free labs and cloud-skills development for students.",
        href: "https://aws.amazon.com/education/awseducate/",
      },
    ],
  },
  {
    id: "bug-bounty",
    title: "Bug bounties",
    text: "Hack legally, get paid. Read the rules before you touch anything.",
    links: [
      {
        title: "Awesome Bug Bounty",
        blurb: "Write-ups and resources. Start by reading other hunters.",
        href: "https://github.com/djadmin/awesome-bug-bounty",
      },
      {
        title: "HackerOne Hacktivity",
        blurb: "Public disclosed reports — learn what real findings look like.",
        href: "https://hackerone.com/hacktivity",
      },
    ],
  },
  {
    id: "student-perks",
    title: "Student perks & free tools",
    text: "Your student status is a discount card. Use it.",
    links: [
      {
        title: "GitHub Student Developer Pack",
        blurb: "Free dev tools, hosting, Copilot, and more.",
        href: "https://education.github.com/pack",
      },
      {
        title: "Azure for Students",
        blurb: "Free Azure credit and services, no card required.",
        href: "https://azure.microsoft.com/en-us/free/students",
      },
      {
        title: "TryHackMe student discount",
        blurb: "20% off annual subscriptions with student status.",
        href: "https://help.tryhackme.com/en/articles/6494960-student-discount",
      },
      {
        title: "Caido — 1 year free",
        blurb: "A friendly web pentesting proxy, free for a year.",
        href: "https://caido.io/pricing",
      },
      {
        title: "Shodan membership",
        blurb: "See every device on the internet. A classic OSINT tool.",
        href: "https://help.shodan.io/the-basics/account-faq",
      },
    ],
  },
  {
    id: "club",
    title: "The club, elsewhere",
    text: "Where Greymens actually hangs out.",
    links: [
      {
        title: "Discord",
        blurb: "Announcements, help, and late-night CTF channels.",
        href: "https://discord.gg/6v89E3SaZT",
      },
      {
        title: "Instagram",
        blurb: "Photos from workshops, events, and the chaos between.",
        href: "https://www.instagram.com/greymens?igsh=bzhycW1rMG12Z2Vh",
      },
      {
        title: "LinkedIn",
        blurb: "The professional face — sponsors and alumni look here.",
        href: "https://www.linkedin.com/company/greymens",
      },
      {
        title: "X (Twitter)",
        blurb: "Short updates and event shout-outs.",
        href: "https://twitter.com/GreymensADYPU",
      },
    ],
  },
];

function isInternal(href: string) {
  return href.startsWith("/");
}

export default function LinksPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-12 px-4 py-10 sm:px-6 sm:py-14">
      <header className="max-w-2xl space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
          Club bookmarks
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Links</h1>
        <p className="text-base leading-relaxed text-muted">
          The bookmarks we&apos;d hand a new member on day one — coding, Linux,
          web security, red teaming, cloud, bug bounties, and free student
          tools. External links open in a new tab.
        </p>
      </header>

      {SECTIONS.map((section) => (
        <section
          key={section.id}
          aria-labelledby={section.id}
          className="space-y-4"
        >
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold tracking-tight" id={section.id}>
              {section.title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {section.text}
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.links.map((link) => {
              const internal = isInternal(link.href);
              const body = (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold leading-snug transition-colors group-hover:text-accent">
                      {link.title}
                    </h3>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    />
                  </div>
                  <p className="text-sm leading-relaxed text-muted">
                    {link.blurb}
                  </p>
                </>
              );

              return (
                <li key={link.title}>
                  {internal ? (
                    <Link
                      className="group flex h-full flex-col gap-2 rounded-3xl border border-default-200/70 bg-background p-5 transition-shadow duration-200 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-accent"
                      href={link.href}
                    >
                      {body}
                    </Link>
                  ) : (
                    <a
                      aria-label={`${link.title} (opens in a new tab)`}
                      className="group flex h-full flex-col gap-2 rounded-3xl border border-default-200/70 bg-background p-5 transition-shadow duration-200 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-accent"
                      href={link.href}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {body}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <footer className="rounded-3xl border border-default-200/70 bg-surface-secondary/50 p-6 text-center sm:p-8">
        <h2 className="font-semibold">Something missing?</h2>
        <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted">
          This list is maintained by members. If a link is dead or deserves a
          spot here, tell us and we&apos;ll fix it.
        </p>
        <Link
          className="mt-4 inline-flex items-center rounded-full bg-foreground px-6 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          href="/help-feedback"
        >
          Suggest a link
        </Link>
      </footer>
    </div>
  );
}
