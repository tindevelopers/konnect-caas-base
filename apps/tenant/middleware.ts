import { createServerClient } from "@supabase/ssr";
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

export async function middleware(request: NextRequest) {
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

    const userRowResult: {
      data: { tenant_id: string | null; roles?: { name: string } | null } | null;
      error: any;
    } = await (supabase.from("users") as any)
      .select("tenant_id, roles:role_id(name)")
      .eq("id", user.id)
      .single();

    const userRow = userRowResult.data;
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

