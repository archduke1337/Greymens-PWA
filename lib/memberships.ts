import { ID, Query } from "appwrite";
import { databases, APPWRITE_CONFIG } from "./appwrite";
import type { Membership } from "./types";

const { databaseId: DATABASE_ID } = APPWRITE_CONFIG;
const MEMBERSHIPS_COLLECTION = "memberships";

function generateMembershipNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `MM-${year}-${random}`;
}

export const membershipService = {
  async getByUserId(userId: string): Promise<Membership | null> {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        MEMBERSHIPS_COLLECTION,
        [Query.equal("userId", userId), Query.limit(1)]
      );
      return (response.documents[0] as unknown as Membership) || null;
    } catch {
      return null;
    }
  },

  async create(data: {
    userId: string;
    applicationId: string;
    approvedBy: string;
    department?: string;
  }): Promise<Membership> {
    const membership: Omit<Membership, "$id" | "$createdAt" | "$updatedAt"> = {
      userId: data.userId,
      applicationId: data.applicationId,
      status: "active",
      membershipNumber: generateMembershipNumber(),
      approvedBy: data.approvedBy,
      approvedAt: new Date().toISOString(),
      department: data.department,
      joinedAt: new Date().toISOString(),
    };

    const response = await databases.createDocument(
      DATABASE_ID,
      MEMBERSHIPS_COLLECTION,
      ID.unique(),
      membership
    );
    return response as unknown as Membership;
  },

  async update(userId: string, data: Partial<Membership>): Promise<Membership> {
    const membership = await this.getByUserId(userId);
    if (!membership) throw new Error("Membership not found");
    const response = await databases.updateDocument(
      DATABASE_ID,
      MEMBERSHIPS_COLLECTION,
      membership.$id!,
      data
    );
    return response as unknown as Membership;
  },

  async getAll(queries: string[] = []): Promise<Membership[]> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      MEMBERSHIPS_COLLECTION,
      queries
    );
    return response.documents as unknown as Membership[];
  },

  async getCount(): Promise<{ active: number; inactive: number; banned: number }> {
    const [active, inactive, banned] = await Promise.all([
      databases.listDocuments(DATABASE_ID, MEMBERSHIPS_COLLECTION, [Query.equal("status", "active"), Query.limit(1)]),
      databases.listDocuments(DATABASE_ID, MEMBERSHIPS_COLLECTION, [Query.equal("status", "inactive"), Query.limit(1)]),
      databases.listDocuments(DATABASE_ID, MEMBERSHIPS_COLLECTION, [Query.equal("status", "banned"), Query.limit(1)]),
    ]);
    return { active: active.total, inactive: inactive.total, banned: banned.total };
  },

  async ban(userId: string): Promise<Membership> {
    return this.update(userId, { status: "banned" });
  },

  async deactivate(userId: string): Promise<Membership> {
    return this.update(userId, { status: "inactive" });
  },
};
