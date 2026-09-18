"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { toast } from "sonner";
import { readApiError } from "@/lib/errorHandler";
import { Button, Checkbox, Input, Label, ListBox, Select, TextArea } from "@heroui/react";
import type { Department } from "@/lib/types";

const STEPS = [
  { id: 1, title: "Personal Info", description: "Basic personal details" },
  { id: 2, title: "Academic", description: "Academic information" },
  { id: 3, title: "Interests", description: "Club interests & skills" },
  { id: 4, title: "Social", description: "Social profiles" },
  { id: 5, title: "Legal", description: "Terms & oath" },
];

interface OnboardingForm {
  phone: string;
  urn: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  program: string;
  branch: string;
  year: string;
  semester: string;
  preferredDepartments: string[];
  skills: string[];
  interests: string[];
  experience: string;
  whyJoin: string;
  availability: string;
  profileVisibility: string;
  githubUrl: string;
  linkedinUrl: string;
  portfolioUrl: string;
  instagramUrl: string;
  bio: string;
  oathAccepted: boolean;
  termsAccepted: boolean;
  constitutionAccepted: boolean;
}

const EMPTY_FORM: OnboardingForm = {
  phone: "",
  urn: "",
  dateOfBirth: "",
  gender: "",
  address: "",
  program: "",
  branch: "",
  year: "",
  semester: "",
  preferredDepartments: [],
  skills: [],
  interests: [],
  experience: "",
  whyJoin: "",
  availability: "full",
  profileVisibility: "members_only",
  githubUrl: "",
  linkedinUrl: "",
  portfolioUrl: "",
  instagramUrl: "",
  bio: "",
  oathAccepted: false,
  termsAccepted: false,
  constitutionAccepted: false,
};

const DRAFT_VERSION = 1;

