'use client';

import { Card, CardContent, CardHeader, Button, Input, TextArea, Select, Chip } from "@heroui/react";
import { useState } from 'react';
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
    message: '' });
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
              variant="primary" color="primary">
            support@mindmesh.club
          </Chip>
        </p>
      </div>
    </div>
  );
}
