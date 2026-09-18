"use client";
import { Avatar, AvatarImage, AvatarFallback, Button, Chip, Dropdown, Label, Separator } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, LayoutDashboard, LifeBuoy, LogOut, Settings, ShieldCheck, User } from "lucide-react";

import { siteConfig } from "@/config/site";
import { ADMIN_SECTIONS, sectionMatches } from "@/app/admin/layout";
import { accessiblePages } from "@/lib/governance";
import { ThemeSwitch } from "@/components/theme-switch";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import type { MembershipStatus } from "@/lib/types";

const getAvatarUrl = (name: string) => {
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

// Dashboard + Console live ONLY here. They are deliberately absent from the
// pill nav and the mobile menu: the profile chip is the single home for
// account destinations.
const ACCOUNT_ITEMS = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/profile", label: "Profile", Icon: User },
  { href: "/settings", label: "Settings", Icon: Settings },
  { href: "/help-feedback", label: "Help & Feedback", Icon: LifeBuoy },
] as const;

export const Navbar = () => {
  const { user, loading } = useAuth();
  const { status, hasCapability, profile, capabilities } = usePermissions();
  const avatarSrc = profile?.avatar || (user?.name ? getAvatarUrl(user.name) : undefined);
  const router = useRouter();

  const isAdmin = status === "admin" || status === "dev";
  const seesAdminConsole =
    isAdmin || ADMIN_SECTIONS.some((section) => sectionMatches(hasCapability, section.cap));
  const isLoggedIn = !!user;
  const statusLabel = STATUS_LABELS[status];
  const accessPages = capabilities.includes("*")
    ? []
    : accessiblePages(capabilities).slice(0, 6);

  const go = (key: unknown) => {
    router.push(String(key));
  };

  return (
    <header className="sticky top-3 z-50 flex w-full justify-center px-3 sm:px-4">
      <nav
        aria-label="Primary"
        className="flex w-full max-w-5xl items-center justify-between gap-2 rounded-full border border-default-200/70 bg-background/80 py-2 pl-5 pr-2 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-black/60"
      >
        <Link href="/" className="rounded-full focus-visible:outline-2 focus-visible:outline-accent" aria-label="Greymens Club home">
          <span className="text-[15px] font-bold tracking-[0.22em]">GREYMENS</span>
        </Link>

        {/* Desktop pill links: public pages only. Dashboard/Console are
            profile-chip destinations, never top-level nav. */}
        <div className="hidden items-center gap-0.5 lg:flex">
          {siteConfig.navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3.5 py-2 text-sm text-muted transition-colors hover:bg-surface-secondary hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Mobile menu: public pages + auth only.
              The trigger renders its own button, so the child must be plain
              content — a nested Button here produced <button> inside
              <button>, which broke taps on touch devices. */}
          <div className="lg:hidden">
            <Dropdown>
              <Dropdown.Trigger className="rounded-full px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-secondary hover:text-foreground">
                Menu
              </Dropdown.Trigger>
              <Dropdown.Popover placement="bottom end">
                <Dropdown.Menu aria-label="Navigation menu" onAction={go}>
                  {siteConfig.navItems.map((item) => (
                    <Dropdown.Item key={item.href} id={item.href} textValue={item.label}>
                      <Label>{item.label}</Label>
                    </Dropdown.Item>
                  ))}
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
                    <Avatar className="h-9 w-9 border border-default-200 transition-transform">
                      <AvatarImage src={avatarSrc} alt={user.name} />
                      <AvatarFallback>{user.name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                  </Dropdown.Trigger>
                  <Dropdown.Popover className="min-w-[250px]" placement="bottom end">
                    <div className="px-3 pb-2 pt-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar size="sm">
                          <AvatarImage src={avatarSrc} alt="" />
                          <AvatarFallback>{user.name?.charAt(0) || "U"}</AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col gap-0">
                          <p className="truncate text-sm font-medium leading-5">{user.name}</p>
                          <p className="truncate text-xs leading-4 text-muted">{user.email}</p>
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
                      {accessPages.map((page) => (
                        <Dropdown.Item key={page.href} id={page.href} textValue={page.label}>
                          <KeyRound className="size-4 shrink-0 text-muted" aria-hidden="true" />
                          <Label>{page.label}</Label>
                        </Dropdown.Item>
                      ))}
                      {seesAdminConsole && (
                        <Dropdown.Item key="/admin" id="/admin" textValue="Console">
                          <ShieldCheck className="size-4 shrink-0 text-muted" aria-hidden="true" />
                          <Label>Console</Label>
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
                  <Button size="sm" className="rounded-full px-5">
                    Login
                  </Button>
                </Link>
              )}
            </>
          )}
        </div>
      </nav>
    </header>
  );
};
