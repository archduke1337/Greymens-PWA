import {
  Client,
  Account,
  Databases,
  Storage,
  ID,
  OAuthProvider,
} from "appwrite";

import { logError } from "@/lib/logger";
// lib/appwrite.ts

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

// NOTE: server routes must NOT build admin clients from this module.
// The web `appwrite` SDK no longer accepts API keys (no `setKey`), so
// privileged storage goes through `createServerStorage()` in the
// server-only `lib/appwrite-server.ts` (node-appwrite). See the 4 upload
// routes (blogs/image, gallery, resources, profile).

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

  // GitHub OAuth login (token flow only).
  //
  // Uses Account.createOAuth2Token, which navigates the browser to GitHub —
  // do not redirect manually. Appwrite appends `userId` + `secret` to the
  // success URL, and /auth/success exchanges them via createSession.
  // No OAuth secrets live in frontend code; they stay in the Appwrite Console
  // under Auth > Social providers for this project.
  loginWithGithub() {
    try {
      const successUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/success`
          : "/auth/success";

      const failureUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/failure`
          : "/auth/failure";

      return account.createOAuth2Token({
        provider: OAuthProvider.Github,
        success: successUrl,
        failure: failureUrl,
      });
    } catch (error) {
      logError("GitHub OAuth error:", error);
      throw error;
    }
  },

  // Google OAuth Login
  loginWithGoogle() {
    try {
      const successUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : "/auth/callback";

      const failureUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/login`
          : "/login";

      account.createOAuth2Session({
        provider: OAuthProvider.Google,
        success: successUrl,
        failure: failureUrl,
      });
    } catch (error) {
      logError("Google OAuth error:", error);
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
        (typeof kind === "string" &&
          kind.toLowerCase().includes("unauthorized"))
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

// ---------------------------------------------------------------------------
// First-party session bridge.
//
// The browser SDK authenticates against the Appwrite endpoint directly and,
// on any cross-domain deployment (Vercel app + Cloud backend, and localhost
// under third-party-cookie blocking), the `a_session_*` cookie it receives
// belongs to the API domain — it is never sent to this Next.js app. The SDK
// keeps working through its localStorage `cookieFallback` + `X-Fallback-
// Cookies` header, but plain fetch() calls to our own /api/* routes carry
// neither, so every server route saw an anonymous caller: dashboards bounced
// to login right after a successful login, and authed UI disagreed with the
// server on every screen.
//
// The bridge mirrors the SDK's own session secret into a first-party,
// SameSite=Lax cookie (`gm_session`) that the API routes and proxy.ts read.
// The value is verified against Appwrite on every request (never trusted
// blindly), and it introduces no new exposure class: anything able to read
// it via XSS already owns the localStorage fallback it is copied from.
// ---------------------------------------------------------------------------

/** Name of the first-party session mirror cookie. */
export const SESSION_COOKIE_NAME = "gm_session";

// 30 days, rolling — refreshed on every app load and every 5-minute session
// poll, which also keeps it alive under Safari ITP's 7-day cap on
// script-writable cookies for actively used accounts.
const SESSION_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

/** Session secret the browser SDK keeps in its localStorage fallback. */
export function getBrowserSessionSecret(): string | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

    if (!projectId) return null;
    const raw = window.localStorage.getItem("cookieFallback");

    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const value = parsed[`a_session_${projectId}`];

    return typeof value === "string" && value ? value : null;
  } catch {
    return null;
  }
}

/** Mirror the current session into the first-party cookie (or clear it). */
export function syncSessionCookie(): void {
  try {
    if (typeof document === "undefined") return;
    const secret = getBrowserSessionSecret();

    if (!secret) {
      clearSessionCookie();

      return;
    }
    const secure =
      typeof window !== "undefined" && window.location.protocol === "https:"
        ? "; Secure"
        : "";

    document.cookie =
      `${SESSION_COOKIE_NAME}=${encodeURIComponent(secret)}` +
      `; Path=/; Max-Age=${SESSION_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
  } catch {
    // Best effort: a missing mirror only degrades to anonymous API calls.
  }
}

/** Remove the first-party session mirror (logout, dead session). */
export function clearSessionCookie(): void {
  try {
    if (typeof document === "undefined") return;
    document.cookie = `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
  } catch {
    // Best effort only.
  }
}
