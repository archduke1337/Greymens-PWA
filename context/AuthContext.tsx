// context/AuthContext.tsx
"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { authService, clearSessionCookie, syncSessionCookie } from "@/lib/appwrite";
import type { AppwriteUser } from "@/lib/types";

interface AuthContextType {
  user: AppwriteUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AppwriteUser | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  loginWithGoogle: async () => {},
  logout: async () => {},
  refreshUser: async () => null,
});

const SESSION_REFRESH_INTERVAL = 1000 * 60 * 5; // 5 minutes

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppwriteUser | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Single place where account state lands: keeps the first-party session
  // mirror (gm_session) in lockstep so /api/* routes and proxy.ts see the
  // same session the browser SDK holds. A null user always clears it.
  const applyUser = useCallback((next: AppwriteUser | null) => {
    setUser(next);
    if (next) syncSessionCookie();
    else clearSessionCookie();
    return next;
  }, []);

  const checkUser = useCallback(async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      return applyUser(currentUser);
    } catch {
      // Unknown failure (network, outage): getCurrentUser only returns null
      // for a genuinely absent session, so anything thrown here must preserve
      // last-good state instead of flashing the logged-out UI.
      return null;
    } finally {
      setLoading(false);
    }
  }, [applyUser]);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      return applyUser(currentUser);
    } catch {
      // Transient failure: keep polling and retry once after 30s instead of
      // clearing the interval forever. Last-good user is preserved meanwhile.
      setTimeout(() => {
        authService
          .getCurrentUser()
          .then((retryUser) => {
            applyUser(retryUser);
          })
          .catch(() => {});
      }, 30000);
      return null;
    }
  }, [applyUser]);

  useEffect(() => {
    checkUser();
  }, [checkUser]);

  useEffect(() => {
    if (user) {
      intervalRef.current = setInterval(refreshUser, SESSION_REFRESH_INTERVAL);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user, refreshUser]);

  const login = async (email: string, password: string) => {
    await authService.login(email, password);
    await checkUser();
  };

  const register = async (email: string, password: string, name: string) => {
    await authService.createAccount(email, password, name);
    await checkUser();
  };

  const loginWithGoogle = async () => {
    // Awaited so OAuth bootstrap failures surface to the caller instead of
    // escaping as unhandled rejections. Success redirects away via Appwrite.
    await authService.loginWithGoogle();
  };

  const logout = async () => {
    await authService.logout();
    applyUser(null);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    // Best-effort cache + service-worker cleanup on successful logout.
    // Must never throw or block the redirect.
    try {
      if (typeof caches !== "undefined" && caches.keys) {
        const keys = await caches.keys().catch(() => [] as string[]);
        await Promise.all(
          (keys || []).map((key) => caches.delete(key).catch(() => false)),
        );
      }
    } catch {
      // ignore — best effort only
    }
    try {
      const registrations = await navigator.serviceWorker
        ?.getRegistrations()
        .catch(() => [] as ServiceWorkerRegistration[]);
      if (registrations) {
        await Promise.all(
          registrations.map((registration) =>
            registration.unregister().catch(() => false),
          ),
        );
      }
    } catch {
      // ignore — best effort only
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};