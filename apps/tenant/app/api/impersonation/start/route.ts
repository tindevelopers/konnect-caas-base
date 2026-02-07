import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/database/server";
import { createAdminClient } from "@/core/database/admin-client";
import { isPlatformAdmin } from "@/app/actions/organization-admins";
import { logPermissionCheck } from "@/core/auth/audit-log";

type StartImpersonationPayload = {
  tenantId?: string;
  reason?: string;
};

export async function POST(request: NextRequest) {
  let payload: StartImpersonationPayload = {};
  try {
    payload = (await request.json()) as StartImpersonationPayload;
  } catch {
    payload = {};
  }

  const tenantId = typeof payload.tenantId === "string" ? payload.tenantId.trim() : "";
  const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const adminStatus = await isPlatformAdmin();
  if (!adminStatus) {
    await logPermissionCheck({
      userId: user.id,
      tenantId,
      action: "impersonation_start",
      resource: "tenant",
      permission: "impersonation.switch",
      allowed: false,
      reason: "not_platform_admin",
      metadata: { requestedTenantId: tenantId },
    });
    return NextResponse.json(
      { error: "Only Platform Admins can impersonate tenants." },
      { status: 403 }
    );
  }

  const adminClient = createAdminClient();
  const { data: tenant, error: tenantError } = await adminClient
    .from("tenants")
    .select("id")
    .eq("id", tenantId)
    .single();

  if (tenantError || !tenant) {
    await logPermissionCheck({
      userId: user.id,
      tenantId,
      action: "impersonation_start",
      resource: "tenant",
      permission: "impersonation.switch",
      allowed: false,
      reason: "tenant_not_found",
      metadata: { requestedTenantId: tenantId },
    });
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const previousTenantId = request.cookies.get("current_tenant_id")?.value || null;
  const response = NextResponse.json({ ok: true, tenantId });
  response.cookies.set({
    name: "current_tenant_id",
    value: tenantId,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });

  await logPermissionCheck({
    userId: user.id,
    tenantId,
    action: "impersonation_start",
    resource: "tenant",
    permission: "impersonation.switch",
    allowed: true,
    reason,
    metadata: { selectedTenantId: tenantId, previousTenantId },
  });

  return response;
}
