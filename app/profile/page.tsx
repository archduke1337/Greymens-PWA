"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { readApiError } from "@/lib/errorHandler";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { account } from "@/lib/appwrite";
import type {
  Profile,
  Department,
  Designation,
  Membership,
  Ticket,
} from "@/lib/types";
import { toast } from "sonner";
import { getAvatarUrl, timeAgo } from "@/lib/format";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Input,
  Label,
  ListBox,
  Select,
  TextArea,
} from "@heroui/react";

const PRONOUNS_OPTIONS = [
  { value: "he/him", label: "He/Him" },
  { value: "she/her", label: "She/Her" },
  { value: "they/them", label: "They/Them" },
  { value: "he/they", label: "He/They" },
  { value: "she/they", label: "She/They" },
  { value: "prefer_to_say", label: "Prefer not to say" },
] as const;

const PROGRAM_OPTIONS = [
  { value: "B.Tech", label: "B.Tech" },
  { value: "M.Tech", label: "M.Tech" },
  { value: "BCA", label: "BCA" },
  { value: "MCA", label: "MCA" },
  { value: "B.Sc", label: "B.Sc" },
  { value: "M.Sc", label: "M.Sc" },
  { value: "BBA", label: "BBA" },
  { value: "MBA", label: "MBA" },
  { value: "PhD", label: "PhD" },
  { value: "other", label: "Other" },
];

const YEAR_OPTIONS = [
  { value: "1st", label: "1st Year" },
  { value: "2nd", label: "2nd Year" },
  { value: "3rd", label: "3rd Year" },
  { value: "4th", label: "4th Year" },
  { value: "5th", label: "5th Year" },
];

const SEMESTER_OPTIONS = [
  { value: "1", label: "Semester 1" },
  { value: "2", label: "Semester 2" },
  { value: "3", label: "Semester 3" },
  { value: "4", label: "Semester 4" },
  { value: "5", label: "Semester 5" },
  { value: "6", label: "Semester 6" },
  { value: "7", label: "Semester 7" },
  { value: "8", label: "Semester 8" },
];

interface ProfileForm {
  name: string;
  pronouns: NonNullable<Profile["pronouns"]>;
  bio: string;
  phone: string;
  urn: string;
  program: string;
  branch: string;
  year: string;
  semester: string;
  address: string;
  githubUrl: string;
  linkedinUrl: string;
  portfolioUrl: string;
  instagramUrl: string;
  skills: string[];
  interests: string[];
}

// Single mapping from stored profile to editable form state, so load and cancel
// can never drift apart.
function toEditForm(profile: Profile | null, name: string): ProfileForm {
  return {
    name,
    pronouns: profile?.pronouns || "prefer_to_say",
    bio: profile?.bio || "",
    phone: profile?.phone || "",
    urn: profile?.urn || "",
    program: profile?.program || "",
    branch: profile?.branch || "",
    year: profile?.year || "",
    semester: profile?.semester || "",
    address: profile?.address || "",
    githubUrl: profile?.githubUrl || "",
    linkedinUrl: profile?.linkedinUrl || "",
    portfolioUrl: profile?.portfolioUrl || "",
    instagramUrl: profile?.instagramUrl || "",
    skills: profile?.skills || [],
    interests: profile?.interests || [],
  };
}

