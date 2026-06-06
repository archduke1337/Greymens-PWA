"use client";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

const ADMIN_SECTIONS = [
  { label: "Dashboard", href: "/admin", icon: "📊" },
  { label: "Membership", href: "/admin/membership", icon: "👥" },
  { label: "Events", href: "/admin/events", icon: "🎯" },
  { label: "Users", href: "/admin/users", icon: "👤" },
  { label: "Departments", href: "/admin/departments", icon: "🏢" },
  { label: "Designations", href: "/admin/designations", icon: "🏅" },
  { label: "Powers", href: "/admin/powers", icon: "⚡" },
  { label: "Blogs", href: "/admin/blog", icon: "📝" },
  { label: "Projects", href: "/admin/projects", icon: "🚀" },
  { label: "Sponsors", href: "/admin/sponsors", icon: "🤝" },
  { label: "Audit Log", href: "/admin/audit", icon: "📋" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const { status } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
        return;
      }

      // Check admin status via permission context or email fallback
      if (status === "admin" || status === "dev") {
        setIsAdmin(true);
        return;
      }

      // Fallback to API check
      fetch("/api/admin-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (!data.isAdmin) {
            router.push("/unauthorized");
          } else {
            setIsAdmin(true);
          }
        })
        .catch(() => {
          router.push("/unauthorized");
        });
    }
  }, [user, loading, router, status]);

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

  return (
    <div className="flex min-h-screen">
      {/* Admin Sidebar */}
      <aside className="w-64 bg-card border-r border-border p-4 hidden lg:block">
        <div className="mb-6">
          <h2 className="text-lg font-bold">Admin Panel</h2>
          <p className="text-sm text-muted-foreground">Club Management</p>
        </div>
        <nav className="space-y-1">
          {ADMIN_SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname === section.href
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span>{section.icon}</span>
              <span>{section.label}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-6 pt-6 border-t border-border">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <span>←</span>
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
