"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Chip, Input, TextArea } from "@heroui/react";
import { Mail, MessageCircle, Clock, MapPin, ArrowRight } from "lucide-react";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: "" });

    try {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          subject: formData.subject,
          message: formData.message,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Failed to send message");
      }

      setSubmitStatus({
        type: "success",
        message:
          "Message sent — thank you! A club officer will reply within 2–3 working days. For anything urgent, find us on Discord.",
      });
      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch (error) {
      setSubmitStatus({
        type: "error",
        message:
          error instanceof Error && error.message
            ? error.message
            : "Failed to send message. Please try again or email us directly.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactMethods = [
    {
      Icon: MessageCircle,
      title: "Discord — fastest",
      value: "Daily chatter, event help, quick questions",
      link: "https://discord.gg/6v89E3SaZT",
      cta: "Join the server",
    },
    {
      Icon: Mail,
      title: "Email — official",
      value: "Partnerships, grievances, formal requests",
      link: "mailto:hello@greymens.club",
      cta: "hello@greymens.club",
    },
    {
      Icon: MapPin,
      title: "In person — friendliest",
      value: "School of Engineering, ADYPU · during workshops & meetups",
      link: "/events",
      cta: "See where we'll be",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 px-4 py-10 sm:px-6">
      <header className="mx-auto max-w-2xl space-y-3 text-center">
        <Chip color="accent" variant="soft" size="sm">
          Contact
        </Chip>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Talk to a human, not a form
        </h1>
        <p className="text-base leading-relaxed text-muted">
          Questions about joining, events, partnerships, or anything else? Write
          below or pick the channel that suits you. Students answer — usually
          between classes.
        </p>
        <p className="inline-flex items-center gap-1.5 text-xs text-muted">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          Typical reply time: 2–3 working days · Security issues go to{" "}
          <Link href="/security/report" className="font-medium text-foreground underline underline-offset-4">
            responsible disclosure
          </Link>
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <Card.Header className="px-6 pt-6 sm:px-8">
            <Card.Title className="text-xl">Send us a message</Card.Title>
            <Card.Description>
              Tell us who you are and what&apos;s on your mind — specifics get
              faster, better answers.
            </Card.Description>
          </Card.Header>
          <Card.Content className="px-6 pb-6 sm:px-8 sm:pb-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {submitStatus.type && (
                <div
                  role={submitStatus.type === "success" ? "status" : "alert"}
                  className={`rounded-2xl p-4 text-sm leading-relaxed ${
                    submitStatus.type === "success"
                      ? "bg-success-soft text-success-soft-foreground"
                      : "bg-danger-soft text-danger-soft-foreground"
                  }`}
                >
                  {submitStatus.message}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="contact-name" className="text-sm font-medium">
                    Your name
                  </label>
                  <Input
                    id="contact-name"
                    required
                    placeholder="What should we call you?"
                    value={formData.name}
                    onChange={(e: unknown) =>
                      setFormData({ ...formData, name: String((e as { target: { value: string } }).target.value) })
                    }
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="contact-email" className="text-sm font-medium">
                    Email
                  </label>
                  <Input
                    id="contact-email"
                    required
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e: unknown) =>
                      setFormData({ ...formData, email: String((e as { target: { value: string } }).target.value) })
                    }
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="contact-subject" className="text-sm font-medium">
                  What&apos;s this about?
                </label>
                <Input
                  id="contact-subject"
                  required
                  placeholder="Joining, an event, a partnership, a concern…"
                  value={formData.subject}
                  onChange={(e: unknown) =>
                    setFormData({ ...formData, subject: String((e as { target: { value: string } }).target.value) })
                  }
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="contact-message" className="text-sm font-medium">
                  Message
                </label>
                <TextArea
                  id="contact-message"
                  required
                  placeholder="Give us the context — the more specific, the faster we can help."
                  value={formData.message}
                  onChange={(e: unknown) =>
                    setFormData({ ...formData, message: String((e as { target: { value: string } }).target.value) })
                  }
                  disabled={isSubmitting}
                />
              </div>
              <Button
                type="submit"
                size="lg"
                isPending={isSubmitting}
                className="w-full rounded-full"
              >
                {isSubmitting ? "Sending…" : "Send message"}
              </Button>
            </form>
          </Card.Content>
        </Card>

        <div className="space-y-4">
          <Card>
            <Card.Header className="px-6 pt-6">
              <Card.Title>Other ways to reach us</Card.Title>
            </Card.Header>
            <Card.Content className="space-y-2 px-3 pb-4">
              {contactMethods.map((method) => {
                const Icon = method.Icon;
                const external = method.link.startsWith("http");
                return (
                  <a
                    key={method.title}
                    href={method.link}
                    {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="flex items-start gap-3.5 rounded-2xl p-3 transition-colors hover:bg-surface-secondary"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{method.title}</span>
                      <span className="block text-[13px] leading-relaxed text-muted">
                        {method.value}
                      </span>
                      <span className="mt-0.5 inline-flex items-center gap-1 text-[13px] font-medium text-accent">
                        {method.cta}
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    </span>
                  </a>
                );
              })}
            </Card.Content>
          </Card>

          <Card>
            <Card.Content className="space-y-2 p-6">
              <h2 className="font-semibold">Before you write</h2>
              <ul className="space-y-2 text-sm leading-relaxed text-muted">
                <li>
                  <span className="font-medium text-foreground">Joining?</span> Just{" "}
                  <Link href="/register" className="underline underline-offset-4">
                    apply
                  </Link>{" "}
                  — no need to ask permission first.
                </li>
                <li>
                  <span className="font-medium text-foreground">An event?</span> Check{" "}
                  <Link href="/events" className="underline underline-offset-4">
                    the lineup
                  </Link>{" "}
                  and register there.
                </li>
                <li>
                  <span className="font-medium text-foreground">A vulnerability?</span>{" "}
                  Please use{" "}
                  <Link href="/security/report" className="underline underline-offset-4">
                    responsible disclosure
                  </Link>
                  , not this form.
                </li>
              </ul>
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  );
}
