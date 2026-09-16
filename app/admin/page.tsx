import type { Metadata } from "next";

import AdminDashboard from "@/components/dashboards/AdminDashboard";

export const metadata: Metadata = {
  title: "Admin · Greymens",
  description: "Club administration: membership, events, people, and audit.",
};

/**
 * The admin landing page.
 *
 * `app/admin/layout.tsx` has always linked its first sidebar entry to `/admin`,
 * and the navbar for administrators links there too — but no page existed at
 * that path, so the most prominent link in the whole admin console answered
 * with a 404.
 *
 * The page itself reads nothing privileged: it renders the same view model the
 * member dashboard uses, and every figure inside it arrives through a
 * capability-gated API route. Access control is enforced by the admin layout
 * (which redirects anonymous visitors to the login page and non-administrators
 * to `/unauthorized`) and, more importantly, by those API routes — this page
 * cannot be the boundary because a client component cannot be trusted with one.
 */
export default function AdminLandingPage() {
  return <AdminDashboard />;
}
