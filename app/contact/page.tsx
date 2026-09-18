"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Alert,
  Button,
  Card,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  TextArea,
  TextField,
} from "@heroui/react";
import { ArrowUpRight, Mail, MessagesSquare, ShieldCheck } from "lucide-react";

import { readApiError } from "@/lib/errorHandler";

const EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

const CHANNELS = [
  {
    Icon: MessagesSquare,
    name: "Discord",
    pace: "Often the fastest answer",
    cta: "Join the server",
    href: "https://discord.gg/6v89E3SaZT",
    external: true,
  },
  {
    Icon: Mail,
    name: "Email",
    pace: "Replies in 2–3 working days",
    cta: "hello@greymens.club",
    href: "mailto:hello@greymens.club",
    external: false,
  },
  {
    Icon: ShieldCheck,
    name: "Security issues",
    pace: "Confidential, handled first",
    cta: "Disclose responsibly",
    href: "/security/report",
    external: false,
  },
];

type SubmitStatus = {
  type: "success" | "error";
  message: string;
} | null;

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<SubmitStatus>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as unknown;

        throw new Error(readApiError(payload, "Failed to send message"));
      }

      setStatus({
        type: "success",
        message:
          "Sent. A club officer replies within 2–3 working days — sooner on Discord.",
      });
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error instanceof Error && error.message
            ? error.message
            : "Couldn't send. Try again, or email us directly.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-4 py-12 sm:px-6 sm:py-16">
      <header className="mx-auto max-w-xl space-y-3 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Talk to a human
        </h1>
        <p className="text-[15px] leading-relaxed text-muted">
          Joining, sponsoring, reporting, or just curious — write below. A
          student officer reads everything and replies within 2–3 working days.
        </p>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_280px]">
        <Card>
          <Card.Header>
            <Card.Title>Send a message</Card.Title>
            <Card.Description>
              Replies within 2–3 working days. Discord is faster.
            </Card.Description>
          </Card.Header>
          <Form validationBehavior="aria" onSubmit={handleSubmit}>
            <Card.Content className="space-y-4">
              {status?.type === "success" && (
                <Alert role="status" status="success">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>Message sent</Alert.Title>
                    <Alert.Description>{status.message}</Alert.Description>
                  </Alert.Content>
                </Alert>
              )}
              {status?.type === "error" && (
                <Alert role="alert" status="danger">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>Couldn&apos;t send</Alert.Title>
                    <Alert.Description>{status.message}</Alert.Description>
                  </Alert.Content>
                </Alert>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  isRequired
                  isDisabled={isSubmitting}
                  name="name"
                  validate={(value) =>
                    value.trim().length >= 2
                      ? null
                      : "Enter your name (at least 2 characters)"
                  }
                  value={name}
                  onChange={setName}
                >
                  <Label>Name</Label>
                  <Input
                    autoComplete="name"
                    maxLength={120}
                    placeholder="What should we call you?"
                  />
                  <FieldError />
                </TextField>
                <TextField
                  isRequired
                  isDisabled={isSubmitting}
                  name="email"
                  type="email"
                  validate={(value) =>
                    EMAIL_PATTERN.test(value.trim())
                      ? null
                      : "Enter a valid email address"
                  }
                  value={email}
                  onChange={setEmail}
                >
                  <Label>Email</Label>
                  <Input
                    autoComplete="email"
                    maxLength={254}
                    placeholder="you@example.com"
                  />
                  <FieldError />
                </TextField>
              </div>

              <TextField
                isRequired
                isDisabled={isSubmitting}
                name="subject"
                validate={(value) =>
                  value.trim().length >= 4
                    ? null
                    : "Add a subject (at least 4 characters)"
                }
                value={subject}
                onChange={setSubject}
              >
                <Label>Subject</Label>
                <Input
                  autoComplete="off"
                  maxLength={200}
                  placeholder="Joining, an event, a partnership, a concern…"
                />
                <FieldError />
              </TextField>

              <TextField
                isRequired
                isDisabled={isSubmitting}
                name="message"
                validate={(value) =>
                  value.trim().length >= 10
                    ? null
                    : "Tell us a little more (at least 10 characters)"
                }
                value={message}
                onChange={setMessage}
              >
                <Label>Message</Label>
                <TextArea
                  maxLength={5000}
                  placeholder="The context — specifics get faster answers."
                  rows={5}
                />
                <Description>
                  Specifics get faster answers ({message.trim().length}/5000).
                </Description>
                <FieldError />
              </TextField>
            </Card.Content>
            <Card.Footer className="flex-col gap-2">
              <Button
                className="w-full rounded-full"
                isDisabled={isSubmitting}
                isPending={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "Sending…" : "Send message"}
              </Button>
              <p className="text-center text-xs text-muted">
                No newsletter, no spam. Replies only.
              </p>
            </Card.Footer>
          </Form>
        </Card>

        <aside className="space-y-4">
          <figure className="space-y-2">
            <div className="mx-auto max-w-[220px] overflow-hidden rounded-3xl border border-default-200/70 bg-white">
              <Image
                alt="A hand giving a thumbs-up"
                className="w-full object-cover"
                height={1300}
                loading="lazy"
                src="/Assets/Media/thumb-up.webp"
                width={1280}
              />
            </div>
            <figcaption className="text-center text-sm text-muted">
              Give us a shout — a human answers.
            </figcaption>
          </figure>
          <Card variant="secondary">
            <Card.Content className="space-y-4 p-5">
              <h2 className="text-sm font-semibold">Other ways to reach us</h2>
              <ul className="space-y-3">
                {CHANNELS.map(({ Icon, name, pace, cta, href, external }) => (
                  <li key={name} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background">
                      <Icon aria-hidden="true" className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{name}</span>
                      <span className="block text-xs text-muted">{pace}</span>
                    </span>
                    {external ? (
                      <a
                        aria-label={`${cta} (opens in a new tab)`}
                        className="inline-flex shrink-0 items-center gap-1 text-xs font-medium underline underline-offset-4"
                        href={href}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {cta}
                        <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
                      </a>
                    ) : href.startsWith("/") ? (
                      <Link
                        className="shrink-0 text-xs font-medium underline underline-offset-4"
                        href={href}
                      >
                        {cta}
                      </Link>
                    ) : (
                      <a
                        className="shrink-0 break-all text-xs font-medium underline underline-offset-4"
                        href={href}
                      >
                        {cta}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </Card.Content>
          </Card>
        </aside>
      </div>
    </div>
  );
}
