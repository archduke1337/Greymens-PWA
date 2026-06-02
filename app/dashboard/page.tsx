'use client';

import { Card, CardContent, Button, Chip } from "@heroui/react";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="text-center space-y-4">
          <div className="inline-block w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-default-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const quickLinks = [
    { label: 'My Profile', href: '/profile', color: 'primary' as const },
    { label: 'Settings', href: '/settings', color: 'secondary' as const },
    { label: 'Events', href: '/events', color: 'success' as const },
    { label: 'Projects', href: '/projects', color: 'warning' as const },
    { label: 'Blog', href: '/Blog', color: 'danger' as const },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">
          Welcome back, <span className="bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">{user.name}</span>
        </h1>
        <p className="text-default-500">Here&apos;s what&apos;s happening with your account.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border border-default-200">
          <CardContent className="text-center py-8">
            <p className="text-3xl font-bold text-primary">{user.emailVerification ? '✓' : '—'}</p>
            <p className="text-sm text-default-500 mt-2">Email Verified</p>
          </CardContent>
        </Card>
        <Card className="border border-default-200">
          <CardContent className="text-center py-8">
            <Chip color="primary" variant="flat">{user.email}</Chip>
            <p className="text-sm text-default-500 mt-2">Account Email</p>
          </CardContent>
        </Card>
        <Card className="border border-default-200">
          <CardContent className="text-center py-8">
            <p className="text-3xl font-bold text-success">Active</p>
            <p className="text-sm text-default-500 mt-2">Account Status</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Quick Links</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card isHoverable className="cursor-pointer border border-default-200 h-full">
                <CardContent className="flex items-center justify-center py-6">
                  <Button color={link.color} variant="light" className="text-sm font-medium">
                    {link.label}
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
