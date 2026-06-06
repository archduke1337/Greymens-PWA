import { ID, Query } from "appwrite";
import { databases, APPWRITE_CONFIG } from "./appwrite";
import type { Notification, LetterData } from "./types";

const { databaseId: DATABASE_ID } = APPWRITE_CONFIG;
const NOTIFICATIONS_COLLECTION = "notifications";

export const notificationService = {
  async create(data: {
    userId: string;
    type: string;
    title: string;
    body: string;
    letter?: LetterData;
    data?: Record<string, any>;
  }): Promise<Notification> {
    const response = await databases.createDocument(
      DATABASE_ID,
      NOTIFICATIONS_COLLECTION,
      ID.unique(),
      {
        ...data,
        letter: data.letter ? JSON.stringify(data.letter) : null,
        data: data.data ? JSON.stringify(data.data) : null,
        read: false,
      }
    );
    return response as unknown as Notification;
  },

  async getAll(limit = 200): Promise<Notification[]> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      NOTIFICATIONS_COLLECTION,
      [Query.orderDesc("$createdAt"), Query.limit(limit)]
    );
    return response.documents as unknown as Notification[];
  },

  async getUserNotifications(userId: string, limit = 50): Promise<Notification[]> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      NOTIFICATIONS_COLLECTION,
      [Query.equal("userId", userId), Query.orderDesc("$createdAt"), Query.limit(limit)]
    );
    return response.documents as unknown as Notification[];
  },

  async markAsRead(notificationId: string): Promise<void> {
    await databases.updateDocument(
      DATABASE_ID,
      NOTIFICATIONS_COLLECTION,
      notificationId,
      { read: true, readAt: new Date().toISOString() }
    );
  },

  async markAllAsRead(userId: string): Promise<void> {
    const unread = await databases.listDocuments(
      DATABASE_ID,
      NOTIFICATIONS_COLLECTION,
      [Query.equal("userId", userId), Query.equal("read", false)]
    );
    for (const doc of unread.documents) {
      await databases.updateDocument(DATABASE_ID, NOTIFICATIONS_COLLECTION, doc.$id, {
        read: true,
        readAt: new Date().toISOString(),
      });
    }
  },

  async getUnreadCount(userId: string): Promise<number> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      NOTIFICATIONS_COLLECTION,
      [Query.equal("userId", userId), Query.equal("read", false), Query.limit(1)]
    );
    return response.total;
  },

  async delete(notificationId: string): Promise<void> {
    await databases.deleteDocument(DATABASE_ID, NOTIFICATIONS_COLLECTION, notificationId);
  },

  // Letter template generators
  welcomeLetter(data: { name: string; membershipId: string; department?: string }): LetterData {
    return {
      template: "welcome",
      subject: "Welcome to Mind Mesh Club!",
      body: `Dear ${data.name},\n\nCongratulations! Your membership application has been approved.\n\nMembership ID: ${data.membershipId}\n${data.department ? `Department: ${data.department}\n` : ""}Date of Approval: ${new Date().toLocaleDateString()}\n\nYou now have full access to:\n- Member-only events and workshops\n- Department-specific resources\n- Club community and team directory\n\nWelcome aboard!\n\nBest regards,\nMind Mesh Club Administration`,
      metadata: { membershipId: data.membershipId, department: data.department },
    };
  },

  promotionLetter(data: { name: string; oldRole: string; newDesignation: string; approvedBy: string }): LetterData {
    return {
      template: "promotion",
      subject: `Promotion to ${data.newDesignation}`,
      body: `Dear ${data.name},\n\nWe are pleased to inform you that you have been promoted to ${data.newDesignation}.\n\nPrevious Role: ${data.oldRole}\nNew Role: ${data.newDesignation}\nEffective Date: ${new Date().toLocaleDateString()}\nApproved by: ${data.approvedBy}\n\nCongratulations on this achievement!\n\nBest regards,\nMind Mesh Club Administration`,
      metadata: { newDesignation: data.newDesignation, approvedBy: data.approvedBy },
    };
  },

  designationLetter(data: { name: string; designation: string; assignedBy: string }): LetterData {
    return {
      template: "designation",
      subject: `Designation Assigned: ${data.designation}`,
      body: `Dear ${data.name},\n\nYou have been assigned the designation: ${data.designation}\n\nAssigned by: ${data.assignedBy}\nDate: ${new Date().toLocaleDateString()}\n\nBest regards,\nMind Mesh Club Administration`,
      metadata: { designation: data.designation, assignedBy: data.assignedBy },
    };
  },
};
