"use client";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Button, Avatar, AvatarImage, AvatarFallback } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { siteConfig } from "@/config/site";
import { ADMIN_SECTIONS } from "@/app/admin/layout";
import { ThemeSwitch } from "@/components/theme-switch";
import { Logo } from "@/components/icons";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";

const getAvatarUrl = (name: string) => {
  // No background=random: a random background refetches a different avatar on
  // every render and flashes. ui-avatars derives a stable color from the name.
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`;
};

export const Navbar = () => {
  const { user, loading } = useAuth();
  const { status, hasPermission } = usePermissions();
  const router = useRouter();

  const isAdmin = status === "admin" || status === "dev";
  // Office holders (blog reviewers, event managers, ...) are admitted to the
  // console by the admin layout for their sections, so they get the link too.
  // Bootstrap ADMIN_EMAILS admins without a governance row are the exception:
  // they reach the console via direct URL until grant-admin runs.
  const seesAdminConsole =
    isAdmin || ADMIN_SECTIONS.some((section) => hasPermission(section.cap));
  const isLoggedIn = !!user;

  return (
    <nav className="sticky top-0 z-40 w-full flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur-md border-b border-default-100">
      <Link className="flex items-center gap-2" href="/">
        <Logo />
        <p className="font-bold text-inherit">Greymens</p>
      </Link>

      {/* Desktop nav links: CSS-gated (no window.innerWidth state) so the
          server render and the first client render agree. */}
      <div className="hidden md:flex items-center gap-1">
        {siteConfig.navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="px-3 py-2 text-sm font-medium text-default-600 hover:text-primary transition-colors rounded-lg hover:bg-default-100"
          >
            {item.label}
          </Link>
        ))}
        {isLoggedIn && (
          <Link
            href="/dashboard"
            className="px-3 py-2 text-sm font-medium text-primary hover:text-primary transition-colors rounded-lg hover:bg-primary/10"
          >
            Dashboard
          </Link>
        )}
        {seesAdminConsole && (
          <Link
            href="/admin"
            className="px-3 py-2 text-sm font-medium text-warning hover:text-warning transition-colors rounded-lg hover:bg-warning/10"
          >
            Admin
          </Link>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Mobile menu dropdown */}
        <div className="md:hidden">
          <Dropdown>
            <DropdownTrigger>
              <Button variant="ghost">Menu</Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Navigation menu"
              onAction={(key) => router.push(String(key))}
            >
              {siteConfig.navItems.map((item) => (
                <DropdownItem key={item.href} textValue={item.label}>
                  {item.label}
                </DropdownItem>
              ))}
              {isLoggedIn && (
                <DropdownItem key="/dashboard" textValue="Dashboard">
                  Dashboard
                </DropdownItem>
              )}
              {seesAdminConsole && (
                <DropdownItem key="/admin" textValue="Admin">
                  Admin
                </DropdownItem>
              )}
            </DropdownMenu>
          </Dropdown>
        </div>

        <ThemeSwitch />

        {!loading && user && <NotificationBell />}

        {!loading && (
          <>
            {user ? (
              <Dropdown>
                <DropdownTrigger>
                  <Avatar className="transition-transform border-2 border-default-300 w-8 h-8">
                    <AvatarImage src={getAvatarUrl(user.name)} alt={user.name} />
                    <AvatarFallback>{user.name?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label="Profile Actions"
                  onAction={(key) => router.push(String(key))}
                >
                  <DropdownItem key="profile" className="h-14 gap-2" textValue={`Signed in as ${user.email}`}>
                    <p className="font-semibold">Signed in as</p>
                    <p className="font-semibold">{user.email}</p>
                  </DropdownItem>
                  {siteConfig.navMenuItems.map((item) => (
                    <DropdownItem key={item.href} textValue={item.label} className={item.href === "/logout" ? "text-danger" : ""}>
                      {item.label}
                    </DropdownItem>
                  ))}
                  {seesAdminConsole && (
                    <DropdownItem key="/admin" textValue="Admin Panel" className="text-warning">
                      Admin Panel
                    </DropdownItem>
                  )}
                </DropdownMenu>
              </Dropdown>
            ) : (
              <Link href="/login">
                <Button variant="primary">Login</Button>
              </Link>
            )}
          </>
        )}
      </div>
    </nav>
  );
};