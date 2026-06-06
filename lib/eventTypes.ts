import { ID, Query } from "appwrite";
import { databases, APPWRITE_CONFIG } from "./appwrite";
import type { EventType, EventField, RegistrationConfig, TicketConfig, WorkflowConfig } from "./types";

const { databaseId: DATABASE_ID } = APPWRITE_CONFIG;
const EVENT_TYPES_COLLECTION = "event_types";

export const eventTypeService = {
  async getAll(): Promise<EventType[]> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      EVENT_TYPES_COLLECTION,
      [Query.equal("isActive", true), Query.orderAsc("displayOrder")]
    );
    return response.documents.map(doc => ({
      ...doc,
      fields: typeof doc.fields === "string" ? JSON.parse(doc.fields) : doc.fields,
      registrationConfig: typeof doc.registrationConfig === "string" ? JSON.parse(doc.registrationConfig) : doc.registrationConfig,
      ticketConfig: typeof doc.ticketConfig === "string" ? JSON.parse(doc.ticketConfig) : doc.ticketConfig,
      workflowConfig: typeof doc.workflowConfig === "string" ? JSON.parse(doc.workflowConfig) : doc.workflowConfig,
    })) as unknown as EventType[];
  },

  async getById(id: string): Promise<EventType | null> {
    try {
      const doc = await databases.getDocument(DATABASE_ID, EVENT_TYPES_COLLECTION, id);
      return {
        ...doc,
        fields: typeof doc.fields === "string" ? JSON.parse(doc.fields) : doc.fields,
        registrationConfig: typeof doc.registrationConfig === "string" ? JSON.parse(doc.registrationConfig) : doc.registrationConfig,
        ticketConfig: typeof doc.ticketConfig === "string" ? JSON.parse(doc.ticketConfig) : doc.ticketConfig,
        workflowConfig: typeof doc.workflowConfig === "string" ? JSON.parse(doc.workflowConfig) : doc.workflowConfig,
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
        [Query.equal("name", name), Query.limit(1)]
      );
      if (!response.documents[0]) return null;
      const doc = response.documents[0];
      return {
        ...doc,
        fields: typeof doc.fields === "string" ? JSON.parse(doc.fields) : doc.fields,
        registrationConfig: typeof doc.registrationConfig === "string" ? JSON.parse(doc.registrationConfig) : doc.registrationConfig,
        ticketConfig: typeof doc.ticketConfig === "string" ? JSON.parse(doc.ticketConfig) : doc.ticketConfig,
        workflowConfig: typeof doc.workflowConfig === "string" ? JSON.parse(doc.workflowConfig) : doc.workflowConfig,
      } as unknown as EventType;
    } catch {
      return null;
    }
  },

  async create(data: Omit<EventType, "$id" | "$createdAt" | "$updatedAt">): Promise<EventType> {
    const response = await databases.createDocument(
      DATABASE_ID,
      EVENT_TYPES_COLLECTION,
      ID.unique(),
      {
        ...data,
        fields: JSON.stringify(data.fields),
        registrationConfig: JSON.stringify(data.registrationConfig),
        ticketConfig: JSON.stringify(data.ticketConfig),
        workflowConfig: JSON.stringify(data.workflowConfig),
      }
    );
    return response as unknown as EventType;
  },

  async update(id: string, data: Partial<EventType>): Promise<EventType> {
    const updateData: Record<string, any> = { ...data };
    if (data.fields) updateData.fields = JSON.stringify(data.fields);
    if (data.registrationConfig) updateData.registrationConfig = JSON.stringify(data.registrationConfig);
    if (data.ticketConfig) updateData.ticketConfig = JSON.stringify(data.ticketConfig);
    if (data.workflowConfig) updateData.workflowConfig = JSON.stringify(data.workflowConfig);

    const response = await databases.updateDocument(
      DATABASE_ID,
      EVENT_TYPES_COLLECTION,
      id,
      updateData
    );
    return response as unknown as EventType;
  },

  async delete(id: string): Promise<void> {
    await databases.deleteDocument(DATABASE_ID, EVENT_TYPES_COLLECTION, id);
  },
};
