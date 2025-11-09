"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Not logged in → go to login
        router.push("/login");
        return;
      }

      // 🧠 Simple Admin Check — customize this
      const adminEmails = ["sahilmanecode@gmail.com", "mane50205@gmail.com"];
      const userIsAdmin = adminEmails.includes(user.email);

      if (!userIsAdmin) {
        router.push("/unauthorized"); // Create a simple unauthorized page
        return;
      }

      setIsAdmin(true);
    }
  }, [user, loading, router]);

  if (loading || isAdmin === null) {
    return <div className="flex items-center justify-center min-h-screen text-lg">Loading...</div>;
  }

  return <>{children}</>;
}
