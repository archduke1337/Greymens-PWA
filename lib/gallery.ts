import { ID, Query } from "appwrite";
import { databases, storage, APPWRITE_CONFIG } from "./appwrite";
import type { GalleryImage } from "./types";
export type { GalleryImage };

const { databaseId: DATABASE_ID, galleryCollectionId: GALLERY_COLLECTION_ID, galleryImagesBucketId: GALLERY_BUCKET_ID } = APPWRITE_CONFIG;

export const galleryService = {
  async getApproved(category?: string): Promise<GalleryImage[]> {
    const queries: string[] = [
      Query.equal("status", "approved"),
      Query.equal("isActive", true),
      Query.orderDesc("displayOrder"),
      Query.limit(100),
    ];
    if (category && category !== "all") {
      queries.push(Query.equal("category", category));
    }
    const response = await databases.listDocuments(DATABASE_ID, GALLERY_COLLECTION_ID, queries);
    return response.documents as unknown as GalleryImage[];
  },

  async getAll(): Promise<GalleryImage[]> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      GALLERY_COLLECTION_ID,
      [Query.orderDesc("$createdAt"), Query.limit(200)]
    );
    return response.documents as unknown as GalleryImage[];
  },

  async getPending(): Promise<GalleryImage[]> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      GALLERY_COLLECTION_ID,
      [Query.equal("status", "pending"), Query.orderDesc("$createdAt")]
    );
    return response.documents as unknown as GalleryImage[];
  },

  async getById(id: string): Promise<GalleryImage | null> {
    try {
      const response = await databases.getDocument(DATABASE_ID, GALLERY_COLLECTION_ID, id);
      return response as unknown as GalleryImage;
    } catch {
      return null;
    }
  },

  async create(data: Omit<GalleryImage, "$id" | "$createdAt" | "$updatedAt">): Promise<GalleryImage> {
    const response = await databases.createDocument(
      DATABASE_ID,
      GALLERY_COLLECTION_ID,
      ID.unique(),
      data
    );
    return response as unknown as GalleryImage;
  },

  async update(id: string, data: Partial<GalleryImage>): Promise<GalleryImage> {
    const response = await databases.updateDocument(DATABASE_ID, GALLERY_COLLECTION_ID, id, data);
    return response as unknown as GalleryImage;
  },

  async approve(id: string, approvedBy: string): Promise<void> {
    await databases.updateDocument(DATABASE_ID, GALLERY_COLLECTION_ID, id, {
      status: "approved",
      approvedBy,
      approvedAt: new Date().toISOString(),
    });
  },

  async reject(id: string, rejectionReason: string): Promise<void> {
    await databases.updateDocument(DATABASE_ID, GALLERY_COLLECTION_ID, id, {
      status: "rejected",
      rejectionReason,
    });
  },

  async delete(id: string): Promise<void> {
    await databases.deleteDocument(DATABASE_ID, GALLERY_COLLECTION_ID, id);
  },

  async uploadImage(file: File): Promise<string> {
    const response = await storage.createFile(GALLERY_BUCKET_ID, ID.unique(), file);
    return storage.getFileView(GALLERY_BUCKET_ID, response.$id).toString();
  },

  async getCounts(): Promise<{ pending: number; approved: number; rejected: number }> {
    const [pending, approved, rejected] = await Promise.all([
      databases.listDocuments(DATABASE_ID, GALLERY_COLLECTION_ID, [Query.equal("status", "pending"), Query.limit(1)]),
      databases.listDocuments(DATABASE_ID, GALLERY_COLLECTION_ID, [Query.equal("status", "approved"), Query.limit(1)]),
      databases.listDocuments(DATABASE_ID, GALLERY_COLLECTION_ID, [Query.equal("status", "rejected"), Query.limit(1)]),
    ]);
    return { pending: pending.total, approved: approved.total, rejected: rejected.total };
  },
};
