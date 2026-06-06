import { ID, Query } from "appwrite";
import { databases, APPWRITE_CONFIG } from "./appwrite";
import type { Designation, UserDesignation } from "./types";

const { databaseId: DATABASE_ID } = APPWRITE_CONFIG;
const DESIGNATIONS_COLLECTION = "designations";
const USER_DESIGNATIONS_COLLECTION = "user_designations";

export const designationService = {
  async getAll(): Promise<Designation[]> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      DESIGNATIONS_COLLECTION,
      [Query.equal("isActive", true), Query.orderAsc("level")]
    );
    return response.documents as unknown as Designation[];
  },

  async getById(id: string): Promise<Designation | null> {
    try {
      const response = await databases.getDocument(DATABASE_ID, DESIGNATIONS_COLLECTION, id);
      return response as unknown as Designation;
    } catch {
      return null;
    }
  },

  async create(data: Omit<Designation, "$id" | "$createdAt" | "$updatedAt">): Promise<Designation> {
    const response = await databases.createDocument(
      DATABASE_ID,
      DESIGNATIONS_COLLECTION,
      ID.unique(),
      data
    );
    return response as unknown as Designation;
  },

  async update(id: string, data: Partial<Designation>): Promise<Designation> {
    const response = await databases.updateDocument(
      DATABASE_ID,
      DESIGNATIONS_COLLECTION,
      id,
      data
    );
    return response as unknown as Designation;
  },

  async delete(id: string): Promise<void> {
    await databases.deleteDocument(DATABASE_ID, DESIGNATIONS_COLLECTION, id);
  },

  // User-Designation assignments
  async assign(userId: string, designationId: string, assignedBy: string): Promise<UserDesignation> {
    const response = await databases.createDocument(
      DATABASE_ID,
      USER_DESIGNATIONS_COLLECTION,
      ID.unique(),
      {
        userId,
        designationId,
        assignedBy,
        assignedAt: new Date().toISOString(),
        isActive: true,
      }
    );
    return response as unknown as UserDesignation;
  },

  async revoke(userId: string, designationId: string, revokedBy: string): Promise<void> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      USER_DESIGNATIONS_COLLECTION,
      [Query.equal("userId", userId), Query.equal("designationId", designationId), Query.equal("isActive", true)]
    );
    for (const doc of response.documents) {
      await databases.updateDocument(DATABASE_ID, USER_DESIGNATIONS_COLLECTION, doc.$id, {
        isActive: false,
        revokedBy,
        revokedAt: new Date().toISOString(),
      });
    }
  },

  async getUserDesignations(userId: string): Promise<UserDesignation[]> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      USER_DESIGNATIONS_COLLECTION,
      [Query.equal("userId", userId), Query.equal("isActive", true)]
    );
    return response.documents as unknown as UserDesignation[];
  },

  async getDesignationHolders(designationId: string): Promise<UserDesignation[]> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      USER_DESIGNATIONS_COLLECTION,
      [Query.equal("designationId", designationId), Query.equal("isActive", true)]
    );
    return response.documents as unknown as UserDesignation[];
  },
};
