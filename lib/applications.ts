import { ID, Query } from "appwrite";
import { databases, APPWRITE_CONFIG } from "./appwrite";
import type { Application } from "./types";

const { databaseId: DATABASE_ID } = APPWRITE_CONFIG;
const APPLICATIONS_COLLECTION = "applications";

export const applicationService = {
  async getByUserId(userId: string): Promise<Application | null> {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        APPLICATIONS_COLLECTION,
        [Query.equal("userId", userId), Query.limit(1)]
      );
      return (response.documents[0] as unknown as Application) || null;
    } catch {
      return null;
    }
  },

  async create(data: Omit<Application, "$id" | "$createdAt" | "$updatedAt">): Promise<Application> {
    const response = await databases.createDocument(
      DATABASE_ID,
      APPLICATIONS_COLLECTION,
      ID.unique(),
      { ...data, submittedAt: new Date().toISOString() }
    );
    return response as unknown as Application;
  },

  async update(applicationId: string, data: Partial<Application>): Promise<Application> {
    const response = await databases.updateDocument(
      DATABASE_ID,
      APPLICATIONS_COLLECTION,
      applicationId,
      data
    );
    return response as unknown as Application;
  },

  async approve(applicationId: string, reviewedBy: string): Promise<Application> {
    return this.update(applicationId, {
      status: "approved",
      reviewedBy,
      reviewedAt: new Date().toISOString(),
    });
  },

  async reject(applicationId: string, reviewedBy: string, reason: string): Promise<Application> {
    return this.update(applicationId, {
      status: "rejected",
      reviewedBy,
      reviewedAt: new Date().toISOString(),
      rejectionReason: reason,
    });
  },

  async getPending(queries: string[] = []): Promise<Application[]> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      APPLICATIONS_COLLECTION,
      [Query.equal("status", "pending"), ...queries]
    );
    return response.documents as unknown as Application[];
  },

  async getAll(queries: string[] = []): Promise<Application[]> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      APPLICATIONS_COLLECTION,
      queries
    );
    return response.documents as unknown as Application[];
  },

  async getCount(): Promise<{ pending: number; approved: number; rejected: number }> {
    const [pending, approved, rejected] = await Promise.all([
      databases.listDocuments(DATABASE_ID, APPLICATIONS_COLLECTION, [Query.equal("status", "pending"), Query.limit(1)]),
      databases.listDocuments(DATABASE_ID, APPLICATIONS_COLLECTION, [Query.equal("status", "approved"), Query.limit(1)]),
      databases.listDocuments(DATABASE_ID, APPLICATIONS_COLLECTION, [Query.equal("status", "rejected"), Query.limit(1)]),
    ]);
    return {
      pending: pending.total,
      approved: approved.total,
      rejected: rejected.total,
    };
  },
};
