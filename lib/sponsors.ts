// lib/sponsors.ts
import { ID, Query } from "appwrite";
import { databases, storage } from "./appwrite";
import { DATABASE_ID } from "./database";

// Collection IDs
export const SPONSORS_COLLECTION_ID = "sponsors";
export const SPONSOR_LOGOS_BUCKET_ID = "sponsor-logos";

// Sponsor Interface
export interface Sponsor {
  $id?: string;
  name: string;
  logo: string;
  website: string;
  tier: "platinum" | "gold" | "silver" | "bronze" | "partner";
  description?: string;
  category?: string;
  isActive: boolean;
  displayOrder: number;
  featured: boolean;
  startDate: string;
  endDate?: string;
  $createdAt?: string;
  $updatedAt?: string;
}

// Sponsor Tiers Configuration
export const sponsorTiers = {
  platinum: {
    color: "from-slate-300 to-slate-400",
    label: "Platinum Partner",
    size: "large",
    maxWidth: "200px",
  },
  gold: {
    color: "from-yellow-300 to-yellow-500",
    label: "Gold Sponsor",
    size: "medium",
    maxWidth: "160px",
  },
  silver: {
    color: "from-gray-300 to-gray-400",
    label: "Silver Sponsor",
    size: "medium",
    maxWidth: "140px",
  },
  bronze: {
    color: "from-orange-400 to-orange-600",
    label: "Bronze Sponsor",
    size: "small",
    maxWidth: "120px",
  },
  partner: {
    color: "from-blue-400 to-blue-600",
    label: "Community Partner",
    size: "small",
    maxWidth: "100px",
  },
};

// Sponsor Service
export const sponsorService = {
  // Validate logo URL
  validateLogoUrl(url: string): boolean {
    if (!url) return false;
    
    try {
      const urlObj = new URL(url);
      const validExtensions = ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif'];
      const pathname = urlObj.pathname.toLowerCase();
      
      // Check if URL has a valid image extension
      return validExtensions.some(ext => pathname.endsWith(ext));
    } catch {
      return false;
    }
  },

  // Get all active sponsors
  async getActiveSponsors() {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        SPONSORS_COLLECTION_ID,
        [
          Query.equal("isActive", true),
          Query.orderAsc("displayOrder"),
        ]
      );
      return response.documents as unknown as Sponsor[];
    } catch (error) {
      console.error("Error fetching sponsors:", error);
      return [];
    }
  },

  // Get all sponsors (including inactive) - for admin
  async getAllSponsors() {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        SPONSORS_COLLECTION_ID,
        [Query.orderAsc("displayOrder")]
      );
      return response.documents as unknown as Sponsor[];
    } catch (error) {
      console.error("Error fetching all sponsors:", error);
      return [];
    }
  },

  // Get featured sponsors (for homepage)
  async getFeaturedSponsors() {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        SPONSORS_COLLECTION_ID,
        [
          Query.equal("isActive", true),
          Query.equal("featured", true),
          Query.orderAsc("displayOrder"),
          Query.limit(8),
        ]
      );
      return response.documents as unknown as Sponsor[];
    } catch (error) {
      console.error("Error fetching featured sponsors:", error);
      return [];
    }
  },

  // Get sponsors by tier
  async getSponsorsByTier(tier: string) {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        SPONSORS_COLLECTION_ID,
        [
          Query.equal("isActive", true),
          Query.equal("tier", tier),
          Query.orderAsc("displayOrder"),
        ]
      );
      return response.documents as unknown as Sponsor[];
    } catch (error) {
      console.error("Error fetching sponsors by tier:", error);
      return [];
    }
  },

  // Get sponsor by ID
  async getSponsorById(sponsorId: string) {
    try {
      const response = await databases.getDocument(
        DATABASE_ID,
        SPONSORS_COLLECTION_ID,
        sponsorId
      );
      return response as unknown as Sponsor;
    } catch (error) {
      console.error("Error fetching sponsor:", error);
      throw error;
    }
  },

  // Create sponsor (Admin)
  async createSponsor(sponsorData: Omit<Sponsor, "$id" | "$createdAt" | "$updatedAt">) {
    try {
      const response = await databases.createDocument(
        DATABASE_ID,
        SPONSORS_COLLECTION_ID,
        ID.unique(),
        sponsorData
      );
      return response as unknown as Sponsor;
    } catch (error) {
      console.error("Error creating sponsor:", error);
      throw error;
    }
  },

  // Update sponsor (Admin)
  async updateSponsor(sponsorId: string, sponsorData: Partial<Sponsor>) {
    try {
      const response = await databases.updateDocument(
        DATABASE_ID,
        SPONSORS_COLLECTION_ID,
        sponsorId,
        sponsorData
      );
      return response as unknown as Sponsor;
    } catch (error) {
      console.error("Error updating sponsor:", error);
      throw error;
    }
  },

  // Delete sponsor (Admin)
  async deleteSponsor(sponsorId: string) {
    try {
      await databases.deleteDocument(
        DATABASE_ID,
        SPONSORS_COLLECTION_ID,
        sponsorId
      );
      return true;
    } catch (error) {
      console.error("Error deleting sponsor:", error);
      throw error;
    }
  },

  // Upload sponsor logo
  async uploadSponsorLogo(file: File) {
    try {
      const response = await storage.createFile(
        SPONSOR_LOGOS_BUCKET_ID,
        ID.unique(),
        file
      );
      const fileUrl = storage.getFileView(SPONSOR_LOGOS_BUCKET_ID, response.$id);
      return fileUrl.toString();
    } catch (error) {
      console.error("Error uploading logo:", error);
      throw error;
    }
  },

  // Delete sponsor logo from storage
  async deleteSponsorLogo(fileId: string) {
    try {
      await storage.deleteFile(SPONSOR_LOGOS_BUCKET_ID, fileId);
      return true;
    } catch (error) {
      console.error("Error deleting logo:", error);
      throw error;
    }
  },

  // Get logo file ID from URL
  getLogoFileId(logoUrl: string): string | null {
    try {
      const url = new URL(logoUrl);
      const pathParts = url.pathname.split('/');
      // Assuming URL format: .../storage/buckets/{bucketId}/files/{fileId}/view
      const fileIdIndex = pathParts.indexOf('files') + 1;
      return pathParts[fileIdIndex] || null;
    } catch {
      return null;
    }
  },
};