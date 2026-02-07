import { NextResponse } from "next/server";
import { getTenantForCrm } from "@/app/actions/crm/tenant-helper";
import { createAdminClient } from "@/core/database/admin-client";
import { createClient } from "@/core/database/server";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function GET() {
  try {
    // Test 0: Check auth status
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    // Test 1: Try to get tenant for CRM
    let tenantId: string | null = null;
    let error: string | null = null;
    
    try {
      tenantId = await getTenantForCrm();
    } catch (e: any) {
      error = e.message;
    }

    // Test 2: Direct tenant query with admin client
    const adminClient = createAdminClient();
    const { data: tenants, error: tenantsError } = await (adminClient.from("tenants") as any)
      .select("id, name, domain, status")
      .order("created_at", { ascending: true })
      .limit(10);

    // Test 3: Get user data if authenticated
    let userData = null;
    if (user) {
      const { data: ud } = await (adminClient.from("users") as any)
        .select("id, email, role_id, tenant_id, roles:role_id(name)")
        .eq("id", user.id)
        .single();
      userData = ud;
    }

    return NextResponse.json({
      success: true,
      auth: {
        authenticated: !!user,
        userId: user?.id || null,
        email: user?.email || null,
        authError: authError?.message || null,
      },
      userData: userData,
      tenantForCrm: tenantId,
      tenantError: error,
      directQuery: {
        tenants: tenants || [],
        error: tenantsError ? {
          code: tenantsError.code,
          message: tenantsError.message,
          details: tenantsError.details,
        } : null,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
