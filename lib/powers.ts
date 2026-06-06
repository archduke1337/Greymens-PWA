import { ID, Query } from "appwrite";
import { databases, APPWRITE_CONFIG } from "./appwrite";
import type { Power, UserPower } from "./types";

const { databaseId: DATABASE_ID } = APPWRITE_CONFIG;
const POWERS_COLLECTION = "powers";
const USER_POWERS_COLLECTION = "user_powers";

export const powerService = {
  async getAll(): Promise<Power[]> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      POWERS_COLLECTION,
      [Query.orderAsc("category")]
    );
    return response.documents as unknown as Power[];
  },

  async getById(id: string): Promise<Power | null> {
    try {
      const response = await databases.getDocument(DATABASE_ID, POWERS_COLLECTION, id);
      return response as unknown as Power;
    } catch {
      return null;
    }
  },

  async getByCategory(category: string): Promise<Power[]> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      POWERS_COLLECTION,
      [Query.equal("category", category)]
    );
    return response.documents as unknown as Power[];
  },

  // User-Power assignments
  async grant(userId: string, powerId: string, grantedBy: string, departmentId?: string, expiresAt?: string): Promise<UserPower> {
    const response = await databases.createDocument(
      DATABASE_ID,
      USER_POWERS_COLLECTION,
      ID.unique(),
      {
        userId,
        powerId,
        grantedBy,
        grantedAt: new Date().toISOString(),
        departmentId: departmentId || null,
        expiresAt: expiresAt || null,
        isActive: true,
      }
    );
    return response as unknown as UserPower;
  },

  async revoke(userId: string, powerId: string): Promise<void> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      USER_POWERS_COLLECTION,
      [Query.equal("userId", userId), Query.equal("powerId", powerId), Query.equal("isActive", true)]
    );
    for (const doc of response.documents) {
      await databases.updateDocument(DATABASE_ID, USER_POWERS_COLLECTION, doc.$id, { isActive: false });
    }
  },

  async getUserPowers(userId: string): Promise<UserPower[]> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      USER_POWERS_COLLECTION,
      [Query.equal("userId", userId), Query.equal("isActive", true)]
    );
    return response.documents as unknown as UserPower[];
  },

  async getPowerHolders(powerId: string): Promise<UserPower[]> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      USER_POWERS_COLLECTION,
      [Query.equal("powerId", powerId), Query.equal("isActive", true)]
    );
    return response.documents as unknown as UserPower[];
  },

  async getAllUserPowers(queries: string[] = []): Promise<UserPower[]> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      USER_POWERS_COLLECTION,
      queries
    );
    return response.documents as unknown as UserPower[];
  },
};
