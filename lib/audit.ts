import { ID, Query } from "appwrite";
import { databases, APPWRITE_CONFIG } from "./appwrite";
import type { AuditLog } from "./types";

const { databaseId: DATABASE_ID } = APPWRITE_CONFIG;
const AUDIT_LOGS_COLLECTION = "audit_logs";

export const auditService = {
  async log(data: {
    actorId: string;
    actorName: string;
    actorRole: string;
    action: string;
    entityType: string;
    entityId: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLog> {
    const response = await databases.createDocument(
      DATABASE_ID,
      AUDIT_LOGS_COLLECTION,
      ID.unique(),
      {
        ...data,
        details: data.details ? JSON.stringify(data.details) : null,
        timestamp: new Date().toISOString(),
      }
    );
    return response as unknown as AuditLog;
  },

  async getLogs(filters?: {
    actorId?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuditLog[]; total: number }> {
    const queries: string[] = [];
    if (filters?.actorId) queries.push(Query.equal("actorId", filters.actorId));
    if (filters?.entityType) queries.push(Query.equal("entityType", filters.entityType));
    if (filters?.entityId) queries.push(Query.equal("entityId", filters.entityId));
    if (filters?.action) queries.push(Query.equal("action", filters.action));
    queries.push(Query.orderDesc("timestamp"));
    queries.push(Query.limit(filters?.limit || 50));
    if (filters?.offset) queries.push(Query.offset(filters.offset));

    const response = await databases.listDocuments(
      DATABASE_ID,
      AUDIT_LOGS_COLLECTION,
      queries
    );
    return {
      logs: response.documents as unknown as AuditLog[],
      total: response.total,
    };
  },

  async getEntityTrail(entityType: string, entityId: string): Promise<AuditLog[]> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      AUDIT_LOGS_COLLECTION,
      [
        Query.equal("entityType", entityType),
        Query.equal("entityId", entityId),
        Query.orderDesc("timestamp"),
      ]
    );
    return response.documents as unknown as AuditLog[];
  },

  async getUserActivity(userId: string, limit = 50): Promise<AuditLog[]> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      AUDIT_LOGS_COLLECTION,
      [
        Query.equal("actorId", userId),
        Query.orderDesc("timestamp"),
        Query.limit(limit),
      ]
    );
    return response.documents as unknown as AuditLog[];
  },

  async getRecentActivity(limit = 20): Promise<AuditLog[]> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      AUDIT_LOGS_COLLECTION,
      [Query.orderDesc("timestamp"), Query.limit(limit)]
    );
    return response.documents as unknown as AuditLog[];
  },
};
