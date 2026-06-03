'use client';

import { useState } from 'react';
import { Button, Card, CardContent, CardHeader, Chip, Input, TextArea } from "@heroui/react";

type FeedbackType = 'bug' | 'feature' | 'general' | 'support';

interface FormData {
  name: string;
  email: string;
  type: FeedbackType;
  subject: string;
  message: string;
}

export default function HelpFeedbackPage() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    type: 'general',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    setSubmitted(true);
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
              <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold">Thank You!</h1>
            <p className="text-default-500">
              Your feedback has been submitted successfully. We&apos;ll get back to you as soon as possible.
            </p>
            <Button variant="primary"
              onPress={() => setSubmitted(false)}
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
            <p className="text-sm text-default-500">Fill out the form below and we&apos;ll respond within 24 hours.</p>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                placeholder="Your name"
                value={formData.name}
                onChange={(value: any) => setFormData({ ...formData, name: value })}
                required
              />
              <Input
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(value: any) => setFormData({ ...formData, email: value })}
                required
              />
            </div>

            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as FeedbackType })}
              className="w-full px-3 py-2 rounded-lg border border-default-300 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            >
              {feedbackTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>

            <Input
              placeholder="Brief description of your feedback"
              value={formData.subject}
              onChange={(value: any) => setFormData({ ...formData, subject: value })}
              required
            />

            <TextArea
              placeholder="Tell us more about your feedback..."
              value={formData.message}
              onChange={(value: any) => setFormData({ ...formData, message: value })}
              required
            />

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
          <Chip size="sm" variant="primary">
            support@mindmesh.club
          </Chip>
        </p>
      </div>
    </div>
  );
}
