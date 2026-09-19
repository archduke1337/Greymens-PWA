import { redirect } from "next/navigation";

/**
 * Offices live inside the merged Access console now. Keep the old route as a
 * redirect so bookmarks and audit links keep working — and land on the tab
 * that manages office assignments.
 */
export default function AdminOfficesRedirect() {
  redirect("/admin/access?tab=offices");
}