function draftKey(userId: string): string {
  return `onboarding-draft:${userId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((item) => typeof item === "string")) return null;
  return value as string[];
}

/** Split a comma-separated field the way the inputs promise ("a, b, c"). */
function parseList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Overlay a stored draft: non-empty draft values win (newest user intent). */
function mergeDraft(
  base: OnboardingForm,
  draft: Record<string, unknown>,
): OnboardingForm {
  const next: OnboardingForm = { ...base };

  for (const key of Object.keys(base) as Array<keyof OnboardingForm>) {
    const incoming = draft[key];
    if (incoming === undefined || incoming === null) continue;
    const current = base[key];

    if (typeof current === "string") {
      if (typeof incoming === "string" && incoming !== "") {
        (next[key] as string) = incoming;
      }
    } else if (Array.isArray(current)) {
      const list = stringArray(incoming);
      if (list && list.length > 0) (next[key] as string[]) = list;
    } else if (typeof current === "boolean") {
      if (typeof incoming === "boolean") (next[key] as boolean) = incoming;
    }
  }
  return next;
}

function readDraft(userId: string): {
  step: number;
  form: Record<string, unknown>;
  hasContent: boolean;
} | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(draftKey(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.v !== DRAFT_VERSION) return null;
    const step =
      typeof parsed.step === "number" &&
      Number.isInteger(parsed.step) &&
      parsed.step >= 1 &&
      parsed.step <= STEPS.length
        ? parsed.step
        : 1;
    const form = isRecord(parsed.form) ? parsed.form : {};
    const hasContent = Object.values(form).some((value) =>
      typeof value === "string"
        ? value !== ""
        : Array.isArray(value)
          ? value.length > 0
          : value === true,
    );
    return { step, form, hasContent };
  } catch {
    return null;
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { status, application, profile, loading: permLoading, refresh } = usePermissions();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptLoading, setDeptLoading] = useState(true);
  const [deptError, setDeptError] = useState(false);
  const [deptReloadKey, setDeptReloadKey] = useState(0);
  // Initialization runs once per account: server prefill first, then the
  // local draft over it. Later context refetches must not clobber edits.
  const initializedRef = useRef<string | null>(null);

  const [formData, setFormData] = useState<OnboardingForm>(EMPTY_FORM);
  // Raw text for the comma-separated inputs. The arrays in formData are parsed
  // copies kept in sync on every keystroke. Binding the inputs directly to
  // `skills.join(", ")` re-parsed on each change, which ate every comma and
  // space as it was typed and made multiple entries impossible.
  const [skillsText, setSkillsText] = useState("");
  const [interestsText, setInterestsText] = useState("");
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    if (permLoading) return;
    if (status === "no_account" || status === "account") return;
    // The server maps rejected applications to `applicant`; a rejected
    // applicant must stay on the form to reapply instead of bouncing to /dashboard.
    if (status === "applicant" && application?.status === "rejected") return;
    router.push("/dashboard");
  }, [status, application?.status, permLoading, router]);

  // Logged-out visitors cannot submit (the API is session-gated), so send
  // them through login first and bring them back — instead of letting them
  // complete five steps only to fail at submission.
  useEffect(() => {
    if (!authLoading && !permLoading && !user) {
      router.push("/login?next=%2Fonboarding");
    }
  }, [authLoading, permLoading, user, router]);

  // One-time initialization per account, in priority order:
  // 1. server prefill (reapply data), 2. local draft overlay (newest intent).
  // Runs only after the permission context settles, so "no server data" is a
  // real answer rather than a loading race. Later refetches never rewrite.
  useEffect(() => {
    if (!user || permLoading) return;
    if (initializedRef.current === user.$id) return;
    initializedRef.current = user.$id;

    let next: OnboardingForm = { ...EMPTY_FORM };
    if (profile || application) {
      // Direct nullish picks (no generic helper: it widens key inference and
      // breaks field types). Server values fill gaps; blanks keep current.
      next = {
        ...next,
        phone: profile?.phone ?? next.phone,
        urn: profile?.urn ?? next.urn,
        dateOfBirth: profile?.dateOfBirth ?? next.dateOfBirth,
        gender: profile?.gender ?? next.gender,
        address: profile?.address ?? next.address,
        program: profile?.program ?? next.program,
        branch: profile?.branch ?? next.branch,
        year: profile?.year ?? next.year,
        semester: profile?.semester ?? next.semester,
        skills: profile?.skills ?? next.skills,
        interests: profile?.interests ?? next.interests,
        experience: profile?.experience ?? next.experience,
        whyJoin: profile?.whyJoin ?? next.whyJoin,
        availability: profile?.availability ?? next.availability,
        profileVisibility: profile?.profileVisibility ?? next.profileVisibility,
        githubUrl: profile?.githubUrl ?? next.githubUrl,
        linkedinUrl: profile?.linkedinUrl ?? next.linkedinUrl,
        portfolioUrl: profile?.portfolioUrl ?? next.portfolioUrl,
        instagramUrl: profile?.instagramUrl ?? next.instagramUrl,
        bio: profile?.bio ?? next.bio,
        preferredDepartments:
          application?.preferredDepartments ?? next.preferredDepartments,
      };
    }

    const draft = readDraft(user.$id);
    if (draft) {
      next = mergeDraft(next, draft.form);
      setStep(draft.step);
      if (draft.hasContent) {
        setDraftRestored(true);
        toast.info("Draft restored — pick up where you left off.");
      }
    }
    setFormData(next);
    setSkillsText(next.skills.join(", "));
    setInterestsText(next.interests.join(", "));
  }, [user, permLoading, profile, application]);

  // Autosave every edit (debounced) under the account id, so a reload, a
  // dead tab, or a failed catalogue fetch never loses half-filled input.
  // Never saves before initialization completes.
  useEffect(() => {
    if (!user || initializedRef.current !== user.$id) return;
    const timer = setTimeout(() => {
      try {
        if (typeof window === "undefined" || !window.localStorage) return;
        window.localStorage.setItem(
          draftKey(user.$id),
          JSON.stringify({ v: DRAFT_VERSION, savedAt: Date.now(), step, form: formData }),
        );
      } catch {
        // Private mode / quota: the form still works, it just won't persist.
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [formData, step, user]);

  useEffect(() => {
    let cancelled = false;
    setDeptLoading(true);
    fetch("/api/departments", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load departments");
        return (await response.json()) as { departments?: Department[] };
      })
      .then((payload) => {
        if (!cancelled) {
          setDepartments(payload.departments ?? []);
          setDeptError(false);
          setDeptLoading(false);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Department catalogue error:", error);
          setDeptError(true);
          setDeptLoading(false);
          // No toast: the inline banner below already explains + offers retry.
          // A second identical message only reads as a second failure.
        }
      });

    return () => {
      cancelled = true;
    };
  }, [deptReloadKey]);

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleArrayField = (field: "preferredDepartments" | "skills" | "interests", value: string) => {
    setFormData((prev) => {
      const arr = prev[field] as string[];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  };

  const validateStep = (currentStep: number): boolean => {
    switch (currentStep) {
      case 1:
        if (!formData.phone.trim()) {
          toast.error("Phone number is required");
          return false;
        }
        if (!formData.urn.trim()) {
          toast.error("University roll number is required");
          return false;
        }
        if (!formData.dateOfBirth) {
          toast.error("Date of birth is required");
          return false;
        }
        if (!formData.gender) {
          toast.error("Gender is required");
          return false;
        }
        return true;
      case 2:
        if (!formData.program) {
          toast.error("Program is required");
          return false;
        }
        if (!formData.branch) {
          toast.error("Branch is required");
          return false;
        }
        if (!formData.year) {
          toast.error("Year is required");
          return false;
        }
        if (!formData.semester) {
          toast.error("Semester is required");
          return false;
        }
        return true;
      case 3:
        if (formData.preferredDepartments.length < 1) {
          toast.error("Select at least one department");
          return false;
        }
        if (!formData.whyJoin.trim()) {
          toast.error("Please tell us why you want to join");
          return false;
        }
        if (!formData.availability) {
          toast.error("Availability is required");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (step === 3 && (deptLoading || deptError)) {
      toast.error(
        deptLoading
          ? "Departments are still loading. Please wait a moment."
          : "Departments could not be loaded. Retry below before continuing.",
      );
      return;
    }
    if (!validateStep(step)) return;
    setStep((prev) => Math.min(prev + 1, STEPS.length));
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Please login to submit your application");
      router.push("/login");
      return;
    }
    if (!formData.oathAccepted || !formData.termsAccepted || !formData.constitutionAccepted) {
      toast.error("Please accept all terms and oaths");
      return;
    }
    if (
      !formData.phone.trim() ||
      !formData.urn.trim() ||
      !formData.dateOfBirth ||
      !formData.gender ||
      !formData.program ||
      !formData.branch ||
      !formData.year ||
      !formData.semester ||
      !formData.whyJoin.trim() ||
      !formData.availability
    ) {
      toast.error("Please fill all required fields");
      return;
    }
    if (formData.preferredDepartments.length < 1) {
      toast.error("Select at least one department");
      return;
    }

    setLoading(true);
    try {
      // Trim copy-paste whitespace: a trailing space turns a valid URL or
      // URN into a server 400 with no visible cause on the form.
      const clean = (value: string) => value.trim();
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          profile: {
            phone: clean(formData.phone),
            urn: clean(formData.urn),
            dateOfBirth: formData.dateOfBirth,
            gender: formData.gender,
            address: formData.address,
            program: formData.program,
            branch: formData.branch,
            year: formData.year,
            semester: formData.semester,
            skills: formData.skills,
            interests: formData.interests,
            experience: formData.experience,
            whyJoin: formData.whyJoin,
            availability: formData.availability,
            githubUrl: clean(formData.githubUrl),
            linkedinUrl: clean(formData.linkedinUrl),
            portfolioUrl: clean(formData.portfolioUrl),
            instagramUrl: clean(formData.instagramUrl),
            bio: formData.bio,
            profileVisibility: formData.profileVisibility,
          },
          application: {
            oathAccepted: formData.oathAccepted,
            termsAccepted: formData.termsAccepted,
            constitutionAccepted: formData.constitutionAccepted,
            preferredDepartments: formData.preferredDepartments,
          },
        }),
      });

      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        // Route the caller somewhere useful instead of dead-ending on the
        // form: an existing application belongs on the dashboard, an expired
        // session belongs on login.
        if (response.status === 409) {
          toast.error("You already have an application under review — check your dashboard.");
          router.push("/dashboard");
          return;
        }
        if (response.status === 429) {
          throw new Error("Too many attempts. Please wait a few minutes and try again.");
        }
        if (response.status === 401) {
          toast.error("Your session expired. Please log in again.");
          router.push("/login?next=%2Fonboarding");
          return;
        }
        if (response.status === 403) {
          throw new Error("This account can't submit applications right now. Contact an administrator.");
        }
        throw new Error(readApiError(payload, "Failed to submit application"));
      }

      toast.success("Application submitted successfully!");
      // Submitted — the draft has served its purpose.
      try {
        window.localStorage.removeItem(draftKey(user.$id));
      } catch {
        // Ignore storage failures on the success path.
      }
      // Refresh permissions before leaving: without this the dashboard renders
      // the stale pre-submit snapshot (e.g. "rejected — reapply") until reload.
      try {
        await refresh();
      } catch {
        // Non-blocking: navigation still applies.
      }
      router.push("/dashboard");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit application"
      );
    } finally {
      setLoading(false);
    }
  };

  if (permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 space-y-3">
          <img
            src="/Assets/Objects/welcome.png"
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="mx-auto h-20 w-20 rounded-3xl border border-default-200/70 bg-background object-cover"
          />
          <h1 className="text-3xl font-bold tracking-tight">Join Greymens Club</h1>
          <p className="text-muted-foreground mt-2">Complete your membership application</p>
          <p className="text-xs text-muted-foreground mt-1" role="note">
            {draftRestored
              ? "Restored your saved progress — it keeps saving as you type."
              : "Your progress saves automatically on this device as you type."}
          </p>
        </div>

        {/* Progress: completed steps are buttons back to that step; the
            current step is marked for assistive tech. Forward jumps stay
            gated by validation on Next. */}
        <div className="flex items-center justify-between mb-8" role="list" aria-label="Onboarding progress">
          {STEPS.map((s, i) => {
            const completed = s.id < step;
            return (
              <div key={s.id} className="flex items-center" role="listitem" aria-current={step === s.id ? "step" : undefined}>
                {completed ? (
                  <button
                    type="button"
                    onClick={() => setStep(s.id)}
                    aria-label={`Back to step ${s.id}: ${s.title}`}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    {s.id}
                  </button>
                ) : (
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step >= s.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s.id}
                  </div>
                )}
                {i < STEPS.length - 1 && (
                  <div className={`w-12 h-0.5 mx-1 ${step > s.id ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step title */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold">{STEPS[step - 1].title}</h2>
          <p className="text-sm text-muted-foreground">{STEPS[step - 1].description}</p>
        </div>

        {/* Form */}
        <div className="bg-card rounded-lg border p-6 space-y-4">
          {step === 1 && (
            <>
              <div className="space-y-1">
                <Label htmlFor="onboarding-phone">Phone Number *</Label>
                <Input
                  id="onboarding-phone"
                  type="tel"
                  fullWidth
                  value={formData.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="+91 9876543210"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="onboarding-urn">University Roll Number *</Label>
                <Input
                  id="onboarding-urn"
                  type="text"
                  fullWidth
                  value={formData.urn}
                  onChange={(e) => updateField("urn", e.target.value)}
                  placeholder="e.g., 2100320100001"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="onboarding-dob">Date of Birth *</Label>
                  <Input
                    id="onboarding-dob"
                    type="date"
                    fullWidth
                    value={formData.dateOfBirth}
                    onChange={(e) => updateField("dateOfBirth", e.target.value)}
                  />
                </div>
                <div>
                  <Select
                    fullWidth
                    placeholder="Select"
                    value={formData.gender === "" ? null : formData.gender}
                    onChange={(value) => updateField("gender", String(value ?? ""))}
                  >
                    <Label>Gender *</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="male" textValue="Male">
                          Male
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                        <ListBox.Item id="female" textValue="Female">
                          Female
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                        <ListBox.Item id="other" textValue="Other">
                          Other
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                        <ListBox.Item id="prefer_not_to_say" textValue="Prefer not to say">
                          Prefer not to say
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="onboarding-address">Address</Label>
                <TextArea
                  id="onboarding-address"
                  fullWidth
                  value={formData.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  rows={2}
                  placeholder="Residential address"
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <Select
                  fullWidth
                  placeholder="Select"
                  value={formData.program === "" ? null : formData.program}
                  onChange={(value) => updateField("program", String(value ?? ""))}
                >
                  <Label>Program *</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {["B.Tech", "M.Tech", "BCA", "MCA", "B.Sc", "M.Sc", "MBA", "PhD"].map((program) => (
                        <ListBox.Item key={program} id={program} textValue={program}>
                          {program}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
              <div>
                <Select
                  fullWidth
                  placeholder="Select"
                  value={formData.branch === "" ? null : formData.branch}
                  onChange={(value) => updateField("branch", String(value ?? ""))}
                >
                  <Label>Branch *</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {["Computer Science", "Information Technology", "Electronics", "Electrical", "Mechanical", "Civil", "Other"].map((branch) => (
                        <ListBox.Item key={branch} id={branch} textValue={branch}>
                          {branch}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Select
                    fullWidth
                    placeholder="Select"
                    value={formData.year === "" ? null : formData.year}
                    onChange={(value) => updateField("year", String(value ?? ""))}
                  >
                    <Label>Year *</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {["1st", "2nd", "3rd", "4th"].map((year) => (
                          <ListBox.Item key={year} id={year} textValue={`${year} Year`}>
                            {year} Year
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
                <div>
                  <Select
                    fullWidth
                    placeholder="Select"
                    value={formData.semester === "" ? null : formData.semester}
                    onChange={(value) => updateField("semester", String(value ?? ""))}
                  >
                    <Label>Semester *</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                          <ListBox.Item key={s} id={String(s)} textValue={`Semester ${s}`}>
                            Semester {s}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <span id="onboarding-depts-label" className="text-sm font-medium">Preferred Departments * (select at least 1)</span>
                <div className="grid grid-cols-2 gap-2 mt-2" role="group" aria-labelledby="onboarding-depts-label">
                  {departments.map((dept) => (
                    <button
                      key={dept.$id}
                      type="button"
                      aria-pressed={formData.preferredDepartments.includes(dept.$id!)}
                      onClick={() => toggleArrayField("preferredDepartments", dept.$id!)}
                      className={`p-2 rounded-md border text-left text-sm ${
                        formData.preferredDepartments.includes(dept.$id!)
                          ? "border-primary bg-primary/10"
                          : "border-border"
                      }`}
                    >
                      {dept.icon} {dept.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="onboarding-skills">Skills</Label>
                <Input
                  id="onboarding-skills"
                  type="text"
                  fullWidth
                  placeholder="React, Python, Design (comma separated)"
                  value={skillsText}
                  onChange={(e) => {
                    setSkillsText(e.target.value);
                    updateField("skills", parseList(e.target.value));
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="onboarding-interests">Interests</Label>
                <Input
                  id="onboarding-interests"
                  type="text"
                  fullWidth
                  placeholder="AI, Web Dev, Cybersecurity (comma separated)"
                  value={interestsText}
                  onChange={(e) => {
                    setInterestsText(e.target.value);
                    updateField("interests", parseList(e.target.value));
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="onboarding-experience">Prior Experience</Label>
                <TextArea
                  id="onboarding-experience"
                  fullWidth
                  value={formData.experience}
                  onChange={(e) => updateField("experience", e.target.value)}
                  rows={3}
                  placeholder="Any prior club experience or relevant projects..."
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="onboarding-whyjoin">Why do you want to join? *</Label>
                <TextArea
                  id="onboarding-whyjoin"
                  fullWidth
                  value={formData.whyJoin}
                  onChange={(e) => updateField("whyJoin", e.target.value)}
                  rows={3}
                  placeholder="Tell us why you want to join Greymens Club..."
                />
              </div>
              <div>
                <Select
                  fullWidth
                  value={formData.availability}
                  onChange={(value) => updateField("availability", String(value ?? "full"))}
                >
                  <Label>Availability *</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="full" textValue="Full time">
                        Full time
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="partial" textValue="Partial">
                        Partial
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="event_only" textValue="Events only">
                        Events only
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
              <div>
                <Select
                  fullWidth
                  value={formData.profileVisibility}
                  onChange={(value) => updateField("profileVisibility", String(value ?? "members_only"))}
                >
                  <Label>Who can see your profile</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="members_only" textValue="Members only">
                        Members only
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="public" textValue="Public">
                        Public
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="private" textValue="Private">
                        Private
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div className="space-y-1">
                <Label htmlFor="onboarding-bio">Bio</Label>
                <TextArea
                  id="onboarding-bio"
                  fullWidth
                  value={formData.bio}
                  onChange={(e) => updateField("bio", e.target.value)}
                  rows={3}
                  placeholder="A short bio about yourself..."
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="onboarding-github">GitHub URL <span className="font-normal text-muted">(optional)</span></Label>
                <Input
                  id="onboarding-github"
                  type="url"
                  fullWidth
                  value={formData.githubUrl}
                  onChange={(e) => updateField("githubUrl", e.target.value)}
                  placeholder="https://github.com/username"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="onboarding-linkedin">LinkedIn URL <span className="font-normal text-muted">(optional)</span></Label>
                <Input
                  id="onboarding-linkedin"
                  type="url"
                  fullWidth
                  value={formData.linkedinUrl}
                  onChange={(e) => updateField("linkedinUrl", e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="onboarding-portfolio">Portfolio URL <span className="font-normal text-muted">(optional)</span></Label>
                <Input
                  id="onboarding-portfolio"
                  type="url"
                  fullWidth
                  value={formData.portfolioUrl}
                  onChange={(e) => updateField("portfolioUrl", e.target.value)}
                  placeholder="https://yourportfolio.com"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="onboarding-instagram">Instagram URL <span className="font-normal text-muted">(optional)</span></Label>
                <Input
                  id="onboarding-instagram"
                  type="url"
                  fullWidth
                  value={formData.instagramUrl}
                  onChange={(e) => updateField("instagramUrl", e.target.value)}
                  placeholder="https://instagram.com/username"
                />
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <div className="space-y-4">
                <Checkbox
                  isSelected={formData.oathAccepted}
                  onChange={(value) => updateField("oathAccepted", value)}
                  className="flex items-start gap-3 p-4 rounded-md border cursor-pointer"
                >
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <div>
                      <div className="font-medium">Club Oath</div>
                      <div className="text-sm text-muted-foreground">
                        I solemnly pledge to uphold the values and mission of Greymens Club, to contribute actively
                        to its growth, and to maintain the highest standards of integrity and collaboration.
                      </div>
                    </div>
                  </Checkbox.Content>
                </Checkbox>
                <Checkbox
                  isSelected={formData.termsAccepted}
                  onChange={(value) => updateField("termsAccepted", value)}
                  className="flex items-start gap-3 p-4 rounded-md border cursor-pointer"
                >
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <div>
                      <div className="font-medium">Terms of Service</div>
                      <div className="text-sm text-muted-foreground">
                        I agree to the terms of service and code of conduct of Greymens Club.
                      </div>
                    </div>
                  </Checkbox.Content>
                </Checkbox>
                <Checkbox
                  isSelected={formData.constitutionAccepted}
                  onChange={(value) => updateField("constitutionAccepted", value)}
                  className="flex items-start gap-3 p-4 rounded-md border cursor-pointer"
                >
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <div>
                      <div className="font-medium">Constitution Acknowledgment</div>
                      <div className="text-sm text-muted-foreground">
                        I have read and acknowledge the constitution and bylaws of Greymens Club.
                      </div>
                    </div>
                  </Checkbox.Content>
                </Checkbox>
              </div>
            </>
          )}
        </div>

        {/* Department load failure blocks submission until resolved */}
        {deptError && (
          <div
            role="alert"
            className="mt-6 p-4 rounded-md border border-destructive/30 bg-destructive/10 flex items-center justify-between gap-4"
          >
            <p className="text-sm">
              Departments could not be loaded. Your application cannot be submitted until they are available.
            </p>
            <Button
              type="button"
              variant="secondary"
              onPress={() => setDeptReloadKey((k) => k + 1)}
              className="flex-shrink-0"
            >
              Retry
            </Button>
          </div>
        )}

        {/* A legitimately empty catalogue still blocks step 3: say so plainly
            instead of leaving validation to reject with no visible cause. */}
        {!deptLoading && !deptError && departments.length === 0 && (
          <div
            role="alert"
            className="mt-6 p-4 rounded-md border border-amber-500/30 bg-amber-500/5"
          >
            <p className="text-sm">
              No departments are open for applications right now. Please check
              back later or contact a club administrator — your progress on
              this device stays as entered.
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          {step > 1 ? (
            <Button variant="outline" onPress={() => setStep(step - 1)}>
              Previous
            </Button>
          ) : (
            <div />
          )}
          {step < STEPS.length ? (
            <Button onPress={handleNext}>
              Next
            </Button>
          ) : (
            <Button
              onPress={handleSubmit}
              isPending={loading}
              isDisabled={deptLoading || deptError}
            >
              {deptLoading ? "Loading departments..." : "Submit Application"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
