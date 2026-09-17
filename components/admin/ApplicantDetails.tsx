"use client";

import { Chip } from "@heroui/react";
import type { Application, Profile } from "@/lib/types";

interface ApplicantDetailsProps {
  profile: Profile | null;
  application: Application;
  accountName?: string;
  departmentNames?: string[];
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-sm whitespace-pre-wrap break-words">{value}</p>
    </div>
  );
}

function LinkField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted">{label}</p>
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-primary hover:underline break-all"
      >
        {value}
      </a>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

/**
 * Everything an applicant submitted, in one read-only view.
 *
 * The queue tables only show identity + status summaries; reviewers deciding
 * on an application need the full profile (contact, academic, statement,
 * socials) plus the application record (oaths, departments, timestamps).
 * Shared by the pending, approved and rejected screens so they cannot drift.
 */
export function ApplicantDetails({
  profile,
  application,
  accountName,
  departmentNames = [],
}: ApplicantDetailsProps) {
  return (
    <div className="space-y-6">
      <Section title="Identity">
        <Field label="Name" value={accountName} />
        <Field label="University Roll Number" value={profile?.urn} />
        <Field label="Phone" value={profile?.phone} />
        <Field label="Date of Birth" value={profile?.dateOfBirth} />
        <Field label="Gender" value={profile?.gender} />
        <Field label="Address" value={profile?.address} />
      </Section>

      <Section title="Academic">
        <Field label="Program" value={profile?.program} />
        <Field label="Branch" value={profile?.branch} />
        <Field label="Year" value={profile?.year} />
        <Field label="Semester" value={profile?.semester} />
      </Section>

      <Section title="Statement">
        <Field label="Why Join" value={profile?.whyJoin} />
        <Field label="Prior Experience" value={profile?.experience} />
        <Field label="Availability" value={profile?.availability} />
        <Field label="Bio" value={profile?.bio} />
      </Section>

      {(profile?.skills?.length || profile?.interests?.length) && (
        <Section title="Skills & Interests">
          {profile?.skills && profile.skills.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted">Skills</p>
              <div className="flex flex-wrap gap-1">
                {profile.skills.map((skill) => (
                  <Chip key={skill} size="sm" variant="soft">
                    {skill}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          {profile?.interests && profile.interests.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted">Interests</p>
              <div className="flex flex-wrap gap-1">
                {profile.interests.map((interest) => (
                  <Chip key={interest} size="sm" variant="soft">
                    {interest}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {(profile?.githubUrl || profile?.linkedinUrl || profile?.portfolioUrl || profile?.instagramUrl) && (
        <Section title="Social">
          <LinkField label="GitHub" value={profile?.githubUrl} />
          <LinkField label="LinkedIn" value={profile?.linkedinUrl} />
          <LinkField label="Portfolio" value={profile?.portfolioUrl} />
          <LinkField label="Instagram" value={profile?.instagramUrl} />
        </Section>
      )}

      <Section title="Application">
        <Field label="Status" value={application.status} />
        <Field
          label="Submitted"
          value={
            application.submittedAt
              ? new Date(application.submittedAt).toLocaleString()
              : undefined
          }
        />
        <Field
          label="Reviewed"
          value={
            application.reviewedAt
              ? new Date(application.reviewedAt).toLocaleString()
              : undefined
          }
        />
        <Field label="Rejection Reason" value={application.rejectionReason} />
        <Field
          label="Acknowledgements"
          value={[
            application.oathAccepted ? "Oath" : null,
            application.termsAccepted ? "Terms" : null,
            application.constitutionAccepted ? "Constitution" : null,
          ]
            .filter(Boolean)
            .join(", ")}
        />
        {departmentNames.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted">Preferred Departments</p>
            <div className="flex flex-wrap gap-1">
              {departmentNames.map((name) => (
                <Chip key={name} size="sm" variant="soft" color="accent">
                  {name}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
