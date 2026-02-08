import { redirect } from "next/navigation";
import { createClient } from "@/core/database/server";
import { headers } from "next/headers";

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  try {
    // Check if this is a Builder.io preview request
    const headersList = await headers();
    const userAgent = headersList.get("user-agent") || "";
    const referer = headersList.get("referer") || "";
    const isBuilderPreview = 
      userAgent.includes("Builder.io") || 
      referer.includes("builder.io") ||
      referer.includes("fly.dev"); // Builder.io preview proxy uses fly.dev

    // Allow Builder.io preview requests to access the root page
    if (isBuilderPreview) {
      // Return a simple page that Builder.io can preview
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Welcome</h1>
            <p className="text-gray-600">This is the root page. Create Builder.io content for this path.</p>
          </div>
        </div>
      );
    }

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

