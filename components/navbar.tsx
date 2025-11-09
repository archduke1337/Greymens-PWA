// components/navbar.tsx
"use client";
import {
  Navbar as HeroUINavbar,
  NavbarContent,
  NavbarBrand,
  NavbarItem,
} from "@heroui/navbar";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import { Button } from "@heroui/button";
import { Avatar } from "@heroui/avatar";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

import { siteConfig } from "@/config/site";
import { ThemeSwitch } from "@/components/theme-switch";
import { Logo } from "@/components/icons";
import { useAuth } from "@/context/AuthContext";

export const Navbar = () => {
  const { user, loading, logout } = useAuth();
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

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

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
    <HeroUINavbar maxWidth="xl" position="sticky">
      <NavbarContent justify="start">
        <NavbarBrand as="li" className="gap-3 max-w-fit">
          <NextLink className="flex justify-start items-center gap-1" href="/">
            <Logo />
            <p className="font-bold text-inherit">Mind Mesh</p>
          </NextLink>
        </NavbarBrand>
      </NavbarContent>

      <NavbarContent justify="end">
        <NavbarItem>
          <Dropdown isOpen={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <DropdownTrigger>
              <Button 
                variant="light"
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
        </NavbarItem>
        <NavbarItem>
          <ThemeSwitch />
        </NavbarItem>

        {!loading && (
          <>
            {user ? (
              <NavbarItem>
                <Dropdown placement="bottom-end">
                  <DropdownTrigger>
                    <Avatar
                      isBordered
                      as="button"
                      className="transition-transform"
                      color="primary"
                      name={user.name}
                      size="sm"
                      src={getAvatarUrl(user.name)}
                    />
                  </DropdownTrigger>
                  <DropdownMenu aria-label="Profile Actions" variant="flat">
                    <DropdownItem key="profile" className="h-14 gap-2">
                      <p className="font-semibold">Signed in as</p>
                      <p className="font-semibold">{user.email}</p>
                    </DropdownItem>
                    <DropdownItem key="my-profile" href="/profile">
                      My Profile
                    </DropdownItem>
                    <DropdownItem key="settings" href="/settings">
                      Settings
                    </DropdownItem>
                    <DropdownItem key="logout" color="danger" onPress={handleLogout}>
                      Log Out
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </NavbarItem>
            ) : (
              <NavbarItem>
                <Button as={NextLink} color="primary" href="/login" variant="flat">
                  Login
                </Button>
              </NavbarItem>
            )}
          </>
        )}
      </NavbarContent>
    </HeroUINavbar>
  );
};