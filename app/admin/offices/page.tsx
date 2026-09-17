import { redirect } from "next/navigation";

export default function AdminOfficesRedirect() {
  redirect("/admin/positions");
}
