import { Card, CardContent, CardHeader, Accordion, AccordionItem, Chip, Separator } from "@heroui/react";
"use client";
export default function TermsPage() {
  const lastUpdated = "November 1, 2025";

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16 px-4">
      {/* Header */}
      <div className="space-y-3">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Terms and Conditions
        </h1>
        <p className="text-lg text-default-600 max-w-3xl">
          Please review our terms, policies, and guidelines carefully
        </p>
        <Chip size="sm" variant="primary" selectionMode="multiple">
            <AccordionItem
              key="collection"
              aria-label="Data Collection"
              title="Data We Collect"
              className="text-sm"
            >
              <ul className="text-default-600 space-y-2 list-disc pl-5">
                <li>Name, email, and contact information</li>
                <li>Educational background and skills</li>
                <li>Event attendance records</li>
                <li>Photos and videos (with consent)</li>
              </ul>
            </AccordionItem>

            <AccordionItem
              key="usage"
              aria-label="Data Usage"
              title="How We Use Data"
              className="text-sm"
            >
              <ul className="text-default-600 space-y-2 list-disc pl-5">
                <li>Communicate updates and events</li>
                <li>Manage memberships and payments</li>
                <li>Improve club services</li>
                <li>Provide anonymized analytics to sponsors</li>
              </ul>
            </AccordionItem>

            <AccordionItem
              key="protection"
              aria-label="Data Protection"
              title="Data Protection"
              className="text-sm"
            >
              <ul className="text-default-600 space-y-2 list-disc pl-5">
                <li>Secure, encrypted storage</li>
                <li>Access restricted to authorized admin</li>
                <li>Regular security audits</li>
                <li>No selling of personal data</li>
                <li>GDPR compliant</li>
              </ul>
            </AccordionItem>

            <AccordionItem
              key="rights"
              aria-label="Your Rights"
              title="Your Rights"
              className="text-sm"
            >
              <ul className="text-default-600 space-y-2 list-disc pl-5">
                <li>Request access to your data</li>
                <li>Correct or update information</li>
                <li>Request data deletion</li>
                <li>Opt-out of communications</li>
                <li>Contact: privacy@mindmesh.club</li>
              </ul>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Additional Policies Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card  className="border-none shadow-sm">
          <CardContent className="p-6">
            <h3 className="font-semibold text-lg mb-2">Refund Policy</h3>
            <p className="text-sm text-default-600">
              Event fees non-refundable within 7 days of event. Membership fees
              refundable within 30 days with valid reason.
            </p>
          </CardContent>
        </Card>

        <Card  className="border-none shadow-sm">
          <CardContent className="p-6">
            <h3 className="font-semibold text-lg mb-2">Media Policy</h3>
            <p className="text-sm text-default-600">
              Photos and videos may be taken at events. Members can opt-out by
              notifying organizers in advance.
            </p>
          </CardContent>
        </Card>

        <Card  className="border-none shadow-sm">
          <CardContent className="p-6">
            <h3 className="font-semibold text-lg mb-2">Liability</h3>
            <p className="text-sm text-default-600">
              Members participate at their own risk. Club not liable for
              injuries except in cases of gross negligence.
            </p>
          </CardContent>
        </Card>

        <Card  className="border-none shadow-sm">
          <CardContent className="p-6">
            <h3 className="font-semibold text-lg mb-2">Contact</h3>
            <p className="text-sm text-default-600">
              Questions? Email legal@mindmesh.club or visit our office during
              business hours.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <Card  className="border-none bg-default-50 shadow-sm">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-default-600">
            These terms are subject to change. Members will be notified of
            updates. By continuing membership, you agree to these terms.
          </p>
          <p className="text-xs text-default-500 mt-2">
            © 2025 Mind Mesh. All rights reserved.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}