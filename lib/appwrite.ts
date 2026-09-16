// lib/appwrite.ts
import { Client, Account, Databases, Storage, ID, OAuthProvider } from "appwrite";

// Lazy browser client: constructing it at import time throws inside the newer
// SDK when the public endpoint is unset (tests, static prerender without env),
// and no browser call can succeed without configuration anyway. The first real
// use raises the same "incomplete configuration" error the server helper has
// always raised — just later, at the call site instead of at import time.
let browserClient: Client | null = null;

function getBrowserClient(): Client {
  if (!browserClient) {
    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

    if (!endpoint || !projectId) {
      throw new Error("Client Appwrite configuration is incomplete");
    }
    browserClient = new Client().setEndpoint(endpoint).setProject(projectId);
  }
  return browserClient;
}

function getAccount(): Account {
  return new Account(getBrowserClient());
}

function getStorage(): Storage {
  return new Storage(getBrowserClient());
}

function getDatabases(): Databases {
  return new Databases(getBrowserClient());
}

// Backwards-compatible singletons: resolved on first property access rather
// than at import time so importing this module never throws.
export const account: Account = new Proxy({} as Account, {
  get: (_target, property) => {
    const service = getAccount();
    const value = Reflect.get(service, property);

    return typeof value === "function" ? value.bind(service) : value;
  },
});
export const storage: Storage = new Proxy({} as Storage, {
  get: (_target, property) => {
    const service = getStorage();
    const value = Reflect.get(service, property);

    return typeof value === "function" ? value.bind(service) : value;
  },
});
export const databases: Databases = new Proxy({} as Databases, {
  get: (_target, property) => {
    const service = getDatabases();
    const value = Reflect.get(service, property);

    return typeof value === "function" ? value.bind(service) : value;
  },
});
export { ID };

export function createAdminClient() {
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;
  if (!endpoint || !projectId || !apiKey) throw new Error("Server Appwrite configuration is incomplete");
  const adminClient = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  return {
    account: new Account(adminClient),
    databases: new Databases(adminClient),
    storage: new Storage(adminClient),
  };
}

// Single source of truth for Appwrite config
export const APPWRITE_CONFIG = {
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
  // Collections
  projectsCollectionId: "projects",
  eventsCollectionId: "events",
  registrationsCollectionId: "registrations",
  sponsorsCollectionId: "sponsors",
  blogsCollectionId: "blogs",
  profilesCollectionId: "profiles",
  applicationsCollectionId: "applications",
  membershipsCollectionId: "memberships",
  departmentsCollectionId: "departments",
  userDepartmentsCollectionId: "user_departments",
  designationsCollectionId: "designations",
  userDesignationsCollectionId: "user_designations",
  powersCollectionId: "powers",
  userPowersCollectionId: "user_powers",
  eventTypesCollectionId: "event_types",
  eventTypeDataCollectionId: "event_type_data",
  ticketsCollectionId: "tickets",
  ticketVerificationsCollectionId: "ticket_verifications",
  notificationsCollectionId: "notifications",
  auditLogsCollectionId: "audit_logs",
  resourcesCollectionId: "resources",
  approvalWorkflowsCollectionId: "approval_workflows",
  galleryCollectionId: "gallery",
  // Buckets
  eventImagesBucketId: "event-images",
  sponsorLogosBucketId: "sponsor-logos",
  blogImagesBucketId: "blog-images",
  profilePicturesBucketId: "profile-pictures",
  galleryImagesBucketId: "gallery-images",
};
export const authService = {
  // Create a new account
  async createAccount(email: string, password: string, name: string) {
    try {
      const userAccount = await account.create({
        userId: ID.unique(),
        email,
        password,
        name,
      });
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
      return await account.createEmailPasswordSession({ email, password });
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

      account.createOAuth2Session({
        provider: OAuthProvider.Google,
        success: successUrl,
        failure: failureUrl,
      });
    } catch (error) {
      console.error("Google OAuth error:", error);
      throw error;
    }
  },

  // Get current user.
  //
  // A missing session (401) resolves to null. Anything else — network failure,
  // misconfiguration — rethrows so callers can tell "logged out" apart from
  // "unknown" and preserve last-good state instead of flashing logged-out.
  async getCurrentUser() {
    try {
      return await account.get();
    } catch (error) {
      const code = (error as { code?: unknown })?.code;
      const kind = (error as { type?: unknown })?.type;

      if (
        code === 401 ||
        (typeof kind === "string" && kind.toLowerCase().includes("unauthorized"))
      ) {
        return null;
      }
      throw error;
    }
  },

  // Logout
  async logout() {
    try {
      return await account.deleteSession({ sessionId: "current" });
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
      return await account.updatePhoneVerification({ userId, secret });
    } catch (error) {
      throw error;
    }
  },

  async updatePhone(phone: string, password: string) {
    try {
      return await account.updatePhone({ phone, password });
    } catch (error) {
      throw error;
    }
  },
};
