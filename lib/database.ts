// lib/database.ts
import { ID, Query } from "appwrite";
import { databases, storage, APPWRITE_CONFIG } from "./appwrite";
import { getErrorMessage } from "./errorHandler";
import type { Event, Registration, Project } from "@/lib/types";

const { databaseId: DATABASE_ID, eventsCollectionId: EVENTS_COLLECTION_ID, registrationsCollectionId: REGISTRATIONS_COLLECTION_ID, projectsCollectionId: PROJECTS_COLLECTION_ID, eventImagesBucketId: EVENT_IMAGES_BUCKET_ID } = APPWRITE_CONFIG;

export { DATABASE_ID, EVENTS_COLLECTION_ID, REGISTRATIONS_COLLECTION_ID, PROJECTS_COLLECTION_ID, EVENT_IMAGES_BUCKET_ID };

// Re-export types for backward compatibility with existing imports
export type { Event, Registration, Project };

export interface Project {
  $id?: string;
  title: string;
  description: string;
  image: string;
  category: string;
  status: string;
  progress: number;
  technologies: string[];
  stars: number;
  forks: number;
  contributors: number;
  duration: string;
  isFeatured: boolean;
  demoUrl: string;
  repoUrl: string;
  teamMembers: string[];
  createdAt: string;
  $createdAt?: string;
  $updatedAt?: string;
}

export const eventService = {
  async getAllEvents(queries: string[] = []) {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        EVENTS_COLLECTION_ID,
        queries
      );
      return response.documents as unknown as Event[];
    } catch (error) {
      console.error("Error fetching events:", error);
      throw error;
    }
  },

  async getUpcomingEvents() {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        EVENTS_COLLECTION_ID,
        [
          Query.orderAsc("date"),
          Query.limit(100)
        ]
      );
      return response.documents as unknown as Event[];
    } catch (error) {
      console.error("Error fetching upcoming events:", error);
      throw error;
    }
  },

  async getEventById(eventId: string) {
    try {
      const response = await databases.getDocument(
        DATABASE_ID,
        EVENTS_COLLECTION_ID,
        eventId
      );
      return response as unknown as Event;
    } catch (error) {
      console.error("Error fetching event:", error);
      throw error;
    }
  },

  async createEvent(eventData: Omit<Event, "$id" | "$createdAt" | "$updatedAt">) {
    try {
      const { status: _status, ...dataWithoutStatus } = eventData;
      const response = await databases.createDocument(
        DATABASE_ID,
        EVENTS_COLLECTION_ID,
        ID.unique(),
        dataWithoutStatus
      );
      return response as unknown as Event;
    } catch (error) {
      console.error("Error creating event:", error);
      throw error;
    }
  },

  async updateEvent(eventId: string, eventData: Partial<Event>) {
    try {
      const { status: _status, ...dataWithoutStatus } = eventData;
      const response = await databases.updateDocument(
        DATABASE_ID,
        EVENTS_COLLECTION_ID,
        eventId,
        dataWithoutStatus
      );
      return response as unknown as Event;
    } catch (error) {
      console.error("Error updating event:", error);
      throw error;
    }
  },

  async deleteEvent(eventId: string) {
    try {
      await databases.deleteDocument(
        DATABASE_ID,
        EVENTS_COLLECTION_ID,
        eventId
      );
      return true;
    } catch (error) {
      console.error("Error deleting event:", error);
      throw error;
    }
  },

  async deletePastEvents() {
    try {
      const today = new Date().toISOString().split("T")[0];
      const response = await databases.listDocuments(
        DATABASE_ID,
        EVENTS_COLLECTION_ID,
        [Query.lessThan("date", today)]
      );

      const deletePromises = response.documents.map((doc) =>
        databases.deleteDocument(DATABASE_ID, EVENTS_COLLECTION_ID, doc.$id)
      );

      await Promise.all(deletePromises);
      return response.documents.length;
    } catch (error) {
      console.error("Error deleting past events:", error);
      throw error;
    }
  },

  async uploadEventImage(file: File) {
    try {
      const response = await storage.createFile(
        EVENT_IMAGES_BUCKET_ID,
        ID.unique(),
        file
      );
      const fileUrl = storage.getFileView(EVENT_IMAGES_BUCKET_ID, response.$id);
      return fileUrl.toString();
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    }
  },

  async registerForEvent(
    eventId: string,
    userId: string,
    userName: string,
    userEmail: string
  ) {
    try {
      const existingRegistrations = await databases.listDocuments(
        DATABASE_ID,
        REGISTRATIONS_COLLECTION_ID,
        [
          Query.equal("eventId", eventId),
          Query.equal("userId", userId),
          Query.limit(1)
        ]
      );

      if (existingRegistrations.documents.length > 0) {
        throw new Error("Already registered for this event");
      }

      const event = await this.getEventById(eventId);
      if (event.capacity && event.registered >= event.capacity) {
        throw new Error("Event is full");
      }

      const registration = await databases.createDocument(
        DATABASE_ID,
        REGISTRATIONS_COLLECTION_ID,
        ID.unique(),
        {
          eventId,
          userId,
          userName,
          userEmail,
          registeredAt: new Date().toISOString()
        }
      );

      await this.updateEvent(eventId, {
        registered: event.registered + 1
      });

      return registration as unknown as Registration;
    } catch (error) {
      console.error("Error registering for event:", getErrorMessage(error));
      throw error;
    }
  },

  async getUserRegistrations(userId: string) {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        REGISTRATIONS_COLLECTION_ID,
        [
          Query.equal("userId", userId),
          Query.orderDesc("registeredAt")
        ]
      );
      return response.documents as unknown as Registration[];
    } catch (error) {
      console.error("Error fetching user registrations:", error);
      throw error;
    }
  },

  async isUserRegistered(eventId: string, userId: string): Promise<boolean> {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        REGISTRATIONS_COLLECTION_ID,
        [
          Query.equal("eventId", eventId),
          Query.equal("userId", userId),
          Query.limit(1)
        ]
      );
      return response.documents.length > 0;
    } catch (error) {
      console.error("Error checking registration:", error);
      return false;
    }
  }
};

