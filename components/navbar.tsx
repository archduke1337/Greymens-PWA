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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Generate avatar from user's name
  const getAvatarUrl = (name: string) => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
  };

  const handleMouseEnter = () => {
    if (!isMobile) {
      setIsMenuOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile) {
      setIsMenuOpen(false);
    }
  };

  return (
    <nav className="sticky top-0 z-40 w-full flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur-md border-b border-default-100">
      <NextLink className="flex items-center gap-2" href="/">
        <Logo />
        <p className="font-bold text-inherit">Mind Mesh</p>
      </NextLink>

      <div className="flex items-center gap-2">
        <Dropdown isOpen={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <DropdownTrigger>
            <Button
              variant="ghost"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              Menu
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="Navigation menu"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {siteConfig.navItems.map((item) => (
              <DropdownItem key={item.href} href={item.href}>
                {item.label}
              </DropdownItem>
            ))}
          </DropdownMenu>
        </Dropdown>

        <ThemeSwitch />

        {!loading && (
          <>
            {user ? (
              <Dropdown placement="bottom-end">
                <DropdownTrigger>
                  <Avatar
                    className="transition-transform border-2 border-default-300 w-8 h-8"
                  >
                    <AvatarImage src={getAvatarUrl(user.name)} alt={user.name} />
                    <AvatarFallback>{user.name?.charAt(0) || 'U'}</AvatarFallback>
                  </Avatar>
                </DropdownTrigger>
                <DropdownMenu aria-label="Profile Actions">
                  <DropdownItem key="profile" className="h-14 gap-2">
                    <p className="font-semibold">Signed in as</p>
                    <p className="font-semibold">{user.email}</p>
                  </DropdownItem>
                  <DropdownItem key="dashboard" href="/dashboard">
                    Dashboard
                  </DropdownItem>
                  <DropdownItem key="my-profile" href="/profile">
                    My Profile
                  </DropdownItem>
                  <DropdownItem key="settings" href="/settings">
                    Settings
                  </DropdownItem>
                  <DropdownItem key="help-feedback" href="/help-feedback">
                    Help & Feedback
                  </DropdownItem>
                  <DropdownItem key="logout" color="danger" href="/logout">
                    Log Out
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            ) : (
              <a href="/login">
                <Button variant="primary">
                  Login
                </Button>
              </a>
            )}
          </>
        )}
      </div>
    </nav>
  );
};