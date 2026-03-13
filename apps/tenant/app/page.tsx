import { redirect } from "next/navigation";
import { createClient } from "@/core/database/server";
import { headers } from "next/headers";

export const dynamic = 'force-dynamic';

export default async function RootPage() {
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

  // Supabase can throw AuthApiError when a stale/partial session exists (e.g. access token present,
  // refresh token missing). Treat it as unauthenticated and avoid noisy dev overlay logs.
  let user: unknown = null;
  try {
    const result = await supabase.auth.getUser();
    user = result?.data?.user ?? null;
  } catch (e) {
    const err = e as { __isAuthError?: boolean; code?: string; message?: string };
    const isRefreshTokenMissing =
      err?.__isAuthError === true &&
      (err?.code === "refresh_token_not_found" ||
        /refresh token/i.test(err?.message ?? ""));

    if (!isRefreshTokenMissing) {
      console.error("Error checking authentication:", e);
    }
    user = null;
  }

  if (user) {
    redirect("/saas/dashboard");
  }

  redirect("/signin");
}

