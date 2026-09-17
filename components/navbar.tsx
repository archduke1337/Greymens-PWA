"use client";
import { Avatar, AvatarImage, AvatarFallback, Button, Chip, Dropdown, Label, Separator } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutDashboard, LifeBuoy, LogOut, Settings, ShieldCheck, User } from "lucide-react";

import { siteConfig } from "@/config/site";
import { ADMIN_SECTIONS, sectionMatches } from "@/app/admin/layout";
import { ThemeSwitch } from "@/components/theme-switch";
import { Logo } from "@/components/icons";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import type { MembershipStatus } from "@/lib/types";

const getAvatarUrl = (name: string) => {
  // No background=random: a random background refetches a different avatar on
  // every render and flashes. ui-avatars derives a stable color from the name.
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`;
};

const STATUS_LABELS: Partial<Record<MembershipStatus, string>> = {
  applicant: "Applicant",
  member: "Member",
  core_member: "Core Member",
  lead: "Lead",
  head: "Head",
  admin: "Admin",
  dev: "Dev",
};

// Account-scoped destinations. Dashboard intentionally lives here AND in the
// top-level nav: the nav link is primary navigation, this one keeps the menu
// self-sufficient on mobile where the nav links hide behind "Menu".
const ACCOUNT_ITEMS = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/profile", label: "Profile", Icon: User },
  { href: "/settings", label: "Settings", Icon: Settings },
  { href: "/help-feedback", label: "Help & Feedback", Icon: LifeBuoy },
] as const;

export const Navbar = () => {
  const { user, loading } = useAuth();
  const { status, hasCapability, profile } = usePermissions();
  // Uploaded picture wins; the generated initial-avatar is only a fallback
  // for accounts that never uploaded one.
  const avatarSrc = profile?.avatar || (user?.name ? getAvatarUrl(user.name) : undefined);
  const router = useRouter();

  const isAdmin = status === "admin" || status === "dev";
  // Office holders (blog reviewers, event managers, ...) are admitted to the
  // console by the admin layout for their sections, so they get the link too.
  // Bootstrap ADMIN_EMAILS admins without a governance row are the exception:
  // they reach the console via direct URL until grant-admin runs.
  const seesAdminConsole =
    isAdmin || ADMIN_SECTIONS.some((section) => sectionMatches(hasCapability, section.cap));
  const isLoggedIn = !!user;
  const statusLabel = STATUS_LABELS[status];

  const go = (key: unknown) => {
    router.push(String(key));
  };

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
            <Dropdown.Trigger>
              <Button variant="ghost">Menu</Button>
            </Dropdown.Trigger>
            <Dropdown.Popover>
              <Dropdown.Menu aria-label="Navigation menu" onAction={go}>
                {siteConfig.navItems.map((item) => (
                  <Dropdown.Item key={item.href} id={item.href} textValue={item.label}>
                    <Label>{item.label}</Label>
                  </Dropdown.Item>
                ))}
                {isLoggedIn && (
                  <Dropdown.Item key="account-dashboard" id="/dashboard" textValue="Dashboard">
                    <Label>Dashboard</Label>
                  </Dropdown.Item>
                )}
                {seesAdminConsole && (
                  <Dropdown.Item key="account-admin" id="/admin" textValue="Admin">
                    <Label>Admin</Label>
                  </Dropdown.Item>
                )}
                {isLoggedIn ? (
                  <Dropdown.Item key="account-logout" id="/logout" textValue="Logout" variant="danger">
                    <Label>Logout</Label>
                  </Dropdown.Item>
                ) : (
                  <Dropdown.Item key="account-login" id="/login" textValue="Login">
                    <Label>Login</Label>
                  </Dropdown.Item>
                )}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>

        <ThemeSwitch />

        {!loading && user && <NotificationBell />}

        {!loading && (
          <>
            {user ? (
              <Dropdown>
                <Dropdown.Trigger
                  aria-label={`Account menu for ${user.name}`}
                  className="rounded-full"
                >
                  <Avatar className="transition-transform border-2 border-default-300 w-8 h-8">
                    <AvatarImage src={avatarSrc} alt={user.name} />
                    <AvatarFallback>{user.name?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                </Dropdown.Trigger>
                <Dropdown.Popover className="min-w-[240px]">
                  <div className="px-3 pt-3 pb-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar size="sm">
                        <AvatarImage src={avatarSrc} alt="" />
                        <AvatarFallback>{user.name?.charAt(0) || "U"}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col gap-0 min-w-0">
                        <p className="text-sm leading-5 font-medium truncate">{user.name}</p>
                        <p className="text-xs leading-4 text-muted truncate">{user.email}</p>
                      </div>
                      {statusLabel && (
                        <Chip size="sm" variant="soft" className="ms-auto shrink-0">
                          {statusLabel}
                        </Chip>
                      )}
                    </div>
                  </div>
                  <Dropdown.Menu aria-label="Account" onAction={go}>
                    {ACCOUNT_ITEMS.map(({ href, label, Icon }) => (
                      <Dropdown.Item key={href} id={href} textValue={label}>
                        <Icon className="size-4 shrink-0 text-muted" aria-hidden="true" />
                        <Label>{label}</Label>
                      </Dropdown.Item>
                    ))}
                    {seesAdminConsole && (
                      <Dropdown.Item key="/admin" id="/admin" textValue="Admin Panel">
                        <ShieldCheck className="size-4 shrink-0 text-muted" aria-hidden="true" />
                        <Label>Admin Panel</Label>
                      </Dropdown.Item>
                    )}
                    <Separator />
                    <Dropdown.Item key="/logout" id="/logout" textValue="Logout" variant="danger">
                      <LogOut className="size-4 shrink-0" aria-hidden="true" />
                      <Label>Logout</Label>
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown.Popover>
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
