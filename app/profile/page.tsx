"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { useRouter } from "next/navigation";
import { ImageGravity } from "appwrite";
import { account, storage, ID, APPWRITE_CONFIG } from "@/lib/appwrite";
import { profileService } from "@/lib/profiles";
import { departmentService } from "@/lib/departments";
import { designationService } from "@/lib/designations";
import { ticketService } from "@/lib/tickets";
import { membershipService } from "@/lib/memberships";
import type { Profile, Department, Designation, Membership, Ticket } from "@/lib/types";
import { toast } from "sonner";
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
  TextArea,
  Select,
  SelectItem,
} from "@heroui/react";

const { profilePicturesBucketId: PROFILE_BUCKET_ID } = APPWRITE_CONFIG;

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

function getAvatarUrl(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=400`;
}

function timeAgo(date: string) {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ProfilePage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const {
    profile: permissionProfile,
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
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [membership, setMembership] = useState<Membership | null>(null);

  const [editForm, setEditForm] = useState({
    name: "",
    pronouns: "" as Profile["pronouns"],
    bio: "",
    phone: "",
    urn: "",
    program: "",
    branch: "",
    year: "",
    semester: "",
    address: "",
    githubUrl: "",
    linkedinUrl: "",
    portfolioUrl: "",
    skills: [] as string[],
    interests: [] as string[],
  });

  const [newSkill, setNewSkill] = useState("");
  const [newInterest, setNewInterest] = useState("");

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
      const [profileData, membershipData, ticketData] = await Promise.all([
        profileService.getByUserId(authUser.$id),
        membershipService.getByUserId(authUser.$id),
        ticketService.getByUser(authUser.$id),
      ]);
      setProfile(profileData);
      setMembership(membershipData);
      setTickets(ticketData);

      if (profileData) {
        setEditForm({
          name: authUser.name || "",
          pronouns: profileData.pronouns || "prefer_to_say",
          bio: profileData.bio || "",
          phone: profileData.phone || "",
          urn: profileData.urn || "",
          program: profileData.program || "",
          branch: profileData.branch || "",
          year: profileData.year || "",
          semester: profileData.semester || "",
          address: profileData.address || "",
          githubUrl: profileData.githubUrl || "",
          linkedinUrl: profileData.linkedinUrl || "",
          portfolioUrl: profileData.portfolioUrl || "",
          skills: profileData.skills || [],
          interests: profileData.interests || [],
        });
      } else {
        setEditForm((prev) => ({ ...prev, name: authUser.name || "" }));
      }

      loadProfilePicture(authUser);
    } catch (err) {
      console.error("Failed to load profile:", err);
      toast.error("Failed to load profile data");
    } finally {
      setLoading(false);
    }
  }, [authUser]);

  const loadProfilePicture = (currentUser?: typeof authUser) => {
    const u = currentUser || authUser;
    if (u?.prefs?.profilePictureId) {
      try {
        const fileUrl = storage.getFilePreview(
          PROFILE_BUCKET_ID,
          u.prefs.profilePictureId,
          400,
          400,
          ImageGravity.Center,
          100
        );
        setProfilePicture(fileUrl.toString());
      } catch {
        setProfilePicture(getAvatarUrl(u.name || "User"));
      }
    } else {
      setProfilePicture(getAvatarUrl(u?.name || "User"));
    }
  };

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
      if (authUser?.prefs?.profilePictureId) {
        try {
          await storage.deleteFile(PROFILE_BUCKET_ID, authUser.prefs.profilePictureId);
        } catch {
          /* old picture may not exist */
        }
      }
      const response = await storage.createFile(PROFILE_BUCKET_ID, ID.unique(), file);
      await account.updatePrefs({
        ...authUser?.prefs,
        profilePictureId: response.$id,
      });
      const url = storage.getFileView(PROFILE_BUCKET_ID, response.$id).toString();
      setProfilePicture(url);
      toast.success("Profile picture updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload picture");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!authUser) return;
    setSaving(true);
    try {
      if (editForm.name !== authUser.name) {
        await account.updateName({ name: editForm.name });
      }

      const profileData: Partial<Profile> = {
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
        skills: editForm.skills,
        interests: editForm.interests,
      };

      if (profile) {
        await profileService.update(authUser.$id, profileData);
      } else {
        await profileService.create({
          userId: authUser.$id,
          ...profileData,
        } as any);
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
    if (trimmed && !editForm.skills.includes(trimmed)) {
      setEditForm((prev) => ({ ...prev, skills: [...prev.skills, trimmed] }));
      setNewSkill("");
    }
  };

  const removeSkill = (skill: string) => {
    setEditForm((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skill),
    }));
  };

  const addInterest = () => {
    const trimmed = newInterest.trim();
    if (trimmed && !editForm.interests.includes(trimmed)) {
      setEditForm((prev) => ({ ...prev, interests: [...prev.interests, trimmed] }));
      setNewInterest("");
    }
  };

  const removeInterest = (interest: string) => {
    setEditForm((prev) => ({
      ...prev,
      interests: prev.interests.filter((i) => i !== interest),
    }));
  };

  const statusLabel: Record<string, { label: string; color: string }> = {
    no_account: { label: "No Account", color: "default" },
    account: { label: "Account Holder", color: "default" },
    applicant: { label: "Applicant", color: "warning" },
    member: { label: "Member", color: "primary" },
    core_member: { label: "Core Member", color: "primary" },
    lead: { label: "Lead", color: "secondary" },
    head: { label: "Head", color: "success" },
    admin: { label: "Admin", color: "danger" },
  };

  const currentStatus = statusLabel[status] || statusLabel.account;

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-default-500">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!authUser) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader className="flex flex-col items-center gap-4 pt-8 pb-4">
          <div className="relative group">
            <Avatar className="w-32 h-32 ring-4 ring-default-100">
              <AvatarImage src={profilePicture} alt={authUser.name} />
              <AvatarFallback>{authUser.name?.charAt(0) || "U"}</AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute bottom-1 right-1 bg-primary text-white rounded-full p-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
            >
              {uploadingPhoto ? (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
              )}
            </button>
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
            <p className="text-default-500">{authUser.email}</p>
            {profile?.pronouns && profile.pronouns !== "prefer_to_say" && (
              <p className="text-sm text-default-400">{profile.pronouns}</p>
            )}
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              <Chip size="sm" variant="soft" color={currentStatus.color as any}>
                {currentStatus.label}
              </Chip>
              {userDesignationsResolved.map((d) => (
                <Chip key={d.$id} size="sm" variant="soft" color="secondary">
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
                  color="accent"
                  isLoading={saving}
                  onPress={handleSave}
                >
                  Save Changes
                </Button>
                <Button
                  size="sm"
                  variant="soft"
                  onPress={() => {
                    setIsEditing(false);
                    if (profile) {
                      setEditForm({
                        name: authUser.name || "",
                        pronouns: profile.pronouns || "prefer_to_say",
                        bio: profile.bio || "",
                        phone: profile.phone || "",
                        urn: profile.urn || "",
                        program: profile.program || "",
                        branch: profile.branch || "",
                        year: profile.year || "",
                        semester: profile.semester || "",
                        address: profile.address || "",
                        githubUrl: profile.githubUrl || "",
                        linkedinUrl: profile.linkedinUrl || "",
                        portfolioUrl: profile.portfolioUrl || "",
                        skills: profile.skills || [],
                        interests: profile.interests || [],
                      });
                    }
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button size="sm" variant="soft" onPress={() => setIsEditing(true)}>
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
          {/* Bio */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-default-600">Bio</label>
            {isEditing ? (
              <TextArea
                value={editForm.bio}
                onValueChange={(val) => setEditForm((prev) => ({ ...prev, bio: val }))}
                placeholder="Tell us about yourself..."
                minRows={3}
              />
            ) : (
              <p className="text-sm text-default-700 whitespace-pre-wrap">
                {profile?.bio || "No bio added yet."}
              </p>
            )}
          </div>

          {/* Skills */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-default-600">Skills</label>
            {isEditing ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={newSkill}
                    onValueChange={setNewSkill}
                    placeholder="Add a skill..."
                    size="sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSkill();
                      }
                    }}
                  />
                  <Button size="sm" variant="soft" onPress={addSkill}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editForm.skills.map((skill) => (
                    <Chip key={skill} size="sm" variant="soft" onClose={() => removeSkill(skill)}>
                      {skill}
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
                  <p className="text-sm text-default-400">No skills added yet.</p>
                )}
              </div>
            )}
          </div>

          {/* Interests */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-default-600">Interests</label>
            {isEditing ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={newInterest}
                    onValueChange={setNewInterest}
                    placeholder="Add an interest..."
                    size="sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addInterest();
                      }
                    }}
                  />
                  <Button size="sm" variant="soft" onPress={addInterest}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editForm.interests.map((interest) => (
                    <Chip key={interest} size="sm" variant="soft" onClose={() => removeInterest(interest)}>
                      {interest}
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
                  <p className="text-sm text-default-400">No interests added yet.</p>
                )}
              </div>
            )}
          </div>

          {/* Social Links */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-default-600">Social Links</label>
            {isEditing ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-default-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  <Input
                    value={editForm.githubUrl}
                    onValueChange={(val) => setEditForm((prev) => ({ ...prev, githubUrl: val }))}
                    placeholder="GitHub profile URL"
                    size="sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-default-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                  <Input
                    value={editForm.linkedinUrl}
                    onValueChange={(val) => setEditForm((prev) => ({ ...prev, linkedinUrl: val }))}
                    placeholder="LinkedIn profile URL"
                    size="sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-default-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                  <Input
                    value={editForm.portfolioUrl}
                    onValueChange={(val) => setEditForm((prev) => ({ ...prev, portfolioUrl: val }))}
                    placeholder="Portfolio website URL"
                    size="sm"
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
                    className="flex items-center gap-1.5 text-sm text-default-600 hover:text-primary transition-colors"
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
                    className="flex items-center gap-1.5 text-sm text-default-600 hover:text-primary transition-colors"
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
                    className="flex items-center gap-1.5 text-sm text-default-600 hover:text-primary transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                    </svg>
                    Portfolio
                  </a>
                )}
                {!profile?.githubUrl && !profile?.linkedinUrl && !profile?.portfolioUrl && (
                  <p className="text-sm text-default-400">No social links added yet.</p>
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
              <Select
                label="Program"
                placeholder="Select program"
                selectedKey={editForm.program}
                onSelectionChange={(key) => setEditForm((prev) => ({ ...prev, program: key as string }))}
              >
                {PROGRAM_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value}>{opt.label}</SelectItem>
                ))}
              </Select>
              <Input
                label="Branch"
                value={editForm.branch}
                onValueChange={(val) => setEditForm((prev) => ({ ...prev, branch: val }))}
                placeholder="e.g. Computer Science"
              />
              <Select
                label="Year"
                placeholder="Select year"
                selectedKey={editForm.year}
                onSelectionChange={(key) => setEditForm((prev) => ({ ...prev, year: key as string }))}
              >
                {YEAR_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value}>{opt.label}</SelectItem>
                ))}
              </Select>
              <Select
                label="Semester"
                placeholder="Select semester"
                selectedKey={editForm.semester}
                onSelectionChange={(key) => setEditForm((prev) => ({ ...prev, semester: key as string }))}
              >
                {SEMESTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value}>{opt.label}</SelectItem>
                ))}
              </Select>
              <div className="space-y-1.5">
                <Input
                  label="URN (University Roll Number)"
                  value={editForm.urn}
                  onValueChange={(val) => setEditForm((prev) => ({ ...prev, urn: val }))}
                  placeholder="Enter URN"
                />
                <p className="text-xs text-warning flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  This field is audited - changes are logged
                </p>
              </div>
              <Input
                label="Phone"
                value={editForm.phone}
                onValueChange={(val) => setEditForm((prev) => ({ ...prev, phone: val }))}
                placeholder="Phone number"
              />
              <div className="space-y-1.5 md:col-span-2">
                <Input
                  label="Address"
                  value={editForm.address}
                  onValueChange={(val) => setEditForm((prev) => ({ ...prev, address: val }))}
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
                <label className="text-xs text-default-400">Program</label>
                <p className="text-sm">{profile?.program || "-"}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-default-400">Branch</label>
                <p className="text-sm">{profile?.branch || "-"}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-default-400">Year</label>
                <p className="text-sm">{profile?.year || "-"}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-default-400">Semester</label>
                <p className="text-sm">{profile?.semester ? `Semester ${profile.semester}` : "-"}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-default-400">URN</label>
                <p className="text-sm font-mono">{profile?.urn || "-"}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-default-400">Phone</label>
                <p className="text-sm">{profile?.phone || "-"}</p>
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs text-default-400">Address</label>
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
            <label className="text-sm font-medium text-default-600">Membership</label>
            {membership ? (
              <div className="flex items-center gap-3 p-3 bg-default-50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium">{membership.membershipNumber}</p>
                  <p className="text-xs text-default-400">
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
              <p className="text-sm text-default-400">No active membership.</p>
            )}
          </div>

          {/* Departments */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-default-600">Departments</label>
            <div className="flex flex-wrap gap-2">
              {userDepartmentsResolved.length > 0 ? (
                userDepartmentsResolved.map((dept) => {
                  const userDept = userDepartments.find((ud) => ud.departmentId === dept.$id);
                  return (
                    <Chip key={dept.$id} size="sm" variant="soft" color="accent">
                      {dept.name}
                      {userDept && (
                        <span className="ml-1 text-default-400">({userDept.role})</span>
                      )}
                    </Chip>
                  );
                })
              ) : (
                <p className="text-sm text-default-400">No departments assigned.</p>
              )}
            </div>
          </div>

          {/* Tickets */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-default-600">
              Events Attended ({tickets.length} tickets)
            </label>
            {tickets.length > 0 ? (
              <div className="space-y-2">
                {tickets.slice(0, 10).map((ticket) => (
                  <div
                    key={ticket.$id}
                    className="flex items-center justify-between p-3 bg-default-50 rounded-lg"
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-mono">{ticket.ticketCode}</p>
                      <p className="text-xs text-default-400">
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
                          ? "primary"
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
                  <p className="text-xs text-default-400 text-center">
                    And {tickets.length - 10} more tickets...
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-default-400">No event tickets yet.</p>
            )}
          </div>

          {/* Designations */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-default-600">Designations</label>
            <div className="flex flex-wrap gap-2">
              {userDesignationsResolved.length > 0 ? (
                userDesignationsResolved.map((desig) => (
                  <Chip key={desig.$id} size="sm" variant="soft" color="secondary">
                    {desig.name}
                    <span className="ml-1 text-default-400 text-xs">Lvl {desig.level}</span>
                  </Chip>
                ))
              ) : (
                <p className="text-sm text-default-400">No designations assigned.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
