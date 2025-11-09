// lib/appwrite.ts
import { Client, Account, Databases, Storage, ID } from "appwrite";

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

export const account = new Account(client);
export const storage = new Storage(client);
export const databases = new Databases(client);

// Export configuration
export const APPWRITE_CONFIG = {
  endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!,
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!,
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
  projectsCollectionId: "projects", // Make sure this matches your Appwrite collection ID
  eventsCollectionId: "events",
  registrationsCollectionId: "registrations",
  bucketId: process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID!,
};

export { ID };

// Auth service functions
export const authService = {
  // Create a new account
  async createAccount(email: string, password: string, name: string) {
    try {
      const userAccount = await account.create(ID.unique(), email, password, name);
      if (userAccount) {
        return this.login(email, password);
      }
      return userAccount;
    } catch (error) {
      throw error;
    }
  },

  // Login
  async login(email: string, password: string) {
    try {
      return await (account as any).createEmailPasswordSession(email, password);
    } catch (error) {
      throw error;
    }
  },

  // Google OAuth Login
  loginWithGoogle() {
    try {
      const successUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/auth/callback`
        : '/auth/callback';
      
      const failureUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/login`
        : '/login';

      account.createOAuth2Session(
        "google" as any,
        successUrl,
        failureUrl
      );
    } catch (error) {
      console.error("Google OAuth error:", error);
      throw error;
    }
  },

  // Get current user
  async getCurrentUser() {
    try {
      return await account.get();
    } catch (error) {
      return null;
    }
  },

  // Logout
  async logout() {
    try {
      return await account.deleteSession("current");
    } catch (error) {
      throw error;
    }
  },

  // Phone verification
  async createPhoneVerification() {
    try {
      return await account.createPhoneVerification();
    } catch (error) {
      throw error;
    }
  },

  async updatePhoneVerification(userId: string, secret: string) {
    try {
      return await account.updatePhoneVerification(userId, secret);
    } catch (error) {
      throw error;
    }
  },

  async updatePhone(phone: string, password: string) {
    try {
      return await account.updatePhone(phone, password);
    } catch (error) {
      throw error;
    }
  },
};