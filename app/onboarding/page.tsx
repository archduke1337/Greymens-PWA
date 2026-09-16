"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { toast } from "sonner";
import type { Department } from "@/lib/types";

const STEPS = [
  { id: 1, title: "Personal Info", description: "Basic personal details" },
  { id: 2, title: "Academic", description: "Academic information" },
  { id: 3, title: "Interests", description: "Club interests & skills" },
  { id: 4, title: "Social", description: "Social profiles" },
  { id: 5, title: "Legal", description: "Terms & oath" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { status, application, profile, loading: permLoading } = usePermissions();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptError, setDeptError] = useState(false);
  const [deptReloadKey, setDeptReloadKey] = useState(0);

  const [formData, setFormData] = useState({
    phone: "",
    urn: "",
    dateOfBirth: "",
    gender: "",
    address: "",
    program: "",
    branch: "",
    year: "",
    semester: "",
    preferredDepartments: [] as string[],
    skills: [] as string[],
    interests: [] as string[],
    experience: "",
    whyJoin: "",
    availability: "full",
    githubUrl: "",
    linkedinUrl: "",
    portfolioUrl: "",
    bio: "",
    oathAccepted: false,
    termsAccepted: false,
    constitutionAccepted: false,
  });

  useEffect(() => {
    if (permLoading) return;
    if (status === "no_account" || status === "account") return;
    // The server maps rejected applications to `applicant`; a rejected
    // applicant must stay on the form to reapply instead of bouncing to /dashboard.
    if (status === "applicant" && application?.status === "rejected") return;
    router.push("/dashboard");
  }, [status, application?.status, permLoading, router]);

  // Reapply prefill: a rejected applicant already has profile/application data.
  useEffect(() => {
    if (!profile && !application) return;
    setFormData((prev) => ({
      ...prev,
      phone: profile?.phone ?? prev.phone,
      urn: profile?.urn ?? prev.urn,
      dateOfBirth: profile?.dateOfBirth ?? prev.dateOfBirth,
      gender: profile?.gender ?? prev.gender,
      address: profile?.address ?? prev.address,
      program: profile?.program ?? prev.program,
      branch: profile?.branch ?? prev.branch,
      year: profile?.year ?? prev.year,
      semester: profile?.semester ?? prev.semester,
      skills: profile?.skills ?? prev.skills,
      interests: profile?.interests ?? prev.interests,
      experience: profile?.experience ?? prev.experience,
      whyJoin: profile?.whyJoin ?? prev.whyJoin,
      availability: profile?.availability ?? prev.availability,
      githubUrl: profile?.githubUrl ?? prev.githubUrl,
      linkedinUrl: profile?.linkedinUrl ?? prev.linkedinUrl,
      portfolioUrl: profile?.portfolioUrl ?? prev.portfolioUrl,
      bio: profile?.bio ?? prev.bio,
      preferredDepartments: application?.preferredDepartments ?? prev.preferredDepartments,
    }));
  }, [profile, application]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/departments", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load departments");
        return (await response.json()) as { departments?: Department[] };
      })
      .then((payload) => {
        if (!cancelled) {
          setDepartments(payload.departments ?? []);
          setDeptError(false);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Department catalogue error:", error);
          setDeptError(true);
          toast.error("Departments could not be loaded. Please try again.");
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
    if (!validateStep(step)) return;
    setStep(step + 1);
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
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          profile: {
            phone: formData.phone,
            urn: formData.urn,
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
            githubUrl: formData.githubUrl,
            linkedinUrl: formData.linkedinUrl,
            portfolioUrl: formData.portfolioUrl,
            bio: formData.bio,
            profileVisibility: "members_only",
          },
          application: {
            oathAccepted: formData.oathAccepted,
            termsAccepted: formData.termsAccepted,
            constitutionAccepted: formData.constitutionAccepted,
            preferredDepartments: formData.preferredDepartments,
          },
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to submit application");
      }

      toast.success("Application submitted successfully!");
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
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Join Mind Mesh Club</h1>
          <p className="text-muted-foreground mt-2">Complete your membership application</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-between mb-8" role="list" aria-label="Onboarding progress">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center" role="listitem" aria-current={step === s.id ? "step" : undefined}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= s.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {s.id}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-12 h-0.5 mx-1 ${step > s.id ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
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
              <div>
                <label htmlFor="onboarding-phone" className="text-sm font-medium">Phone Number *</label>
                <input
                  id="onboarding-phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-foreground"
                  placeholder="+91 9876543210"
                />
              </div>
              <div>
                <label htmlFor="onboarding-urn" className="text-sm font-medium">University Roll Number *</label>
                <input
                  id="onboarding-urn"
                  type="text"
                  value={formData.urn}
                  onChange={(e) => updateField("urn", e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-foreground"
                  placeholder="e.g., 2100320100001"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="onboarding-dob" className="text-sm font-medium">Date of Birth *</label>
                  <input
                    id="onboarding-dob"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => updateField("dateOfBirth", e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-foreground"
                  />
                </div>
                <div>
                  <label htmlFor="onboarding-gender" className="text-sm font-medium">Gender *</label>
                  <select
                    id="onboarding-gender"
                    value={formData.gender}
                    onChange={(e) => updateField("gender", e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-foreground"
                  >
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="onboarding-address" className="text-sm font-medium">Address</label>
                <textarea
                  id="onboarding-address"
                  value={formData.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-foreground"
                  rows={2}
                  placeholder="Residential address"
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label htmlFor="onboarding-program" className="text-sm font-medium">Program *</label>
                <select
                  id="onboarding-program"
                  value={formData.program}
                  onChange={(e) => updateField("program", e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-foreground"
                >
                  <option value="">Select</option>
                  <option value="B.Tech">B.Tech</option>
                  <option value="M.Tech">M.Tech</option>
                  <option value="BCA">BCA</option>
                  <option value="MCA">MCA</option>
                  <option value="B.Sc">B.Sc</option>
                  <option value="M.Sc">M.Sc</option>
                  <option value="MBA">MBA</option>
                  <option value="PhD">PhD</option>
                </select>
              </div>
              <div>
                <label htmlFor="onboarding-branch" className="text-sm font-medium">Branch *</label>
                <select
                  id="onboarding-branch"
                  value={formData.branch}
                  onChange={(e) => updateField("branch", e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-foreground"
                >
                  <option value="">Select</option>
                  <option value="Computer Science">Computer Science</option>
                  <option value="Information Technology">Information Technology</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Mechanical">Mechanical</option>
                  <option value="Civil">Civil</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="onboarding-year" className="text-sm font-medium">Year *</label>
                  <select
                    id="onboarding-year"
                    value={formData.year}
                    onChange={(e) => updateField("year", e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-foreground"
                  >
                    <option value="">Select</option>
                    <option value="1st">1st Year</option>
                    <option value="2nd">2nd Year</option>
                    <option value="3rd">3rd Year</option>
                    <option value="4th">4th Year</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="onboarding-semester" className="text-sm font-medium">Semester *</label>
                  <select
                    id="onboarding-semester"
                    value={formData.semester}
                    onChange={(e) => updateField("semester", e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-foreground"
                  >
                    <option value="">Select</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={String(s)}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
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
              <div>
                <label htmlFor="onboarding-skills" className="text-sm font-medium">Skills</label>
                <input
                  id="onboarding-skills"
                  type="text"
                  placeholder="React, Python, Design (comma separated)"
                  className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-foreground"
                  value={formData.skills.join(", ")}
                  onChange={(e) =>
                    updateField("skills", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
                  }
                />
              </div>
              <div>
                <label htmlFor="onboarding-interests" className="text-sm font-medium">Interests</label>
                <input
                  id="onboarding-interests"
                  type="text"
                  placeholder="AI, Web Dev, Cybersecurity (comma separated)"
                  className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-foreground"
                  value={formData.interests.join(", ")}
                  onChange={(e) =>
                    updateField("interests", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
                  }
                />
              </div>
              <div>
                <label htmlFor="onboarding-experience" className="text-sm font-medium">Prior Experience</label>
                <textarea
                  id="onboarding-experience"
                  value={formData.experience}
                  onChange={(e) => updateField("experience", e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-foreground"
                  rows={3}
                  placeholder="Any prior club experience or relevant projects..."
                />
              </div>
              <div>
                <label htmlFor="onboarding-whyjoin" className="text-sm font-medium">Why do you want to join? *</label>
                <textarea
                  id="onboarding-whyjoin"
                  value={formData.whyJoin}
                  onChange={(e) => updateField("whyJoin", e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-foreground"
                  rows={3}
                  placeholder="Tell us why you want to join Mind Mesh Club..."
                />
              </div>
              <div>
                <label htmlFor="onboarding-availability" className="text-sm font-medium">Availability *</label>
                <select
                  id="onboarding-availability"
                  value={formData.availability}
                  onChange={(e) => updateField("availability", e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-foreground"
                >
                  <option value="full">Full time</option>
                  <option value="partial">Partial</option>
                  <option value="event_only">Events only</option>
                </select>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div>
                <label htmlFor="onboarding-bio" className="text-sm font-medium">Bio</label>
                <textarea
                  id="onboarding-bio"
                  value={formData.bio}
                  onChange={(e) => updateField("bio", e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-foreground"
                  rows={3}
                  placeholder="A short bio about yourself..."
                />
              </div>
              <div>
                <label htmlFor="onboarding-github" className="text-sm font-medium">GitHub URL</label>
                <input
                  id="onboarding-github"
                  type="url"
                  value={formData.githubUrl}
                  onChange={(e) => updateField("githubUrl", e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-foreground"
                  placeholder="https://github.com/username"
                />
              </div>
              <div>
                <label htmlFor="onboarding-linkedin" className="text-sm font-medium">LinkedIn URL</label>
                <input
                  id="onboarding-linkedin"
                  type="url"
                  value={formData.linkedinUrl}
                  onChange={(e) => updateField("linkedinUrl", e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-foreground"
                  placeholder="https://linkedin.com/in/username"
                />
              </div>
              <div>
                <label htmlFor="onboarding-portfolio" className="text-sm font-medium">Portfolio URL</label>
                <input
                  id="onboarding-portfolio"
                  type="url"
                  value={formData.portfolioUrl}
                  onChange={(e) => updateField("portfolioUrl", e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-foreground"
                  placeholder="https://yourportfolio.com"
                />
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <div className="space-y-4">
                <label className="flex items-start gap-3 p-4 rounded-md border cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.oathAccepted}
                    onChange={(e) => updateField("oathAccepted", e.target.checked)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium">Club Oath</div>
                    <div className="text-sm text-muted-foreground">
                      I solemnly pledge to uphold the values and mission of Mind Mesh Club, to contribute actively
                      to its growth, and to maintain the highest standards of integrity and collaboration.
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-4 rounded-md border cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.termsAccepted}
                    onChange={(e) => updateField("termsAccepted", e.target.checked)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium">Terms of Service</div>
                    <div className="text-sm text-muted-foreground">
                      I agree to the terms of service and code of conduct of Mind Mesh Club.
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-4 rounded-md border cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.constitutionAccepted}
                    onChange={(e) => updateField("constitutionAccepted", e.target.checked)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium">Constitution Acknowledgment</div>
                    <div className="text-sm text-muted-foreground">
                      I have read and acknowledge the constitution and bylaws of Mind Mesh Club.
                    </div>
                  </div>
                </label>
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
            <button
              type="button"
              onClick={() => setDeptReloadKey((k) => k + 1)}
              className="px-4 py-2 rounded-md border hover:bg-muted transition-colors flex-shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-6 py-2 rounded-md border hover:bg-muted transition-colors"
            >
              Previous
            </button>
          ) : (
            <div />
          )}
          {step < STEPS.length ? (
            <button
              onClick={handleNext}
              className="px-6 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-opacity hover:opacity-90"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading || departments.length === 0}
              className="px-6 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-opacity disabled:opacity-50 hover:opacity-90"
            >
              {loading ? "Submitting..." : "Submit Application"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
