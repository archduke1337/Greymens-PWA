"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Input, TextArea } from "@heroui/react";

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
          "Sent. A club officer replies within 2–3 working days — sooner on Discord.",
      });
      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch (error) {
      setSubmitStatus({
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
    <div className="mx-auto w-full max-w-5xl space-y-12 px-4 py-12 sm:px-6 sm:py-16">
      <header className="mx-auto max-w-xl space-y-3 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Contact</h1>
        <p className="text-[15px] leading-relaxed text-muted">
          Questions, partnerships, concerns — write below. Students answer,
          usually between classes.
        </p>
      </header>

      <div className="grid items-start gap-10 lg:grid-cols-[1fr_280px]">
        <Card>
          <Card.Content className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              {submitStatus.type && (
                <p
                  role={submitStatus.type === "success" ? "status" : "alert"}
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    submitStatus.type === "success"
                      ? "bg-success-soft text-success-soft-foreground"
                      : "bg-danger-soft text-danger-soft-foreground"
                  }`}
                >
                  {submitStatus.message}
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="contact-name" className="text-sm font-medium">Name</label>
                  <Input
                    id="contact-name"
                    required
                    placeholder="What should we call you?"
                    value={formData.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="contact-email" className="text-sm font-medium">Email</label>
                  <Input
                    id="contact-email"
                    required
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="contact-subject" className="text-sm font-medium">Subject</label>
                <Input
                  id="contact-subject"
                  required
                  placeholder="Joining, an event, a partnership, a concern…"
                  value={formData.subject}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({ ...formData, subject: e.target.value })
                  }
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="contact-message" className="text-sm font-medium">Message</label>
                <TextArea
                  id="contact-message"
                  required
                  placeholder="The context — specifics get faster answers."
                  value={formData.message}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setFormData({ ...formData, message: e.target.value })
                  }
                  disabled={isSubmitting}
                />
              </div>
              <Button
                type="submit"
                isPending={isSubmitting}
                className="w-full rounded-full"
              >
                {isSubmitting ? "Sending…" : "Send message"}
              </Button>
            </form>
          </Card.Content>
        </Card>

        <aside className="space-y-4">
          <figure className="space-y-2">
            <div className="mx-auto max-w-[220px] overflow-hidden rounded-3xl border border-default-200/70">
              <img
                src="/Assets/Objects/Nokia-MAIN-554x1024.webp"
                alt="A retro phone displaying the words ring us not your mate"
                loading="lazy"
                className="w-full object-cover"
              />
            </div>
          </figure>
          <ul className="space-y-2 text-center text-sm text-muted">
            <li>
              Fastest —{" "}
              <a
                href="https://discord.gg/6v89E3SaZT"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline underline-offset-4"
              >
                Discord
              </a>
            </li>
            <li>
              Formal —{" "}
              <a
                href="mailto:hello@greymens.club"
                className="font-medium text-foreground underline underline-offset-4"
              >
                hello@greymens.club
              </a>
            </li>
            <li>
              Vulnerability?{" "}
              <Link
                href="/security/report"
                className="font-medium text-foreground underline underline-offset-4"
              >
                Disclose responsibly
              </Link>
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