export default function ProfilePage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const {
    status,
    userDepartments,
    userDesignations,
    allDepartments,
    allDesignations,
    loading: permLoading,
    refresh,
  } = usePermissions();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [profilePicture, setProfilePicture] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [membership, setMembership] = useState<Membership | null>(null);

  const [editForm, setEditForm] = useState<ProfileForm>(() => toEditForm(null, ""));

  const [newSkill, setNewSkill] = useState("");
  const [newInterest, setNewInterest] = useState("");
  // The server load replaces the whole form: without this guard, opening the
  // page and typing before the fetch resolves would have the in-flight
  // response wipe those edits (same class as the onboarding prefill race).
  const formInitForRef = useRef<string | null>(null);

  const userDepartmentsResolved = userDepartments
    .map((ud) => allDepartments.find((d) => d.$id === ud.departmentId))
    .filter(Boolean) as Department[];

  const userDesignationsResolved = userDesignations
    .map((ud) => allDesignations.find((ds) => ds.$id === ud.designationId))
    .filter(Boolean) as Designation[];

  const loadProfile = useCallback(async () => {
    if (!authUser) return;
    try {
      setLoading(true);
      setLoadError(null);
      const response = await fetch("/api/profile", { credentials: "include" });
      const payload = (await response.json().catch(() => null)) as
        | { profile?: Profile | null; membership?: Membership | null; tickets?: Ticket[]; error?: string }
        | null;
      if (!response.ok) throw new Error(readApiError(payload, "Failed to load profile"));

      const profileData = payload?.profile ?? null;
      setProfile(profileData);
      setMembership(payload?.membership ?? null);
      setTickets(payload?.tickets ?? []);
      if (formInitForRef.current !== authUser.$id) {
        formInitForRef.current = authUser.$id;
        setEditForm(toEditForm(profileData, authUser.name || ""));
      }
      setProfilePicture(getAvatarUrl(profileData?.avatar, authUser.name || "User"));
    } catch (err) {
      console.error("Failed to load profile:", err);
      setLoadError(err instanceof Error ? err.message : "Failed to load profile data");
    } finally {
      setLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push("/login");
    }
    if (authUser && !permLoading) {
      loadProfile();
    }
  }, [authUser, authLoading, permLoading, loadProfile, router]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so selecting the same file again still fires a change event.
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/profile", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as { avatar?: string; error?: string } | null;
      if (!response.ok || !payload?.avatar) {
        throw new Error(readApiError(payload, "Failed to upload picture"));
      }
      setProfilePicture(payload.avatar);
      toast.success("Profile picture updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload picture");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!authUser) return;
    const trimmedName = editForm.name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 128) {
      toast.error("Name must be between 2 and 128 characters");
      return;
    }

    setSaving(true);
    try {
      if (trimmedName !== authUser.name) {
        await account.updateName({ name: trimmedName });
      }

      const response = await fetch("/api/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pronouns: editForm.pronouns,
          bio: editForm.bio,
          phone: editForm.phone,
          urn: editForm.urn,
          program: editForm.program,
          branch: editForm.branch,
          year: editForm.year,
          semester: editForm.semester,
          address: editForm.address,
          githubUrl: editForm.githubUrl,
          linkedinUrl: editForm.linkedinUrl,
          portfolioUrl: editForm.portfolioUrl,
          instagramUrl: editForm.instagramUrl,
          skills: editForm.skills,
          interests: editForm.interests,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(readApiError(payload, "Failed to save profile"));
      }

      await refresh();
      await loadProfile();
      setIsEditing(false);
      toast.success("Profile updated successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const addSkill = () => {
    const trimmed = newSkill.trim();
    if (!trimmed) return;
    if (trimmed.length > 100) {
      toast.error("Skills must be 100 characters or fewer");
      return;
    }
    if (editForm.skills.includes(trimmed)) {
      toast.error("That skill is already listed");
      return;
    }
    if (editForm.skills.length >= 50) {
      toast.error("You can list up to 50 skills");
      return;
    }
    setEditForm((prev) => ({ ...prev, skills: [...prev.skills, trimmed] }));
    setNewSkill("");
  };

  const removeSkill = (skill: string) => {
    setEditForm((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skill),
    }));
  };

  const addInterest = () => {
    const trimmed = newInterest.trim();
    if (!trimmed) return;
    if (trimmed.length > 100) {
      toast.error("Interests must be 100 characters or fewer");
      return;
    }
    if (editForm.interests.includes(trimmed)) {
      toast.error("That interest is already listed");
      return;
    }
    if (editForm.interests.length >= 50) {
      toast.error("You can list up to 50 interests");
      return;
    }
    setEditForm((prev) => ({ ...prev, interests: [...prev.interests, trimmed] }));
    setNewInterest("");
  };

  const removeInterest = (interest: string) => {
    setEditForm((prev) => ({
      ...prev,
      interests: prev.interests.filter((i) => i !== interest),
    }));
  };

  const statusLabel: Record<string, { label: string; color: "default" | "warning" | "success" | "accent" | "danger" }> = {
    no_account: { label: "No Account", color: "default" },
    account: { label: "Account Holder", color: "default" },
    applicant: { label: "Applicant", color: "warning" },
    member: { label: "Member", color: "success" },
    core_member: { label: "Core Member", color: "success" },
    lead: { label: "Lead", color: "accent" },
    head: { label: "Head", color: "accent" },
    admin: { label: "Admin", color: "danger" },
  };

  const currentStatus = statusLabel[status] || statusLabel.account;

  if (authLoading || loading) {
    return (
      <div role="status" className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" aria-hidden="true" />
          <p className="mt-4 text-muted">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="text-center" role="status" aria-label="Redirecting to login">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" aria-hidden="true" />
          <p className="mt-4 text-muted">Sign in required — taking you to login...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardContent className="text-center py-16 space-y-4">
            <h1 className="text-2xl font-bold">Couldn&apos;t load your profile</h1>
            <p className="text-muted">{loadError}</p>
            <Button variant="primary" onPress={loadProfile}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader className="flex flex-col items-center gap-4 pt-8 pb-4">
          <div className="relative group">
            <Avatar className="w-32 h-32 ring-4 ring-surface-secondary">
              <AvatarImage src={profilePicture} alt={authUser.name} />
              <AvatarFallback>{authUser.name?.charAt(0) || "U"}</AvatarFallback>
            </Avatar>
            <Button
              type="button"
              isIconOnly
              onPress={() => fileInputRef.current?.click()}
              isDisabled={uploadingPhoto}
              aria-label="Change profile picture"
              className="absolute bottom-1 right-1 rounded-full shadow-lg transition-opacity opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            >
              {uploadingPhoto ? (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold">{isEditing ? editForm.name : authUser.name}</h1>
            <p className="text-muted">{authUser.email}</p>
            {profile?.pronouns && profile.pronouns !== "prefer_to_say" && (
              <p className="text-sm text-muted">{profile.pronouns}</p>
            )}
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              <Chip size="sm" variant="primary" color={currentStatus.color}>
                {currentStatus.label}
              </Chip>
              {userDesignationsResolved.map((d) => (
                <Chip key={d.$id} size="sm" variant="secondary">
                  {d.name}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex gap-2 mt-2">
            {isEditing ? (
              <>
                <Button
                  size="sm"
                  variant="primary"
                  isPending={saving}
                  onPress={handleSave}
                >
                  Save Changes
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => {
                    setIsEditing(false);
                    setEditForm(toEditForm(profile, authUser.name || ""));
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" onPress={() => setIsEditing(true)}>
                Edit Profile
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* About Section */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">About</h2>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pronouns */}
          <div className="space-y-2">
            {isEditing ? (
              <Select
                placeholder="Select pronouns"
                value={editForm.pronouns}
                onChange={(value) =>
                  setEditForm((prev) => ({ ...prev, pronouns: String(value ?? "prefer_to_say") as ProfileForm["pronouns"] }))
                }
              >
                <Label>Pronouns</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {PRONOUNS_OPTIONS.map((opt) => (
                      <ListBox.Item key={opt.value} id={opt.value} textValue={opt.label}>
                        {opt.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            ) : (
              <p className="text-sm text-foreground">
                {profile?.pronouns && profile.pronouns !== "prefer_to_say"
                  ? PRONOUNS_OPTIONS.find((opt) => opt.value === profile.pronouns)?.label || profile.pronouns
                  : "Not shared"}
              </p>
            )}
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <label htmlFor="profile-bio" className="text-sm font-medium text-foreground">Bio</label>
            {isEditing ? (
              <TextArea
                id="profile-bio"
                value={editForm.bio}
                onChange={(e) => setEditForm((prev) => ({ ...prev, bio: e.target.value }))}
                placeholder="Tell us about yourself..."
                maxLength={5000}
                rows={3}
              />
            ) : (
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {profile?.bio || "No bio added yet."}
              </p>
            )}
          </div>

          {/* Skills */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Skills</h3>
            {isEditing ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    placeholder="Add a skill..."
                    maxLength={100}
                    aria-label="Add a skill"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSkill();
                      }
                    }}
                  />
                  <Button size="sm" variant="ghost" aria-label="Add skill" onPress={addSkill}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editForm.skills.map((skill) => (
                    <Chip key={skill} size="sm" variant="primary">
                      {skill}
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        aria-label={`Remove skill ${skill}`}
                        className="ml-1 text-xs"
                      >
                        ×
                      </button>
                    </Chip>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {profile?.skills && profile.skills.length > 0 ? (
                  profile.skills.map((skill) => (
                    <Chip key={skill} size="sm" variant="soft">
                      {skill}
                    </Chip>
                  ))
                ) : (
                  <p className="text-sm text-muted">No skills added yet.</p>
                )}
              </div>
            )}
          </div>

          {/* Interests */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Interests</h3>
            {isEditing ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={newInterest}
                    onChange={(e) => setNewInterest(e.target.value)}
                    placeholder="Add an interest..."
                    maxLength={100}
                    aria-label="Add an interest"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addInterest();
                      }
                    }}
                  />
                  <Button size="sm" variant="ghost" aria-label="Add interest" onPress={addInterest}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editForm.interests.map((interest) => (
                    <Chip key={interest} size="sm" variant="primary">
                      {interest}
                      <button
                        type="button"
                        onClick={() => removeInterest(interest)}
                        aria-label={`Remove interest ${interest}`}
                        className="ml-1 text-xs"
                      >
                        ×
                      </button>
                    </Chip>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {profile?.interests && profile.interests.length > 0 ? (
                  profile.interests.map((interest) => (
                    <Chip key={interest} size="sm" variant="soft">
                      {interest}
                    </Chip>
                  ))
                ) : (
                  <p className="text-sm text-muted">No interests added yet.</p>
                )}
              </div>
            )}
          </div>

          {/* Social Links */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Social Links</h3>
            {isEditing ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-muted flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  <Input
                    value={editForm.githubUrl}
                    aria-label="GitHub profile URL (optional)"
                    onChange={(e) => setEditForm((prev) => ({ ...prev, githubUrl: e.target.value }))}
                    placeholder="GitHub profile URL (optional)"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-muted flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                  <Input
                    value={editForm.linkedinUrl}
                    aria-label="LinkedIn profile URL (optional)"
                    onChange={(e) => setEditForm((prev) => ({ ...prev, linkedinUrl: e.target.value }))}
                    placeholder="LinkedIn profile URL (optional)"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                  <Input
                    value={editForm.portfolioUrl}
                    aria-label="Portfolio website URL (optional)"
                    onChange={(e) => setEditForm((prev) => ({ ...prev, portfolioUrl: e.target.value }))}
                    placeholder="Portfolio website URL (optional)"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none" />
                  </svg>
                  <Input
                    value={editForm.instagramUrl}
                    aria-label="Instagram URL (optional)"
                    onChange={(e) => setEditForm((prev) => ({ ...prev, instagramUrl: e.target.value }))}
                    placeholder="Instagram URL (optional)"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {profile?.githubUrl && (
                  <a
                    href={profile.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-foreground hover:text-primary transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    GitHub
                  </a>
                )}
                {profile?.linkedinUrl && (
                  <a
                    href={profile.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-foreground hover:text-primary transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                    LinkedIn
                  </a>
                )}
                {profile?.portfolioUrl && (
                  <a
                    href={profile.portfolioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-muted hover:text-primary transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                    </svg>
                    Portfolio
                  </a>
                )}
                {profile?.instagramUrl && (
                  <a
                    href={profile.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-muted hover:text-primary transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="5" />
                      <circle cx="12" cy="12" r="4" />
                      <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none" />
                    </svg>
                    Instagram
                  </a>
                )}
                {!profile?.githubUrl && !profile?.linkedinUrl && !profile?.portfolioUrl && !profile?.instagramUrl && (
                  <p className="text-sm text-muted">No social links added yet.</p>
                )}
                {!profile?.githubUrl && !profile?.linkedinUrl && !profile?.portfolioUrl && (
                  <p className="text-sm text-muted">No social links added yet.</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Academic Section */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Academic Information</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Select
                  fullWidth
                  placeholder="Select program"
                  value={editForm.program === "" ? null : editForm.program}
                  onChange={(value) =>
                    setEditForm((prev) => ({ ...prev, program: String(value ?? "") }))
                  }
                >
                  <Label>Program</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {PROGRAM_OPTIONS.map((opt) => (
                        <ListBox.Item key={opt.value} id={opt.value} textValue={opt.label}>
                          {opt.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
              <div>
                <label htmlFor="profile-branch" className="text-sm font-medium mb-1 block">Branch</label>
                <Input
                  id="profile-branch"
                  value={editForm.branch}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, branch: e.target.value }))}
                  placeholder="e.g. Computer Science"
                />
              </div>
              <div>
                <Select
                  fullWidth
                  placeholder="Select year"
                  value={editForm.year === "" ? null : editForm.year}
                  onChange={(value) =>
                    setEditForm((prev) => ({ ...prev, year: String(value ?? "") }))
                  }
                >
                  <Label>Year</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {YEAR_OPTIONS.map((opt) => (
                        <ListBox.Item key={opt.value} id={opt.value} textValue={opt.label}>
                          {opt.label}
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
                  placeholder="Select semester"
                  value={editForm.semester === "" ? null : editForm.semester}
                  onChange={(value) =>
                    setEditForm((prev) => ({ ...prev, semester: String(value ?? "") }))
                  }
                >
                  <Label>Semester</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {SEMESTER_OPTIONS.map((opt) => (
                        <ListBox.Item key={opt.value} id={opt.value} textValue={opt.label}>
                          {opt.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="profile-urn" className="text-sm font-medium mb-1 block">URN (University Roll Number)</label>
                <Input
                  id="profile-urn"
                  value={editForm.urn}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, urn: e.target.value }))}
                  placeholder="Enter URN"
                />
                <p className="text-xs text-warning flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  This field is audited - changes are logged
                </p>
              </div>
              <div>
                <label htmlFor="profile-phone" className="text-sm font-medium mb-1 block">Phone</label>
                <Input
                  id="profile-phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Phone number"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label htmlFor="profile-address" className="text-sm font-medium mb-1 block">Address</label>
                <Input
                  id="profile-address"
                  value={editForm.address}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Address"
                />
                <p className="text-xs text-warning flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  This field is audited - changes are logged
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-xs text-muted">Program</span>
                <p className="text-sm">{profile?.program || "-"}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted">Branch</span>
                <p className="text-sm">{profile?.branch || "-"}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted">Year</span>
                <p className="text-sm">{profile?.year || "-"}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted">Semester</span>
                <p className="text-sm">{profile?.semester ? `Semester ${profile.semester}` : "-"}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted">URN</span>
                <p className="text-sm font-mono">{profile?.urn || "-"}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted">Phone</span>
                <p className="text-sm">{profile?.phone || "-"}</p>
              </div>
              <div className="space-y-1 md:col-span-2">
                <span className="text-xs text-muted">Address</span>
                <p className="text-sm">{profile?.address || "-"}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Section */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Activity</h2>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Membership */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Membership</h3>
            {membership ? (
              <div className="flex items-center gap-3 p-3 bg-surface rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium">{membership.membershipNumber}</p>
                  <p className="text-xs text-muted">
                    Joined {timeAgo(membership.joinedAt)}
                  </p>
                </div>
                <Chip
                  size="sm"
                  color={membership.status === "active" ? "success" : "danger"}
                  variant="soft"
                >
                  {membership.status}
                </Chip>
              </div>
            ) : (
              <p className="text-sm text-muted">No active membership.</p>
            )}
          </div>

          {/* Departments */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Departments</h3>
            <div className="flex flex-wrap gap-2">
              {userDepartmentsResolved.length > 0 ? (
                userDepartmentsResolved.map((dept) => {
                  const userDept = userDepartments.find((ud) => ud.departmentId === dept.$id);
                  return (
                    <Chip key={dept.$id} size="sm" variant="soft" color="accent">
                      {dept.name}
                      {userDept && (
                        <span className="ml-1 text-muted">({userDept.role})</span>
                      )}
                    </Chip>
                  );
                })
              ) : (
                <p className="text-sm text-muted">No departments assigned.</p>
              )}
            </div>
          </div>

          {/* Tickets */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">
              Events Attended ({tickets.length} tickets)
            </h3>
            {tickets.length > 0 ? (
              <div className="space-y-2">
                {tickets.slice(0, 10).map((ticket) => (
                  <div
                    key={ticket.$id}
                    className="flex items-center justify-between p-3 bg-surface rounded-lg"
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-mono">{ticket.ticketCode}</p>
                      <p className="text-xs text-muted">
                        Issued {ticket.issuedAt ? timeAgo(ticket.issuedAt) : "-"}
                      </p>
                    </div>
                    <Chip
                      size="sm"
                      variant="soft"
                      color={
                        ticket.status === "checked_in"
                          ? "success"
                          : ticket.status === "completed"
                          ? "accent"
                          : ticket.status === "invalidated"
                            ? "danger"
                            : "default"
                      }
                    >
                      {ticket.status.replace("_", " ")}
                    </Chip>
                  </div>
                ))}
                {tickets.length > 10 && (
                  <Link
                    href="/events"
                    className="block text-xs text-primary hover:opacity-90 text-center"
                  >
                    And {tickets.length - 10} more — browse events
                  </Link>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted">No event tickets yet.</p>
            )}
          </div>

          {/* Designations */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Designations</h3>
            <div className="flex flex-wrap gap-2">
              {userDesignationsResolved.length > 0 ? (
                userDesignationsResolved.map((desig) => (                    <Chip key={desig.$id} size="sm" variant="secondary">
                    {desig.name}
                    <span className="ml-1 text-muted text-xs">Lvl {desig.level}</span>
                  </Chip>
                ))
              ) : (
                <p className="text-sm text-muted">No designations assigned.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
