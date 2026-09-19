// lib/sponsors.ts

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
  /**
   * Moderation state for member-submitted sponsors. Missing on rows that
   * predate the intake flow — those read as approved legacy partners.
   */
  status?: "pending" | "approved" | "rejected";
  submittedBy?: string;
  submittedByName?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
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
    maxWidth: "140px",
  },
  partner: {
    color: "from-blue-400 to-blue-600",
    label: "Community Partner",
    size: "small",
    maxWidth: "100px",
  },
};

/**
 * Reads and writes go through the API routes, not a browser service.
 *
 * - Public catalogue: `GET /api/sponsors` (active only).
 * - Management: `/api/admin/sponsors` behind `sponsors.manage`.
 *
 * The sponsors table grants no client access, so the previous browser-SDK
 * service (including its extension-sniffing logo validator, which rejected
 * the extensionless Appwrite file URLs its own upload produced) was removed.
 * This module keeps the shared row type and the tier display catalogue.
 */
