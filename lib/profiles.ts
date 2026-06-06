import { ID, Query } from "appwrite";
import { databases, storage, APPWRITE_CONFIG } from "./appwrite";
import type { Profile } from "./types";

const { databaseId: DATABASE_ID } = APPWRITE_CONFIG;
const PROFILES_COLLECTION = "profiles";

export const profileService = {
  async getByUserId(userId: string): Promise<Profile | null> {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        PROFILES_COLLECTION,
        [Query.equal("userId", userId), Query.limit(1)]
      );
      return (response.documents[0] as unknown as Profile) || null;
    } catch {
      return null;
    }
  },

  async create(data: Omit<Profile, "$id" | "$createdAt" | "$updatedAt">): Promise<Profile> {
    const response = await databases.createDocument(
      DATABASE_ID,
      PROFILES_COLLECTION,
      ID.unique(),
      data
    );
    return response as unknown as Profile;
  },

  async update(userId: string, data: Partial<Profile>): Promise<Profile> {
    const profile = await this.getByUserId(userId);
    if (!profile) throw new Error("Profile not found");
    const response = await databases.updateDocument(
      DATABASE_ID,
      PROFILES_COLLECTION,
      profile.$id!,
      data
    );
    return response as unknown as Profile;
  },

  async getAll(queries: string[] = []): Promise<Profile[]> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      PROFILES_COLLECTION,
      queries
    );
    return response.documents as unknown as Profile[];
  },

  async uploadAvatar(file: File): Promise<string> {
    const response = await storage.createFile(
      APPWRITE_CONFIG.profilePicturesBucketId || APPWRITE_CONFIG.eventImagesBucketId,
      ID.unique(),
      file
    );
    return storage.getFileView(
      APPWRITE_CONFIG.profilePicturesBucketId || APPWRITE_CONFIG.eventImagesBucketId,
      response.$id
    ).toString();
  },

  async search(query: string): Promise<Profile[]> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      PROFILES_COLLECTION,
      [Query.limit(20)]
    );
    const all = response.documents as unknown as Profile[];
    const q = query.toLowerCase();
    return all.filter(p =>
      p.userId?.toLowerCase().includes(q) ||
      p.urn?.toLowerCase().includes(q) ||
      p.branch?.toLowerCase().includes(q)
    );
  },
};
