'use client';

import { useState } from 'react';
import { readApiError } from "@/lib/errorHandler";
import { Button, Card, CardContent, CardHeader, Input, Label, ListBox, Select, TextArea } from "@heroui/react";

type FeedbackType = 'bug' | 'feature' | 'general' | 'support';

interface FormData {
  name: string;
  email: string;
  type: FeedbackType;
  subject: string;
  message: string;
}

export default function HelpFeedbackPage() {
  const emptyForm: FormData = {
    name: '',
    email: '',
    type: 'general',
    subject: '',
    message: '',
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
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(readApiError(payload, "Failed to submit feedback"));
      }
      setSubmitted(true);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to submit feedback. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const feedbackTypes = [
    { value: 'bug', label: 'Bug Report' },
    { value: 'feature', label: 'Feature Request' },
    { value: 'support', label: 'Support' },
    { value: 'general', label: 'General Feedback' },
  ];

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <Card className="border border-default-200">
          <CardContent className="text-center py-16 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-success-100 dark:bg-success-900/30 flex items-center justify-center">
              <svg aria-hidden="true" className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 tabIndex={-1} autoFocus className="text-2xl font-bold outline-none">Thank You!</h1>
            <p className="text-default-500" role="status">
              Your feedback has been submitted successfully. We&apos;ll get back to you as soon as possible.
            </p>
            <Button variant="primary"
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
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Help & Feedback</h1>
        <p className="text-default-500">
          Have a question, found a bug, or want to suggest a feature? We&apos;d love to hear from you.
        </p>
      </div>

      <Card className="border border-default-200">
        <CardHeader className="px-6 pt-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Send us a message</h2>
            <p className="text-sm text-default-500">Fill out the form below and the team will review it. Messages are read by volunteers — there is no guaranteed response time.</p>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {submitError && (
              <div role="alert" className="p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger text-sm">
                {submitError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="feedback-name" className="text-sm font-medium">Name</label>
                <Input
                  id="feedback-name"
                  placeholder="Your name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="feedback-email" className="text-sm font-medium">Email</label>
                <Input
                  id="feedback-email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Select
                fullWidth
                value={formData.type}
                onChange={(value) => setFormData({ ...formData, type: String(value ?? "general") as FeedbackType })}
              >
                <Label>Feedback type</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {feedbackTypes.map((type) => (
                      <ListBox.Item key={type.value} id={type.value} textValue={type.label}>
                        {type.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>

            <div className="space-y-1">
              <label htmlFor="feedback-subject" className="text-sm font-medium">Subject</label>
              <Input
                id="feedback-subject"
                placeholder="Brief description of your feedback"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="feedback-message" className="text-sm font-medium">Message</label>
              <TextArea
                id="feedback-message"
                placeholder="Tell us more about your feedback..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                required
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                isPending={isSubmitting}
                className="min-w-[120px]"
              >
                {isSubmitting ? 'Sending...' : 'Send Feedback'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="text-center space-y-2">
        <p className="text-sm text-default-500">
          You can also reach us at{' '}
          <a
            href="mailto:support@greymens.club"
            className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            support@greymens.club
          </a>
        </p>
      </div>
    </div>
  );
}
