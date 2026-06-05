"use client";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Button, Avatar, AvatarImage, AvatarFallback } from "@heroui/react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

import { siteConfig } from "@/config/site";
import { ThemeSwitch } from "@/components/theme-switch";
import { Logo } from "@/components/icons";
import { useAuth } from "@/context/AuthContext";

export const Navbar = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const getAvatarUrl = (name: string) => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
  };

  return (
    <nav className="sticky top-0 z-40 w-full flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur-md border-b border-default-100">
      <NextLink className="flex items-center gap-2" href="/">
        <Logo />
        <p className="font-bold text-inherit">Mind Mesh</p>
      </NextLink>

      {/* Desktop nav links */}
      {!isMobile && (
        <div className="hidden md:flex items-center gap-1">
          {siteConfig.navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="px-3 py-2 text-sm font-medium text-default-600 hover:text-primary transition-colors rounded-lg hover:bg-default-100"
            >
              {item.label}
            </a>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        {/* Mobile menu dropdown */}
        {isMobile && (
          <Dropdown>
            <DropdownTrigger>
              <Button variant="ghost">Menu</Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Navigation menu">
              {siteConfig.navItems.map((item) => (
                <DropdownItem key={item.href} textValue={item.label}>
                  <a href={item.href}>{item.label}</a>
                </DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
        )}

        <ThemeSwitch />

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
                <DropdownMenu aria-label="Profile Actions">
                  <DropdownItem key="profile" className="h-14 gap-2">
                    <p className="font-semibold">Signed in as</p>
                    <p className="font-semibold">{user.email}</p>
                  </DropdownItem>
                  {siteConfig.navMenuItems.map((item) => (
                    <DropdownItem key={item.href}>
                      <a href={item.href} className={item.href === "/logout" ? "text-danger" : ""}>
                        {item.label}
                      </a>
                    </DropdownItem>
                  ))}
                </DropdownMenu>
              </Dropdown>
            ) : (
              <a href="/login">
                <Button variant="primary">Login</Button>
              </a>
            )}
          </>
        )}
      </div>
    </nav>
  );
};