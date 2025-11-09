// lib/database.ts
import { ID, Query } from "appwrite";
import { databases, storage } from "./appwrite";

// Database and Collection IDs
export const DATABASE_ID = "68ee09da002cce9f7e39";
export const EVENTS_COLLECTION_ID = "events";
export const REGISTRATIONS_COLLECTION_ID = "registrations";
export const PROJECTS_COLLECTION_ID = "projects";
export const EVENT_IMAGES_BUCKET_ID = "REDACTED_BUCKET_ID";

// Event Interface - status is optional
export interface Event {
  $id?: string;
  title: string;
  description: string;
  image: string;
  date: string;
  time: string;
  venue: string;
  location: string;
  category: string;
  price: number;
  discountPrice: number | null;
  capacity: number;
  registered: number;
  organizerName: string;
  organizerAvatar: string;
  tags: string[];
  isFeatured: boolean;
  isPremium: boolean;
  status?: string; // Made optional
  $createdAt?: string;
  $updatedAt?: string;
}

// Registration Interface - status is optional
export interface Registration {
  $id?: string;
  eventId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  registeredAt: string;
  status?: string; // Made optional
  $createdAt?: string;
  $updatedAt?: string;
}

// Project Interface
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

// Event Service - COMPLETE with all missing methods
export const eventService = {
  // Get all events
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

  // Get upcoming events (filter by date instead of status)
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
      
      console.log('📋 Loaded events from database:', response.documents.length);
      return response.documents as unknown as Event[];
    } catch (error) {
      console.error("Error fetching upcoming events:", error);
      throw error;
    }
  },

  // Get event by ID
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

  // Create event - Remove status if it doesn't exist in collection
  async createEvent(eventData: Omit<Event, '$id' | '$createdAt' | '$updatedAt'>) {
    try {
      // Create a copy without status if your collection doesn't have it
      const { status, ...dataWithoutStatus } = eventData;
      
      const response = await databases.createDocument(
        DATABASE_ID,
        EVENTS_COLLECTION_ID,
        ID.unique(),
        dataWithoutStatus // Use this if status field doesn't exist
        // eventData // Use this if status field exists
      );
      return response as unknown as Event;
    } catch (error) {
      console.error("Error creating event:", error);
      throw error;
    }
  },

  // Update event
  async updateEvent(eventId: string, eventData: Partial<Event>) {
    try {
      // Remove status from update if it doesn't exist in collection
      const { status, ...dataWithoutStatus } = eventData;
      
      const response = await databases.updateDocument(
        DATABASE_ID,
        EVENTS_COLLECTION_ID,
        eventId,
        dataWithoutStatus // Use this if status field doesn't exist
        // eventData // Use this if status field exists
      );
      return response as unknown as Event;
    } catch (error) {
      console.error("Error updating event:", error);
      throw error;
    }
  },

  // Delete event
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

  // Delete past events
  async deletePastEvents() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await databases.listDocuments(
        DATABASE_ID,
        EVENTS_COLLECTION_ID,
        [Query.lessThan("date", today)]
      );

      const deletePromises = response.documents.map(doc => 
        databases.deleteDocument(DATABASE_ID, EVENTS_COLLECTION_ID, doc.$id)
      );

      await Promise.all(deletePromises);
      return response.documents.length;
    } catch (error) {
      console.error("Error deleting past events:", error);
      throw error;
    }
  },

  // Upload event image
  async uploadEventImage(file: File) {
    try {
      const response = await storage.createFile(
        EVENT_IMAGES_BUCKET_ID,
        ID.unique(),
        file
      );

      console.log("Image uploaded:", response.$id);

      // FIXED: Get file URL properly - getFileView returns URL object
      const fileUrl = storage.getFileView(EVENT_IMAGES_BUCKET_ID, response.$id);
      
      // Convert URL object to string
      const urlString = fileUrl.toString();
      console.log("Image URL:", urlString);
      
      return urlString;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    }
  },

  // Register for event - WITHOUT status field
  async registerForEvent(eventId: string, userId: string, userName: string, userEmail: string) {
    try {
      // Check if already registered
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

      // Get event to check capacity
      const event = await this.getEventById(eventId);
      if (event.capacity && event.registered >= event.capacity) {
        throw new Error("Event is full");
      }

      // Create registration WITHOUT status field
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
          // Removed 'status' field - add it back if you create the attribute in Appwrite
        }
      );

      // Update event registered count
      await this.updateEvent(eventId, {
        registered: event.registered + 1
      });

      return registration as unknown as Registration;
    } catch (error: any) {
      console.error("Error registering for event:", error);
      throw error;
    }
  },

  // Get user registrations
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

  // Check if user is registered for an event
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

// Project Service
export const projectService = {
  // Get all projects
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

  // Get project by ID
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

  // Get projects by category
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

  // Get featured projects
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

  // Create project (Admin only)
  async createProject(projectData: Omit<Project, '$id' | '$createdAt' | '$updatedAt'>) {
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

  // Update project (Admin only)
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

  // Delete project (Admin only)
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
  },
};