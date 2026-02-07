import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Admin Dashboard | SaaS Admin",
  description: "Redirecting to SaaS Dashboard",
};

export default function AdminDashboard() {
  redirect("/saas/dashboard");
}
