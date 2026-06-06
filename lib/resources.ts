import { ID, Query } from "appwrite";
import { databases, APPWRITE_CONFIG } from "./appwrite";
import type { Resource } from "./types";

const { databaseId: DATABASE_ID } = APPWRITE_CONFIG;
const RESOURCES_COLLECTION = "resources";

export const resourceService = {
  async getAll(queries: string[] = []): Promise<Resource[]> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      RESOURCES_COLLECTION,
      [Query.equal("isActive", true), ...queries]
    );
    return response.documents as unknown as Resource[];
  },

  async getById(id: string): Promise<Resource | null> {
    try {
      const response = await databases.getDocument(DATABASE_ID, RESOURCES_COLLECTION, id);
      return response as unknown as Resource;
    } catch {
      return null;
    }
  },

  async getByLayer(layer: "common" | "department" | "role", departmentId?: string): Promise<Resource[]> {
    const queries = [Query.equal("layer", layer), Query.equal("isActive", true)];
    if (layer === "department" && departmentId) {
      queries.push(Query.equal("departmentId", departmentId));
    }
    const response = await databases.listDocuments(DATABASE_ID, RESOURCES_COLLECTION, queries);
    return response.documents as unknown as Resource[];
  },

  async create(data: Omit<Resource, "$id" | "$createdAt" | "$updatedAt">): Promise<Resource> {
    const response = await databases.createDocument(
      DATABASE_ID,
      RESOURCES_COLLECTION,
      ID.unique(),
      data
    );
    return response as unknown as Resource;
  },

  async update(id: string, data: Partial<Resource>): Promise<Resource> {
    const response = await databases.updateDocument(
      DATABASE_ID,
      RESOURCES_COLLECTION,
      id,
      data
    );
    return response as unknown as Resource;
  },

  async delete(id: string): Promise<void> {
    await databases.updateDocument(DATABASE_ID, RESOURCES_COLLECTION, id, { isActive: false });
  },

  async search(query: string): Promise<Resource[]> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      RESOURCES_COLLECTION,
      [Query.equal("isActive", true), Query.limit(50)]
    );
    const q = query.toLowerCase();
    return (response.documents as unknown as Resource[]).filter(r =>
      r.title?.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.tags?.some(t => t.toLowerCase().includes(q))
    );
  },
};
