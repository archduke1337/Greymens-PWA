import { ID, Query } from "appwrite";
import { databases, APPWRITE_CONFIG } from "./appwrite";
import type { Department, UserDepartment } from "./types";

const { databaseId: DATABASE_ID } = APPWRITE_CONFIG;
const DEPARTMENTS_COLLECTION = "departments";
const USER_DEPARTMENTS_COLLECTION = "user_departments";

export const departmentService = {
  async getAll(): Promise<Department[]> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      DEPARTMENTS_COLLECTION,
      [Query.equal("isActive", true), Query.orderAsc("displayOrder")]
    );
    return response.documents as unknown as Department[];
  },

  async getById(id: string): Promise<Department | null> {
    try {
      const response = await databases.getDocument(DATABASE_ID, DEPARTMENTS_COLLECTION, id);
      return response as unknown as Department;
    } catch {
      return null;
    }
  },

  async getBySlug(slug: string): Promise<Department | null> {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        DEPARTMENTS_COLLECTION,
        [Query.equal("slug", slug), Query.limit(1)]
      );
      return (response.documents[0] as unknown as Department) || null;
    } catch {
      return null;
    }
  },

  async create(data: Omit<Department, "$id" | "$createdAt" | "$updatedAt">): Promise<Department> {
    const response = await databases.createDocument(
      DATABASE_ID,
      DEPARTMENTS_COLLECTION,
      ID.unique(),
      data
    );
    return response as unknown as Department;
  },

  async update(id: string, data: Partial<Department>): Promise<Department> {
    const response = await databases.updateDocument(
      DATABASE_ID,
      DEPARTMENTS_COLLECTION,
      id,
      data
    );
    return response as unknown as Department;
  },

  async delete(id: string): Promise<void> {
    await databases.deleteDocument(DATABASE_ID, DEPARTMENTS_COLLECTION, id);
  },

  // User-Department assignments
  async assignUser(userId: string, departmentId: string, role: "member" | "core_member" | "lead", assignedBy: string): Promise<UserDepartment> {
    const response = await databases.createDocument(
      DATABASE_ID,
      USER_DEPARTMENTS_COLLECTION,
      ID.unique(),
      {
        userId,
        departmentId,
        role,
        assignedBy,
        assignedAt: new Date().toISOString(),
        isActive: true,
      }
    );
    return response as unknown as UserDepartment;
  },

  async removeUser(userId: string, departmentId: string): Promise<void> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      USER_DEPARTMENTS_COLLECTION,
      [Query.equal("userId", userId), Query.equal("departmentId", departmentId)]
    );
    for (const doc of response.documents) {
      await databases.updateDocument(DATABASE_ID, USER_DEPARTMENTS_COLLECTION, doc.$id, { isActive: false });
    }
  },

  async getUserDepartments(userId: string): Promise<UserDepartment[]> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      USER_DEPARTMENTS_COLLECTION,
      [Query.equal("userId", userId), Query.equal("isActive", true)]
    );
    return response.documents as unknown as UserDepartment[];
  },

  async getDepartmentMembers(departmentId: string): Promise<UserDepartment[]> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      USER_DEPARTMENTS_COLLECTION,
      [Query.equal("departmentId", departmentId), Query.equal("isActive", true)]
    );
    return response.documents as unknown as UserDepartment[];
  },

  async getMemberCount(departmentId: string): Promise<number> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      USER_DEPARTMENTS_COLLECTION,
      [Query.equal("departmentId", departmentId), Query.equal("isActive", true), Query.limit(1)]
    );
    return response.total;
  },
};
