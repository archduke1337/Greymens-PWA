import type { EventType } from "./types";

import { Query } from "appwrite";

import { databases, APPWRITE_CONFIG } from "./appwrite";

const { databaseId: DATABASE_ID } = APPWRITE_CONFIG;
const EVENT_TYPES_COLLECTION = "event_types";

function safeParse(value: unknown, fallback: unknown) {
  if (typeof value !== "string") return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export const eventTypeService = {
  async getAll(): Promise<EventType[]> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      EVENT_TYPES_COLLECTION,
      [Query.equal("isActive", true), Query.orderAsc("displayOrder")],
    );

    return response.documents.map((doc) => ({
      ...doc,
      fields: safeParse(doc.fields, []),
      registrationConfig: safeParse(doc.registrationConfig, {}),
      ticketConfig: safeParse(doc.ticketConfig, {}),
      workflowConfig: safeParse(doc.workflowConfig, {}),
    })) as unknown as EventType[];
  },

  async getById(id: string): Promise<EventType | null> {
    try {
      const doc = await databases.getDocument(
        DATABASE_ID,
        EVENT_TYPES_COLLECTION,
        id,
      );

      return {
        ...doc,
        fields: safeParse(doc.fields, []),
        registrationConfig: safeParse(doc.registrationConfig, {}),
        ticketConfig: safeParse(doc.ticketConfig, {}),
        workflowConfig: safeParse(doc.workflowConfig, {}),
      } as unknown as EventType;
    } catch {
      return null;
    }
  },

  async getByName(name: string): Promise<EventType | null> {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        EVENT_TYPES_COLLECTION,
        [Query.equal("name", name), Query.limit(1)],
      );

      if (!response.documents[0]) return null;
      const doc = response.documents[0];

      return {
        ...doc,
        fields: safeParse(doc.fields, []),
        registrationConfig: safeParse(doc.registrationConfig, {}),
        ticketConfig: safeParse(doc.ticketConfig, {}),
        workflowConfig: safeParse(doc.workflowConfig, {}),
      } as unknown as EventType;
    } catch {
      return null;
    }
  },

  async create(
    _data: Omit<EventType, "$id" | "$createdAt" | "$updatedAt">,
  ): Promise<EventType> {
    throw new Error(
      "Use /api/admin/event-types (server-owned). Browser create is disabled.",
    );
  },

  async update(_id: string, _data: Partial<EventType>): Promise<EventType> {
    throw new Error(
      "Use /api/admin/event-types (server-owned). Browser update is disabled.",
    );
  },

  async delete(_id: string): Promise<void> {
    throw new Error("Use server admin route. Browser delete is disabled.");
  },
};
