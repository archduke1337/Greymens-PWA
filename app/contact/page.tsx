"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input, Textarea } from "@heroui/input";
import { Button } from "@heroui/button";
import { Link } from "@heroui/link";
import { title, subtitle } from "@/components/primitives";
import { useState } from "react";

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

  // Method 1: Using EmailJS (Recommended - No Backend Required)
  const handleSubmitWithEmailJS = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: "" });

    try {
      const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          service_id: "service_uv7h9yv", // Replace with your EmailJS service ID
          template_id: "template_5jqtexq", // Replace with your EmailJS template ID
          user_id: "XDzUiPBDF_TLck0Ds", // Replace with your EmailJS public key
          template_params: {
            from_name: formData.name,
            from_email: formData.email,
            subject: formData.subject,
            message: formData.message,
            to_email: "hello@mindmesh.club",
          },
        }),
      });

      if (response.ok) {
        setSubmitStatus({
          type: "success",
          message: "Message sent successfully! We'll get back to you soon.",
        });
        setFormData({ name: "", email: "", subject: "", message: "" });
      } else {
        throw new Error("Failed to send message");
      }
    } catch (error) {
      setSubmitStatus({
        type: "error",
        message: "Failed to send message. Please try again or email us directly.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Method 2: Using Appwrite
  const handleSubmitWithAppwrite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: "" });

    try {
      const { databases } = await import("@/lib/appwrite");
      const { ID } = await import("appwrite");

      // Create contact document in Appwrite
      // Note: You need to set up a "contacts" collection in your Appwrite database
      await databases.createDocument(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "",
        "contacts", // Your collection ID for contacts
        ID.unique(),
        {
          name: formData.name,
          email: formData.email,
          subject: formData.subject,
          message: formData.message,
          createdAt: new Date().toISOString(),
          status: "unread",
        }
      );

      setSubmitStatus({
        type: "success",
        message: "Message sent successfully! We'll get back to you soon.",
      });
      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch (error) {
      console.error("Error:", error);
      setSubmitStatus({
        type: "error",
        message: "Failed to send message. Please try again or email us directly.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = handleSubmitWithEmailJS; // Change to handleSubmitWithAppwrite if using Appwrite

  const contactMethods = [
    {
      icon: (
        <svg className="w-6 h-6 text-white" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.9 3.9 0 0 0-1.417.923A3.9 3.9 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.9 3.9 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.9 3.9 0 0 0-.923-1.417A3.9 3.9 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599s.453.546.598.92c.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.5 2.5 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.5 2.5 0 0 1-.92-.598 2.5 2.5 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233s.008-2.388.046-3.231c.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92s.546-.453.92-.598c.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92m-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217m0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334" />
        </svg>
      ),
      title: "Instagram",
      value: "mindmesh_adypu",
      link: "https://www.instagram.com/mindmesh_adypu",
      color: "from-pink-500 via-red-500 to-yellow-500",
    },
    {
      icon: (
        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.063 2.063 0 1 1 0-4.126 2.063 2.063 0 0 1 0 4.126zM6.95 20.452H3.55V9h3.4v11.452z" />
        </svg>
      ),
      title: "LinkedIn",
      value: "Mind Mesh Club",
      link: "https://www.linkedin.com/company/mind-mesh-adypu/",
      color: "from-blue-600 to-blue-800",
    },
    {
      icon: (
        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2H21l-6.48 7.39L22 22h-6.5l-4.27-5.93L6.35 22H3.6l6.92-7.9L2 2h6.64l3.9 5.5L18.24 2zm-2.27 18h1.25L8.06 4H6.7l9.27 16z" />
        </svg>
      ),
      title: "X (Twitter)",
      value: "Mind Mesh Club",
      link: "https://twitter.com/mindmeshclub",
      color: "from-neutral-900 to-gray-800",
    },
    {
      icon: (
        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 16 16">
          <path d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8 8 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032q.003.022.021.037a13.3 13.3 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019q.463-.63.818-1.329a.05.05 0 0 0-.01-.059l-.018-.011a9 9 0 0 1-1.248-.595.05.05 0 0 1-.02-.066l.015-.019q.127-.095.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.007q.121.1.248.195a.05.05 0 0 1-.004.085 8 8 0 0 1-1.249.594.05.05 0 0 0-.03.03.05.05 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.2 13.2 0 0 0 4.001-2.02.05.05 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.03.03 0 0 0-.02-.019m-8.198 7.307c-.789 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612m5.316 0c-.788 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612" />
        </svg>
      ),
      title: "Discord",
      value: "Mind Mesh",
      link: "https://discord.gg/6v89E3SaZT",
      color: "from-indigo-500 to-purple-600",
    },

  ];

  const quickLinks = [
    { label: "Join Our Community", href: "/join" },
    { label: "Upcoming Events", href: "/events" },
    { label: "Resources", href: "/resources" },
    { label: "FAQ", href: "/faq" },
  ];

  return (
    <div className="space-y-16 pb-16">
      {/* Hero Section */}
      <div className="text-center space-y-4 relative">
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-10 right-1/3 w-72 h-72 bg-pink-500/20 rounded-full blur-3xl animate-pulse" />

        <div className="relative z-10">
          <h1 className={title({ size: "lg" })}>
            Get in{" "}
            <span className={title({ color: "violet", size: "lg" })}>Touch</span>
          </h1>
          <p className={subtitle({ class: "mt-4 max-w-2xl mx-auto" })}>
            Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Contact Form */}
        <div className="lg:col-span-2">
          <Card className="border-none shadow-xl" shadow="lg">
            <CardHeader className="flex flex-col items-start px-8 pt-8 pb-0">
              <h2 className="text-2xl font-bold">Send us a Message</h2>
              <p className="text-default-600 mt-2">Fill out the form below and we'll get back to you shortly</p>
            </CardHeader>
            <CardBody className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                {submitStatus.type && (
                  <div
                    className={`p-4 rounded-lg ${submitStatus.type === "success"
                      ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                      : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"
                      }`}
                  >
                    {submitStatus.message}
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  <Input
                    isRequired
                    label="Name"
                    placeholder="Enter your name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    variant="bordered"
                    size="lg"
                    isDisabled={isSubmitting}
                  />
                  <Input
                    isRequired
                    type="email"
                    label="Email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    variant="bordered"
                    size="lg"
                    isDisabled={isSubmitting}
                  />
                </div>
                <Input
                  isRequired
                  label="Subject"
                  placeholder="What is this about?"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  variant="bordered"
                  size="lg"
                  isDisabled={isSubmitting}
                />
                <Textarea
                  isRequired
                  label="Message"
                  placeholder="Tell us more..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  variant="bordered"
                  minRows={6}
                  size="lg"
                  isDisabled={isSubmitting}
                />
                <Button
                  type="submit"
                  size="lg"
                  isLoading={isSubmitting}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all"
                >
                  {isSubmitting ? "Sending..." : "Send Message"}
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>

        {/* Contact Methods & Quick Links */}
        <div className="space-y-6">
          {/* Contact Methods */}
          <Card className="border-none shadow-xl" shadow="lg">
            <CardHeader className="px-6 pt-6 pb-0">
              <h3 className="text-xl font-bold">Connect With Us</h3>
            </CardHeader>
            <CardBody className="p-6 space-y-4">
              {contactMethods.map((method, index) => (
                <Link
                  key={index}
                  href={method.link}
                  isExternal
                  className="flex items-start gap-4 p-4 rounded-lg hover:bg-default-100 dark:hover:bg-default-50 transition-all group"
                >
                  <div className={`p-3 rounded-lg bg-gradient-to-br ${method.color} text-white group-hover:scale-110 transition-transform`}>
                    {method.icon}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{method.title}</p>
                    <p className="text-sm text-default-600 group-hover:text-default-900 dark:group-hover:text-default-100 transition-colors">
                      {method.value}
                    </p>
                  </div>
                </Link>
              ))}
            </CardBody>
          </Card>

         
         
        </div>
      </div>
    </div>
  );
}