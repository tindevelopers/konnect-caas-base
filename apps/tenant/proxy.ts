import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

const PLATFORM_ONLY_PREFIXES = [
  "/admin",
  "/multi-tenant",
  "/saas/admin/system-admin",
  "/saas/admin/entity/tenant-management",
  "/saas/subscriptions",
  "/saas/webhooks",
];

function isPlatformOnlyPath(pathname: string): boolean {
  return PLATFORM_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isRefreshTokenMissingError(e: unknown): boolean {
  const err = e as { __isAuthError?: boolean; code?: string; message?: string };
  return (
    err?.__isAuthError === true &&
    (err?.code === "refresh_token_not_found" ||
      /refresh token/i.test(err?.message ?? ""))
  );
}

function clearSupabaseAuthCookies(request: NextRequest, response: NextResponse) {
  // Supabase SSR cookies are typically prefixed with `sb-` (and may be chunked).
  // If an access token cookie exists without a refresh token, Supabase throws `refresh_token_not_found`.
  // Clearing these cookies returns the app to a clean "signed out" state.
  for (const c of request.cookies.getAll()) {
    if (!c.name.startsWith("sb-")) continue;
    const options = { path: "/", maxAge: 0 };
    request.cookies.set({ name: c.name, value: "", ...options });
    response.cookies.set({ name: c.name, value: "", ...options });
  }
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requestHeaders = new Headers(request.headers);

  // Check if this is a Builder.io preview request
  const userAgent = request.headers.get("user-agent") || "";
  const referer = request.headers.get("referer") || "";
  const isBuilderPreview = 
    userAgent.includes("Builder.io") || 
    referer.includes("builder.io") ||
    referer.includes("fly.dev") || // Builder.io preview proxy uses fly.dev
    pathname.startsWith("/builder"); // Allow all /builder routes

  // Allow Builder.io preview requests to bypass authentication
  if (isBuilderPreview) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // If a tenant is selected (Platform Admin flow), propagate it as a request header
  const selectedTenantId = request.cookies.get("current_tenant_id")?.value;
  if (selectedTenantId) requestHeaders.set("x-tenant-id", selectedTenantId);

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Refresh Supabase session cookies in middleware (and clear broken auth cookies).
  // This avoids noisy dev overlay logs and ensures server components can read a consistent session state.
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: Record<string, unknown>) {
            request.cookies.set({ name, value, ...options });
            response = NextResponse.next({ request: { headers: requestHeaders } });
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: Record<string, unknown>) {
            request.cookies.set({ name, value: "", ...options });
            response = NextResponse.next({ request: { headers: requestHeaders } });
            response.cookies.set({ name, value: "", ...options });
          },
        },
      }
    );

    try {
      await supabase.auth.getUser();
    } catch (e) {
      if (isRefreshTokenMissingError(e)) {
        clearSupabaseAuthCookies(request, response);
      }
    }
  }

  // Only enforce platform-only checks on platform-only routes
  if (!isPlatformOnlyPath(pathname)) {
    return response;
  }

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: Record<string, unknown>) {
            request.cookies.set({ name, value, ...options });
            response = NextResponse.next({ request: { headers: requestHeaders } });
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: Record<string, unknown>) {
            request.cookies.set({ name, value: "", ...options });
            response = NextResponse.next({ request: { headers: requestHeaders } });
            response.cookies.set({ name, value: "", ...options });
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/signin";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    // Use admin client to bypass RLS when checking Platform Admin status
    // This is necessary because Platform Admins have tenant_id = NULL and RLS might block the query
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      // Fail open: without the service role key we can't verify Platform Admin status here.
      // Don't block the request in local/dev environments.
      console.warn("[proxy] SUPABASE_SERVICE_ROLE_KEY not set; skipping Platform Admin verification");
      return response;
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const userRowResult: {
      data: { tenant_id: string | null; roles?: { name: string } | null } | null;
      error: any;
    } = await (adminClient.from("users") as any)
      .select("tenant_id, roles:role_id(name)")
      .eq("id", user.id)
      .single();

    const userRow = userRowResult.data;
    
    // If query failed or user not found, deny access
    if (userRowResult.error || !userRow) {
      console.error("[proxy] Error checking Platform Admin status:", userRowResult.error);
      const url = request.nextUrl.clone();
      url.pathname = "/saas/dashboard";
      return NextResponse.redirect(url);
    }

    const roleName = (userRow?.roles as any)?.name as string | undefined;
    const isPlatformAdmin = roleName === "Platform Admin" && userRow?.tenant_id === null;

    if (!isPlatformAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/saas/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - builder (Builder.io routes - handled separately)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|builder).*)",
  ],
};
