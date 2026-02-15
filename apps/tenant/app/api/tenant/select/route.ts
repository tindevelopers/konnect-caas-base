/**
 * Set the current tenant context cookie for server-side operations.
 * Called when a user selects a tenant from the TenantSwitcher.
 * Validates access before setting the cookie.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/database/server";
import { createAdminClient } from "@/core/database/admin-client";
import { isPlatformAdmin } from "@/app/actions/organization-admins";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const tenantId = typeof body?.tenantId === "string" ? body.tenantId.trim() : null;

    if (!tenantId) {
      return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Verify tenant exists
    const { data: tenant, error: tenantError } = await adminClient
      .from("tenants")
      .select("id")
      .eq("id", tenantId)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Check access: Platform Admin or user's tenant_id matches
    const adminStatus = await isPlatformAdmin();
    if (!adminStatus) {
      // Supabase generated types can infer `never` for json/unknown schemas.
      // Use an explicit cast to avoid TS failing builds when the `users` table
      // isn't represented in the local type map.
      const { data: userRow } = await (adminClient.from("users") as any)
        .select("tenant_id")
        .eq("id", user.id)
        .single();
      const resolvedTenantId =
        userRow && typeof userRow.tenant_id === "string" ? (userRow.tenant_id as string) : null;

      if (!resolvedTenantId || resolvedTenantId !== tenantId) {
        return NextResponse.json({ error: "Access denied to this tenant" }, { status: 403 });
      }
    }

    const response = NextResponse.json({ ok: true, tenantId });
    response.cookies.set({
      name: "current_tenant_id",
      value: tenantId,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    console.error("[tenant/select] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to set tenant" },
      { status: 500 }
    );
  }
}
