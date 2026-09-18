"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";

import { readApiError } from "@/lib/errorHandler";

type FeedbackType = "bug" | "feature" | "general" | "support";

interface FormData {
  name: string;
  email: string;
  type: FeedbackType;
  subject: string;
  message: string;
}

export default function HelpFeedbackPage() {
  const emptyForm: FormData = {
    name: "",
    email: "",
    type: "general",
    subject: "",
    message: "",
  };
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(readApiError(payload, "Failed to submit feedback"));
      }
      setSubmitted(true);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Failed to submit feedback. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const feedbackTypes = [
    { value: "bug", label: "Bug Report" },
    { value: "feature", label: "Feature Request" },
    { value: "support", label: "Support" },
    { value: "general", label: "General Feedback" },
  ];

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <Card className="border border-default-200">
          <CardContent className="text-center py-16 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-success-100 dark:bg-success-900/30 flex items-center justify-center">
              <svg
                aria-hidden="true"
                className="w-8 h-8 text-success"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M5 13l4 4L19 7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold" tabIndex={-1}>
              Heard. Thank you.
            </h1>
            <p className="text-default-500" role="status">
              Your message is with the volunteers who read every one. Bugs and
              support requests get priority; ideas get argued about — fondly.
            </p>
            <Button
              variant="primary"
              onPress={() => {
                setFormData({ ...emptyForm });
                setSubmitError(null);
                setSubmitted(false);
              }}
            >
              Submit Another
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
      <div className="text-center space-y-3">
        <Image
          alt=""
          aria-hidden="true"
          className="mx-auto h-24 w-24 rounded-3xl border border-default-200/70 object-cover"
          height={708}
          loading="lazy"
          src="/Assets/Media/lone-brain.gif"
          width={1000}
        />
        <h1 className="text-3xl font-bold">
          Stuck? Spotted something? Tell us.
        </h1>
        <p className="text-default-500">
          Bugs, support, ideas, complaints — a volunteer reads every one.
          Security issues go to{" "}
          <a
            className="font-medium text-foreground underline underline-offset-4"
            href="/security/report"
          >
            responsible disclosure
          </a>{" "}
          instead, so they&apos;re handled confidentially.
        </p>
      </div>

      <Card className="border border-default-200">
        <CardHeader className="px-6 pt-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Send us a message</h2>
            <p className="text-sm text-default-500">
              No account needed. No response-time promises either — volunteers,
              remember?
            </p>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <Form
            className="space-y-5"
            validationBehavior="aria"
            onSubmit={handleSubmit}
          >
            {submitError && (
              <Alert role="alert" status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Couldn&apos;t send it</Alert.Title>
                  <Alert.Description>{submitError}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField
                isRequired
                isDisabled={isSubmitting}
                name="name"
                validate={(value) =>
                  value.trim().length >= 2 ? null : "Tell us what to call you"
                }
                value={formData.name}
                onChange={(value) => setFormData({ ...formData, name: value })}
              >
                <Label>Name</Label>
                <Input autoComplete="name" placeholder="Your name" />
                <FieldError />
              </TextField>
              <TextField
                isRequired
                isDisabled={isSubmitting}
                name="email"
                type="email"
                validate={(value) =>
                  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
                    ? null
                    : "Enter a valid email address"
                }
                value={formData.email}
                onChange={(value) => setFormData({ ...formData, email: value })}
              >
                <Label>Email</Label>
                <Input autoComplete="email" placeholder="you@example.com" />
                <Description>So we can reply. Nothing else.</Description>
                <FieldError />
              </TextField>
            </div>

            <div className="space-y-1">
              <Select
                fullWidth
                value={formData.type}
                onChange={(value) =>
                  setFormData({
                    ...formData,
                    type: String(value ?? "general") as FeedbackType,
                  })
                }
              >
                <Label>Feedback type</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {feedbackTypes.map((type) => (
                      <ListBox.Item
                        key={type.value}
                        id={type.value}
                        textValue={type.label}
                      >
                        {type.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>

            <TextField
              isRequired
              isDisabled={isSubmitting}
              name="subject"
              validate={(value) =>
                value.trim().length >= 4 ? null : "Sum it up in a few words"
              }
              value={formData.subject}
              onChange={(value) => setFormData({ ...formData, subject: value })}
            >
              <Label>Subject</Label>
              <Input placeholder="What is this about?" />
              <FieldError />
            </TextField>

            <TextField
              isRequired
              isDisabled={isSubmitting}
              name="message"
              validate={(value) =>
                value.trim().length >= 10
                  ? null
                  : "Give us a little more to go on"
              }
              value={formData.message}
              onChange={(value) => setFormData({ ...formData, message: value })}
            >
              <Label>Message</Label>
              <TextArea
                placeholder="What happened, what you expected, what you tried…"
                rows={5}
              />
              <FieldError />
            </TextField>

            <div className="flex justify-end">
              <Button
                className="min-w-[120px]"
                isDisabled={isSubmitting}
                isPending={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "Sending..." : "Send Feedback"}
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>

      <div className="text-center space-y-2">
        <p className="text-sm text-default-500">
          You can also reach us at{" "}
          <a
            className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors focus-visible:outline-2 focus-visible:outline-accent"
            href="mailto:support@greymens.club"
          >
            support@greymens.club
          </a>
        </p>
      </div>
    </div>
  );
}
