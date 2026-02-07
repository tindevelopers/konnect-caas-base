import { NextResponse } from "next/server";
import { createClient } from "@/core/database/server";
import { createAdminClient } from "@/core/database/admin-client";
import { isPlatformAdmin } from "@/app/actions/organization-admins";
import { getUserPermissions } from "@/core/permissions/permissions";

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
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated", authenticated: false },
        { status: 401 }
      );
    }

    // Get user details
    const adminClient = createAdminClient();
    const { data: userData, error: userError } = await (adminClient.from("users") as any)
      .select("id, email, full_name, tenant_id, role_id, roles:role_id(name)")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        {
          authenticated: true,
          userId: user.id,
          email: user.email,
          error: `Failed to fetch user data: ${userError?.message || "User not found"}`,
        },
        { status: 200 }
      );
    }

    const role = (userData.roles as any)?.name;
    const tenantId = userData.tenant_id;
    const isAdmin = role === "Platform Admin" && tenantId === null;

    // Check permissions
    const permissions = await getUserPermissions(user.id);

    return NextResponse.json({
      authenticated: true,
      userId: user.id,
      email: user.email,
      fullName: userData.full_name,
      role: role || "Unknown",
      tenantId: tenantId,
      isPlatformAdmin: isAdmin,
      permissions: {
        hasTenantsWrite: permissions.isPlatformAdmin || permissions.permissions.includes("tenants.write"),
        allPermissions: permissions.permissions,
        isPlatformAdmin: permissions.isPlatformAdmin,
      },
    });
  } catch (error: any) {
    console.error("[check-platform-admin] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check platform admin status" },
      { status: 500 }
    );
  }
}
