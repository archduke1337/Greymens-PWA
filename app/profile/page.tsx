// app/profile/page.tsx
"use client";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { ImageGravity } from "appwrite";
import { account, storage, ID, APPWRITE_CONFIG } from "@/lib/appwrite";
import type { ExtendedUser } from "@/lib/types";
import { toast } from "sonner";
import { Avatar, AvatarImage, AvatarFallback, Button, Card, CardContent, CardHeader, Chip, Input } from "@heroui/react";

const { profilePicturesBucketId: PROFILE_BUCKET_ID } = APPWRITE_CONFIG;

export default function ProfilePage() {
  const { user: authUser, loading } = useAuth();
  const user = authUser as unknown as ExtendedUser | null;
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [profilePicture, setProfilePicture] = useState<string>("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const [updateSuccess, setUpdateSuccess] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
    if (user) {
      setName(user.name);
      setPhone(user.phone || "");
      loadProfilePicture();
    }
  }, [user, loading, router]);

  const loadProfilePicture = () => {
    if (user?.prefs?.profilePictureId) {
      try {
        const fileUrl = storage.getFilePreview(
          PROFILE_BUCKET_ID,
          user.prefs.profilePictureId,
          400,
          400,
          ImageGravity.Center,
          100
        );
        
        const urlString = fileUrl.toString();
        setProfilePicture(urlString);
      } catch (error) {
        console.error("Error loading profile picture:", error);
        // Fallback to generated avatar
        setProfilePicture(getAvatarUrl(user.name));
      }
    } else {
      // Use generated avatar if no profile picture
      setProfilePicture(getAvatarUrl(user?.name || "User"));
    }
  };

  const getAvatarUrl = (name: string) => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=400`;
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setUpdateError("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUpdateError("Image size should be less than 5MB");
      return;
    }

    setUploadingPhoto(true);
    setUpdateError("");

    try {
      // Delete old profile picture if exists
      if (user?.prefs?.profilePictureId) {
        try {
          await storage.deleteFile(PROFILE_BUCKET_ID, user.prefs.profilePictureId);
        } catch {
          // No old picture to delete
        }
        }
      }

      // Upload new profile picture
      const response = await storage.createFile(
        PROFILE_BUCKET_ID,
        ID.unique(),
        file
      );

      await account.updatePrefs({
        prefs: {
          ...user?.prefs,
          profilePictureId: response.$id,
        },
      });

      const urlString = fileUrl.toString();
      setProfilePicture(urlString);
      
      setUpdateSuccess(true);
      toast.success("Profile picture updated successfully!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to upload profile picture. Please check bucket permissions.";
      setUpdateError(message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateError("");
    setUpdateSuccess(false);
    setUpdateLoading(true);

    try {
      await account.updateName({ name });
      setUpdateSuccess(true);
      setIsEditing(false);
      
      toast.success("Profile updated successfully!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
      setUpdateError(message);
    } finally {
      setUpdateLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-default-500">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)] py-8 px-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="flex flex-col gap-4 items-center pt-8">
          <div className="relative">
            <Avatar
              className="w-32 h-32"
            >
              <AvatarImage src={profilePicture} alt={user.name} />
              <AvatarFallback>{user.name?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
            <Button
              isIconOnly
              size="sm"
              className="absolute bottom-0 right-0 shadow-lg"
              isPending={uploadingPhoto}
            >
              {!uploadingPhoto && (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              title="Upload profile picture"
              placeholder="Select an image"
            />
          </div>
          <div className="flex flex-col items-center gap-1">
            <h1 className="text-2xl font-bold">{user.name}</h1>
            <p className="text-default-500">{user.email}</p>
            {user.phone && (
              <p className="text-default-500 text-sm">{user.phone}</p>
            )}
            <Chip variant="primary" size="sm" className="mt-2">
              Active Account
            </Chip>
          </div>
        </CardHeader>

        <CardContent className="gap-6 px-4 md:px-8 pb-8">
          {/* Show upload status */}
          {updateError && (
            <div className={`p-3 rounded-lg text-sm ${
              updateSuccess ? "bg-success-50 text-success-700 dark:bg-success-900/20" : "bg-danger-50 text-danger-700 dark:bg-danger-900/20"
            }`}>
              {updateError}
            </div>
          )}

          <div className="border-t border-divider pt-6">
            <h2 className="text-lg font-semibold mb-4">Account Information</h2>
            
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm text-default-500">User ID</label>
                <p className="text-xs md:text-sm font-mono bg-default-100 p-2 rounded-lg break-all">
                  {user.$id}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm text-default-500">Email</label>
                <div className="flex items-center justify-between">
                  <p className="text-sm p-2 break-all">{user.email}</p>
                  <Chip 
                    color={user.emailVerification ? "success" : "warning"} 
                    variant="primary" 
                    size="sm"
                  >
                    {user.emailVerification ? "Verified" : "Not Verified"}
                  </Chip>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm text-default-500">Phone Number</label>
                <div className="flex items-center justify-between">
                  <p className="text-sm p-2">{user.phone || "Not added"}</p>
                  <Chip 
                    color={user.phoneVerification ? "success" : "warning"} 
                    variant="primary" 
                    size="sm"
                  >
                    {user.phoneVerification ? "Verified" : "Not Verified"}
                  </Chip>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm text-default-500">Account Created</label>
                <p className="text-sm p-2">
                  {new Date(user.$createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-divider pt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Profile Details</h2>
              {!isEditing && (
                <Button
                  size="sm"
                  variant="primary"
                  onPress={() => setIsEditing(true)}
                >
                  Edit Profile
                </Button>
              )}
            </div>

            {isEditing ? (
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <Input
                  value={name}
                  onChange={(e: any) => setName(e.target.value)}
                  placeholder="Enter your name"
                  required
                  disabled={updateLoading}
                />

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    isPending={updateLoading}
                  >
                    Save Changes
                  </Button>
                  <Button
                    size="sm"
                    className="w-full font-medium"
                    variant="ghost"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-default-500">Name</label>
                  <p className="text-sm p-2">{user.name}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}