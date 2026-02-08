import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/core/database";
import { resolveTenant, resolveContext } from "@/core/multi-tenancy/resolver";
import { getSubdomainFromRequest, getTenantIdFromSubdomain } from "@/core/multi-tenancy/subdomain-routing";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: "",
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
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

  // Refresh session if expired - this is critical for Server Components
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // Log auth status for debugging
  if (authError) {
    console.log("[proxy] Auth error:", authError.message);
  }

  // Try subdomain routing first
  const hostname = request.headers.get("host") || "";
  const subdomainInfo = await getSubdomainFromRequest(request.headers);
  
  let tenantResult;
  
  if (subdomainInfo.subdomain) {
    // Try to resolve tenant from subdomain
    const tenantId = await getTenantIdFromSubdomain(subdomainInfo.subdomain);
    if (tenantId) {
      tenantResult = {
        tenant: null, // We don't need full tenant object in proxy
        tenantId,
        source: "subdomain" as const,
      };
    } else {
      // Fall back to regular resolution
      tenantResult = await resolveTenant({
        hostname,
        url: request.url,
        headers: request.headers,
      });
    }
  } else {
    // Resolve tenant from multiple sources (URL param, header, session)
    tenantResult = await resolveTenant({
      hostname,
      url: request.url,
      headers: request.headers,
    });
  }

  // Resolve context (supports both multi-tenant and organization-only modes)
  const context = await resolveContext({
    headers: request.headers,
    url: request.url,
    hostname,
  });

  // Set tenant_id in request headers for downstream use
  if (context.tenantId) {
    request.headers.set("x-tenant-id", context.tenantId);
    response.headers.set("x-tenant-id", context.tenantId);
  }

  // Set organization_id in request headers when available
  if (context.organizationId) {
    request.headers.set("x-organization-id", context.organizationId);
    response.headers.set("x-organization-id", context.organizationId);
  }

  // Set system mode header
  request.headers.set("x-system-mode", context.mode);
  response.headers.set("x-system-mode", context.mode);

  // If user is authenticated but no tenant from resolution, try session
  if (user && !context.tenantId) {
    const userDataResult: { data: { tenant_id: string | null; roles: { name: string } | null } | null; error: any } = await supabase
      .from("users")
      .select("tenant_id, roles:role_id(name)")
      .eq("id", user.id)
      .single();

    const userData = userDataResult.data;
    if (userData?.tenant_id) {
      request.headers.set("x-tenant-id", userData.tenant_id);
      response.headers.set("x-tenant-id", userData.tenant_id);
    } else if (userData?.roles?.name === "Platform Admin") {
      // Platform Admin - set a special header
      request.headers.set("x-user-type", "platform-admin");
      response.headers.set("x-user-type", "platform-admin");
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