export const projectService = {
  async getAllProjects(queries: string[] = []) {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        PROJECTS_COLLECTION_ID,
        queries
      );
      return response.documents as unknown as Project[];
    } catch (error) {
      console.error("Error fetching projects:", error);
      throw error;
    }
  },

  async getProjectById(projectId: string) {
    try {
      const response = await databases.getDocument(
        DATABASE_ID,
        PROJECTS_COLLECTION_ID,
        projectId
      );
      return response as unknown as Project;
    } catch (error) {
      console.error("Error fetching project:", error);
      throw error;
    }
  },

  async getProjectsByCategory(category: string) {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        PROJECTS_COLLECTION_ID,
        [Query.equal("category", category)]
      );
      return response.documents as unknown as Project[];
    } catch (error) {
      console.error("Error fetching projects by category:", error);
      throw error;
    }
  },

  async getFeaturedProjects() {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        PROJECTS_COLLECTION_ID,
        [Query.equal("isFeatured", true)]
      );
      return response.documents as unknown as Project[];
    } catch (error) {
      console.error("Error fetching featured projects:", error);
      throw error;
    }
  },

  async createProject(
    projectData: Omit<Project, "$id" | "$createdAt" | "$updatedAt">
  ) {
    try {
      const response = await databases.createDocument(
        DATABASE_ID,
        PROJECTS_COLLECTION_ID,
        ID.unique(),
        projectData
      );
      return response as unknown as Project;
    } catch (error) {
      console.error("Error creating project:", error);
      throw error;
    }
  },

  async updateProject(projectId: string, projectData: Partial<Project>) {
    try {
      const response = await databases.updateDocument(
        DATABASE_ID,
        PROJECTS_COLLECTION_ID,
        projectId,
        projectData
      );
      return response as unknown as Project;
    } catch (error) {
      console.error("Error updating project:", error);
      throw error;
    }
  },

  async deleteProject(projectId: string) {
    try {
      await databases.deleteDocument(
        DATABASE_ID,
        PROJECTS_COLLECTION_ID,
        projectId
      );
      return true;
    } catch (error) {
      console.error("Error deleting project:", error);
      throw error;
    }
  }
};
