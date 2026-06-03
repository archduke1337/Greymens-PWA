"use client";
import { Accordion, AccordionItem, AccordionHeading, AccordionTrigger, AccordionIndicator, AccordionPanel, AccordionBody, Card, CardContent, CardHeader, Chip, Separator } from "@heroui/react";

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
        <Chip size="sm" variant="primary">
          Last Updated: {lastUpdated}
        </Chip>
      </div>

      <Separator className="my-8" />

      {/* Member Terms */}
      <Card className="border-none">
        <CardHeader className="flex flex-col items-start px-6 pt-6 pb-4">
          <h2 className="text-2xl font-semibold">Member Terms</h2>
          <p className="text-sm text-default-600 mt-1">
            Guidelines for all Mind Mesh members
          </p>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <Accordion>
            <AccordionItem id="eligibility" className="text-sm">
              <AccordionHeading>
                <AccordionTrigger>
                  Eligibility
                  <AccordionIndicator />
                </AccordionTrigger>
              </AccordionHeading>
              <AccordionPanel>
                <AccordionBody>
                  <ul className="text-default-600 space-y-2 list-disc pl-5">
                    <li>Open to students, professionals, and enthusiasts</li>
                    <li>Minimum age requirement: 16 years</li>
                    <li>Expected participation: 50% of club activities per semester</li>
                  </ul>
                </AccordionBody>
              </AccordionPanel>
            </AccordionItem>

            <AccordionItem id="member-benefits" className="text-sm">
              <AccordionHeading>
                <AccordionTrigger>
                  Member Benefits
                  <AccordionIndicator />
                </AccordionTrigger>
              </AccordionHeading>
              <AccordionPanel>
                <AccordionBody>
                  <ul className="text-default-600 space-y-2 list-disc pl-5">
                    <li>Access to all events, workshops, and sessions</li>
                    <li>Voting rights in club decisions</li>
                    <li>Use of club resources and equipment</li>
                    <li>Mentorship opportunities</li>
                    <li>Certificate of membership</li>
                  </ul>
                </AccordionBody>
              </AccordionPanel>
            </AccordionItem>

            <AccordionItem id="member-responsibilities" className="text-sm">
              <AccordionHeading>
                <AccordionTrigger>
                  Member Responsibilities
                  <AccordionIndicator />
                </AccordionTrigger>
              </AccordionHeading>
              <AccordionPanel>
                <AccordionBody>
                  <ul className="text-default-600 space-y-2 list-disc pl-5">
                    <li>Uphold club values and code of conduct</li>
                    <li>Respect intellectual property rights</li>
                    <li>Maintain professional behavior</li>
                    <li>Pay membership dues on time (if applicable)</li>
                  </ul>
                </AccordionBody>
              </AccordionPanel>
            </AccordionItem>

            <AccordionItem id="code-of-conduct" className="text-sm">
              <AccordionHeading>
                <AccordionTrigger>
                  Code of Conduct
                  <AccordionIndicator />
                </AccordionTrigger>
              </AccordionHeading>
              <AccordionPanel>
                <AccordionBody>
                  <ul className="text-default-600 space-y-2 list-disc pl-5">
                    <li>Treat all members with respect</li>
                    <li>Foster inclusive environment</li>
                    <li>Maintain integrity in all interactions</li>
                    <li>Zero tolerance for harassment or discrimination</li>
                  </ul>
                </AccordionBody>
              </AccordionPanel>
            </AccordionItem>

            <AccordionItem id="termination" className="text-sm">
              <AccordionHeading>
                <AccordionTrigger>
                  Termination
                  <AccordionIndicator />
                </AccordionTrigger>
              </AccordionHeading>
              <AccordionPanel>
                <AccordionBody>
                  <p className="text-default-600 mb-2">
                    Membership may be terminated for:
                  </p>
                  <ul className="text-default-600 space-y-2 list-disc pl-5">
                    <li>Violation of policies or code of conduct</li>
                    <li>Consistent non-participation</li>
                    <li>Non-payment of dues (90+ days)</li>
                    <li>Voluntary resignation (30-day notice)</li>
                  </ul>
                </AccordionBody>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Sponsor Terms */}
      <Card className="border-none">
        <CardHeader className="flex flex-col items-start px-6 pt-6 pb-4">
          <h2 className="text-2xl font-semibold">Sponsor Terms</h2>
          <p className="text-sm text-default-600 mt-1">
            Partnership and sponsorship guidelines
          </p>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <Accordion>
            <AccordionItem id="sponsorship-tiers" className="text-sm">
              <AccordionHeading>
                <AccordionTrigger>
                  Sponsorship Tiers
                  <AccordionIndicator />
                </AccordionTrigger>
              </AccordionHeading>
              <AccordionPanel>
                <AccordionBody>
                  <div className="text-default-600 space-y-3">
                    <div>
                      <p className="font-semibold">Platinum ($5000+)</p>
                      <p className="text-sm pl-4">
                        Premium branding, speaking slots, talent access
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold">Gold ($2500-$4999)</p>
                      <p className="text-sm pl-4">
                        Logo placement, booth space, social recognition
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold">Silver ($1000-$2499)</p>
                      <p className="text-sm pl-4">
                        Website listing, event recognition
                      </p>
                    </div>
                  </div>
                </AccordionBody>
              </AccordionPanel>
            </AccordionItem>

            <AccordionItem id="sponsor-obligations" className="text-sm">
              <AccordionHeading>
                <AccordionTrigger>
                  Sponsor Obligations
                  <AccordionIndicator />
                </AccordionTrigger>
              </AccordionHeading>
              <AccordionPanel>
                <AccordionBody>
                  <ul className="text-default-600 space-y-2 list-disc pl-5">
                    <li>Timely payment of sponsorship fees</li>
                    <li>Provide marketing materials within 14 days</li>
                    <li>Maintain professional conduct</li>
                    <li>30-day notice for any changes</li>
                  </ul>
                </AccordionBody>
              </AccordionPanel>
            </AccordionItem>

            <AccordionItem id="intellectual-property" className="text-sm">
              <AccordionHeading>
                <AccordionTrigger>
                  Intellectual Property
                  <AccordionIndicator />
                </AccordionTrigger>
              </AccordionHeading>
              <AccordionPanel>
                <AccordionBody>
                  <ul className="text-default-600 space-y-2 list-disc pl-5">
                    <li>Sponsors retain rights to their brand materials</li>
                    <li>Club receives limited license for promotion</li>
                    <li>Original club content remains club property</li>
                  </ul>
                </AccordionBody>
              </AccordionPanel>
            </AccordionItem>

            <AccordionItem id="contract-duration" className="text-sm">
              <AccordionHeading>
                <AccordionTrigger>
                  Contract Duration
                  <AccordionIndicator />
                </AccordionTrigger>
              </AccordionHeading>
              <AccordionPanel>
                <AccordionBody>
                  <ul className="text-default-600 space-y-2 list-disc pl-5">
                    <li>Standard term: 12 months</li>
                    <li>60-day notice for termination</li>
                    <li>Renewal discussions begin 60 days before expiration</li>
                  </ul>
                </AccordionBody>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Privacy Policy */}
      <Card className="border-none">
        <CardHeader className="flex flex-col items-start px-6 pt-6 pb-4">
          <h2 className="text-2xl font-semibold">Privacy Policy</h2>
          <p className="text-sm text-default-600 mt-1">
            How we collect and protect your data
          </p>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <Accordion>
            <AccordionItem id="data-collect" className="text-sm">
              <AccordionHeading>
                <AccordionTrigger>
                  Data We Collect
                  <AccordionIndicator />
                </AccordionTrigger>
              </AccordionHeading>
              <AccordionPanel>
                <AccordionBody>
                  <ul className="text-default-600 space-y-2 list-disc pl-5">
                    <li>Name, email, and contact information</li>
                    <li>Educational background and skills</li>
                    <li>Event attendance records</li>
                    <li>Photos and videos (with consent)</li>
                  </ul>
                </AccordionBody>
              </AccordionPanel>
            </AccordionItem>

            <AccordionItem id="how-we-use-data" className="text-sm">
              <AccordionHeading>
                <AccordionTrigger>
                  How We Use Data
                  <AccordionIndicator />
                </AccordionTrigger>
              </AccordionHeading>
              <AccordionPanel>
                <AccordionBody>
                  <ul className="text-default-600 space-y-2 list-disc pl-5">
                    <li>Communicate updates and events</li>
                    <li>Manage memberships and payments</li>
                    <li>Improve club services</li>
                    <li>Provide anonymized analytics to sponsors</li>
                  </ul>
                </AccordionBody>
              </AccordionPanel>
            </AccordionItem>

            <AccordionItem id="data-protection" className="text-sm">
              <AccordionHeading>
                <AccordionTrigger>
                  Data Protection
                  <AccordionIndicator />
                </AccordionTrigger>
              </AccordionHeading>
              <AccordionPanel>
                <AccordionBody>
                  <ul className="text-default-600 space-y-2 list-disc pl-5">
                    <li>Secure, encrypted storage</li>
                    <li>Access restricted to authorized admin</li>
                    <li>Regular security audits</li>
                    <li>No selling of personal data</li>
                    <li>GDPR compliant</li>
                  </ul>
                </AccordionBody>
              </AccordionPanel>
            </AccordionItem>

            <AccordionItem id="your-rights" className="text-sm">
              <AccordionHeading>
                <AccordionTrigger>
                  Your Rights
                  <AccordionIndicator />
                </AccordionTrigger>
              </AccordionHeading>
              <AccordionPanel>
                <AccordionBody>
                  <ul className="text-default-600 space-y-2 list-disc pl-5">
                    <li>Request access to your data</li>
                    <li>Correct or update information</li>
                    <li>Request data deletion</li>
                    <li>Opt-out of communications</li>
                    <li>Contact: privacy@mindmesh.club</li>
                  </ul>
                </AccordionBody>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Additional Policies Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-none">
          <CardContent className="p-6">
            <h3 className="font-semibold text-lg mb-2">Refund Policy</h3>
            <p className="text-sm text-default-600">
              Event fees non-refundable within 7 days of event. Membership fees
              refundable within 30 days with valid reason.
            </p>
          </CardContent>
        </Card>

        <Card className="border-none">
          <CardContent className="p-6">
            <h3 className="font-semibold text-lg mb-2">Media Policy</h3>
            <p className="text-sm text-default-600">
              Photos and videos may be taken at events. Members can opt-out by
              notifying organizers in advance.
            </p>
          </CardContent>
        </Card>

        <Card className="border-none">
          <CardContent className="p-6">
            <h3 className="font-semibold text-lg mb-2">Liability</h3>
            <p className="text-sm text-default-600">
              Members participate at their own risk. Club not liable for
              injuries except in cases of gross negligence.
            </p>
          </CardContent>
        </Card>

        <Card className="border-none">
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
      <Card className="border-none bg-default-50">
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
