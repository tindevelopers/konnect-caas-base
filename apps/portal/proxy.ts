import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveContext } from "@/core/multi-tenancy/resolver";

/**
 * Portal Proxy
 * 
 * Simplified proxy for the consumer portal.
 */
export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

  // Resolve tenant/org context from hostname/headers/url (subdomain/header/url-param/session).
  const hostname =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    request.nextUrl.hostname;
  const context = await resolveContext({
    headers: request.headers,
    url: request.url,
    hostname,
  });

  if (context.tenantId) requestHeaders.set("x-tenant-id", context.tenantId);
  if (context.organizationId) requestHeaders.set("x-organization-id", context.organizationId);

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Only set up Supabase client if environment variables are configured
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
            request.cookies.set({
              name,
              value,
              ...options,
            });
            response = NextResponse.next({
              request: {
                headers: requestHeaders,
              },
            });
            response.cookies.set({
              name,
              value,
              ...options,
            });
          },
          remove(name: string, options: Record<string, unknown>) {
            request.cookies.set({
              name,
              value: "",
              ...options,
            });
            response = NextResponse.next({
              request: {
                headers: requestHeaders,
              },
            });
            response.cookies.set({
              name,
              value: "",
              ...options,
            });
          },
        },
      }
    );

    // Refresh session if expired and obtain auth state
    const { data: { user } } = await supabase.auth.getUser();

    // Persist resolved context for client-side tenant branding (public pages)
    if (context.tenantId) {
      response.cookies.set("current_tenant_id", context.tenantId, {
        path: "/",
        sameSite: "lax",
      });
    }

    // Protect authenticated portal areas
    const pathname = request.nextUrl.pathname;
    const isProtected =
      pathname.startsWith("/support");

    if (isProtected && !user) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/sign-in";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    // Prevent cross-tenant access when tenant is resolved from hostname/header
    if (isProtected && user && context.tenantId) {
      const userRowResult: {
        data: { tenant_id: string | null; roles?: { name: string } | null } | null;
        error: any;
      } = await (supabase
        .from("users") as any)
        .select("tenant_id, roles:role_id(name)")
        .eq("id", user.id)
        .single();

      const userRow = userRowResult.data;
      const roleName = (userRow?.roles as any)?.name as string | undefined;

      const isPlatformAdmin =
        roleName === "Platform Admin" && userRow?.tenant_id === null;

      if (!isPlatformAdmin && userRow?.tenant_id && userRow.tenant_id !== context.tenantId) {
        // Logged-in user trying to access another tenant's portal domain
        const url = request.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
