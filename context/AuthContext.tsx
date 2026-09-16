// context/AuthContext.tsx
"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { authService } from "@/lib/appwrite";
import type { AppwriteUser } from "@/lib/types";

interface AuthContextType {
  user: AppwriteUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: () => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AppwriteUser | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  loginWithGoogle: () => {},
  logout: async () => {},
  refreshUser: async () => null,
});

const SESSION_REFRESH_INTERVAL = 1000 * 60 * 5; // 5 minutes

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppwriteUser | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkUser = useCallback(async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      return currentUser;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      return currentUser;
    } catch {
      setUser(null);
      // Transient failure: keep polling and retry once after 30s instead of
      // clearing the interval forever.
      setTimeout(() => {
        authService.getCurrentUser().then(setUser).catch(() => {});
      }, 30000);
      return null;
    }
  }, []);

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

  const loginWithGoogle = () => {
    authService.loginWithGoogle();
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
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