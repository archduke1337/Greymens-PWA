"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Server-side admin emails — loaded from a non-public env var
// Falls back to the hardcoded list for backward compatibility
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "sahilmanecode@gmail.com,mane50205@gmail.com").split(",").map(e => e.trim());

export default function AdminLayout({
  children }: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
        return;
      }

      const userIsAdmin = ADMIN_EMAILS.includes(user.email);

      if (!userIsAdmin) {
        router.push("/unauthorized");
        return;
      }

      setIsAdmin(true);
    }
  }, [user, loading, router]);

  if (loading || isAdmin === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="inline-block w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-default-500">Verifying access...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
