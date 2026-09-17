import { redirect } from "next/navigation";

/**
 * Powers live inside the merged Access console now. Keep the old route as a
 * redirect so bookmarks, audit links, and the sidebar's historical path keep
 * working — and land on the tab that used to be the whole page.
 */
export default function AdminPowersRedirect() {
  redirect("/admin/access?tab=powers");
}
