// app/profile/page.tsx
"use client";
import { Card, CardHeader, CardContent, Avatar, Button, Input, Chip } from "@heroui/react";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { ImageGravity } from "appwrite";
import { account, storage, ID, APPWRITE_CONFIG } from "@/lib/appwrite";
import type { ExtendedUser } from "@/lib/types";
import { toast } from "sonner";
// Profile pictures bucket ID
const PROFILE_BUCKET_ID = "profile-pictures"; // Make sure this exists in Appwrite

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
        // FIXED: Get the URL string properly
        const fileUrl = storage.getFilePreview(
          PROFILE_BUCKET_ID,
          user.prefs.profilePictureId,
          400,
          400,
          ImageGravity.Center,
          100
        );
        
        // Convert URL object to string
        const urlString = fileUrl.toString();
        console.log("Profile picture URL:", urlString);
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
          console.log("Old profile picture deleted");
        } catch (error) {
          console.log("No old picture to delete or error:", error);
        }
      }

      // Upload new profile picture
      const response = await storage.createFile(
        PROFILE_BUCKET_ID,
        ID.unique(),
        file
      );

      console.log("File uploaded:", response.$id);

      // Update user preferences with new picture ID
      await account.updatePrefs({
        prefs: {
          ...user?.prefs,
          profilePictureId: response.$id } });

      // FIXED: Get preview URL properly
      const fileUrl = storage.getFilePreview(
        PROFILE_BUCKET_ID,
        response.$id,
        400,
        400,
        ImageGravity.Center,
        100
      );
      
      const urlString = fileUrl.toString();
      console.log("New profile picture URL:", urlString);
      setProfilePicture(urlString);
      
      setUpdateSuccess(true);
      toast.success("Profile picture updated successfully!");
    } catch (err: any) {
      console.error("Upload error:", err);
      setUpdateError(err.message || "Failed to upload profile picture. Please check bucket permissions.");
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
    } catch (err: any) {
      console.error("Update error:", err);
      setUpdateError(err.message || "Failed to update profile");
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
              src={profilePicture}
              className="w-32 h-32"
              className="border-2 border-default-300"
              color="primary"
              showFallback
              name={user.name}
            />
            <Button
              isIconOnly
              size="sm"
              variant="primary"
                    isLoading={updateLoading}
                  >
                    Save Changes
                  </Button>
                  <Button
                    
                    onPress={() => {
                      setIsEditing(false);
                      setName(user.name);
                      setUpdateError("");
                      setUpdateSuccess(false);
                    }}
                    isDisabled={updateLoading}
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