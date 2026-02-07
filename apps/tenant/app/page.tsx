import { redirect } from "next/navigation";
import { createClient } from "@/core/database/server";

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // User is authenticated, redirect to dashboard
      redirect("/saas/dashboard");
    } else {
      // User is not authenticated, redirect to sign in
      redirect("/signin");
    }
  } catch (error) {
    // If there's any error (e.g., database connection issues), redirect to signin
    console.error("Error checking authentication:", error);
    redirect("/signin");
  }
}

