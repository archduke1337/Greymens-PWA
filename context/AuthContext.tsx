// context/AuthContext.tsx
"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Models } from "appwrite";
import { authService } from "@/lib/appwrite";

interface AuthContextType {
  user: Models.User<Models.Preferences> | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: () => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  loginWithGoogle: () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

const SESSION_REFRESH_INTERVAL = 1000 * 60 * 5; // 5 minutes

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
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
    } catch {
      setUser(null);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
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
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};