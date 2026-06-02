'use client';

import { useState } from 'react';
import { Card, CardBody, CardHeader, Button, Input, Textarea, Select, SelectItem, Chip } from "@heroui/react";

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
            <Button
              color="primary"
              variant="primary"
              onPress={() => {
                setSubmitted(false);
                setFormData({ name: '', email: '', type: 'general', subject: '', message: '' });
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
            <p className="text-sm text-default-500">Fill out the form below and we&apos;ll respond within 24 hours.</p>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Name"
                placeholder="Your name"
                value={formData.name}
                onChange={(value) => setFormData({ ...formData, name: value })}
                isRequired
              />
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(value) => setFormData({ ...formData, email: value })}
                isRequired
              />
            </div>

            <Select
              label="Feedback Type"
              placeholder="Select type"
              selectedKeys={[formData.type]}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as FeedbackType;
                setFormData({ ...formData, type: selected });
              }}
            >
              {feedbackTypes.map((type) => (
                <SelectItem key={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </Select>

            <Input
              label="Subject"
              placeholder="Brief description of your feedback"
              value={formData.subject}
              onChange={(value) => setFormData({ ...formData, subject: value })}
              isRequired
            />

            <TextArea
              label="Message"
              placeholder="Tell us more about your feedback..."
              value={formData.message}
              onChange={(value) => setFormData({ ...formData, message: value })}
              minRows={4}
              isRequired
            />

            <div className="flex justify-end">
              <Button
                type="submit"
                color="primary"
                isLoading={isSubmitting}
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
          <Chip size="sm" variant="primary" color="primary">
            support@mindmesh.club
          </Chip>
        </p>
      </div>
    </div>
  );
}
