"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { profileService } from "@/lib/profiles";
import { applicationService } from "@/lib/applications";
import { departmentService } from "@/lib/departments";
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
  const { status, application, loading: permLoading } = usePermissions();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);

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
    if (!permLoading && status !== "no_account" && status !== "account") {
      router.push("/dashboard");
    }
  }, [status, permLoading, router]);

  useEffect(() => {
    departmentService.getAll().then(setDepartments).catch(console.error);
  }, []);

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

  const handleSubmit = async () => {
    if (!user) return;
    if (!formData.oathAccepted || !formData.termsAccepted || !formData.constitutionAccepted) {
      toast.error("Please accept all terms and oaths");
      return;
    }
    if (!formData.urn || !formData.program || !formData.branch || !formData.year || !formData.whyJoin) {
      toast.error("Please fill all required fields");
      return;
    }

    setLoading(true);
    try {
      const profile = await profileService.create({
        userId: user.$id,
        phone: formData.phone,
        urn: formData.urn,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender as any,
        address: formData.address,
        program: formData.program,
        branch: formData.branch,
        year: formData.year,
        semester: formData.semester,
        preferredDepartments: formData.preferredDepartments,
        skills: formData.skills,
        interests: formData.interests,
        experience: formData.experience,
        whyJoin: formData.whyJoin,
        availability: formData.availability as any,
        githubUrl: formData.githubUrl,
        linkedinUrl: formData.linkedinUrl,
        portfolioUrl: formData.portfolioUrl,
        bio: formData.bio,
        profileVisibility: "members_only",
      });

      await applicationService.create({
        userId: user.$id,
        status: "pending",
        profileId: profile.$id!,
        oathAccepted: formData.oathAccepted,
        termsAccepted: formData.termsAccepted,
        constitutionAccepted: formData.constitutionAccepted,
        preferredDepartments: formData.preferredDepartments,
      });

      toast.success("Application submitted successfully!");
      router.push("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to submit application");
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
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
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
                <label className="text-sm font-medium">Phone Number *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-foreground"
                  placeholder="+91 9876543210"
                />
              </div>
              <div>
                <label className="text-sm font-medium">University Roll Number *</label>
                <input
                  type="text"
                  value={formData.urn}
                  onChange={(e) => updateField("urn", e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-foreground"
                  placeholder="e.g., 2100320100001"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => updateField("dateOfBirth", e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-foreground"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Gender</label>
                  <select
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
                <label className="text-sm font-medium">Address</label>
                <textarea
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
                <label className="text-sm font-medium">Program *</label>
                <select
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
                <label className="text-sm font-medium">Branch *</label>
                <select
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
                  <label className="text-sm font-medium">Year *</label>
                  <select
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
                  <label className="text-sm font-medium">Semester</label>
                  <select
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
                <label className="text-sm font-medium">Preferred Departments * (select at least 1)</label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {departments.map((dept) => (
                    <button
                      key={dept.$id}
                      type="button"
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
                <label className="text-sm font-medium">Skills</label>
                <input
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
                <label className="text-sm font-medium">Interests</label>
                <input
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
                <label className="text-sm font-medium">Prior Experience</label>
                <textarea
                  value={formData.experience}
                  onChange={(e) => updateField("experience", e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-foreground"
                  rows={3}
                  placeholder="Any prior club experience or relevant projects..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Why do you want to join? *</label>
                <textarea
                  value={formData.whyJoin}
                  onChange={(e) => updateField("whyJoin", e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-foreground"
                  rows={3}
                  placeholder="Tell us why you want to join Mind Mesh Club..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Availability *</label>
                <select
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
                <label className="text-sm font-medium">Bio</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => updateField("bio", e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-foreground"
                  rows={3}
                  placeholder="A short bio about yourself..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">GitHub URL</label>
                <input
                  type="url"
                  value={formData.githubUrl}
                  onChange={(e) => updateField("githubUrl", e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-foreground"
                  placeholder="https://github.com/username"
                />
              </div>
              <div>
                <label className="text-sm font-medium">LinkedIn URL</label>
                <input
                  type="url"
                  value={formData.linkedinUrl}
                  onChange={(e) => updateField("linkedinUrl", e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-foreground"
                  placeholder="https://linkedin.com/in/username"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Portfolio URL</label>
                <input
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
              onClick={() => setStep(step + 1)}
              className="px-6 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit Application"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
