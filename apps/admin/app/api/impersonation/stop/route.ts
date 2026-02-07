import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/database/server";
import { isPlatformAdmin } from "@/app/actions/organization-admins";
import { logPermissionCheck } from "@/core/auth/audit-log";

type StopImpersonationPayload = {
  reason?: string;
};

export async function POST(request: NextRequest) {
  let payload: StopImpersonationPayload = {};
  try {
    payload = (await request.json()) as StopImpersonationPayload;
  } catch {
    payload = {};
  }

  const reason = typeof payload.reason === "string" ? payload.reason.trim() : null;

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const adminStatus = await isPlatformAdmin();
  const selectedTenantId = request.cookies.get("current_tenant_id")?.value || null;

  if (!adminStatus) {
    await logPermissionCheck({
      userId: user.id,
      tenantId: selectedTenantId,
      action: "impersonation_end",
      resource: "tenant",
      permission: "impersonation.switch",
      allowed: false,
      reason: "not_platform_admin",
      metadata: { selectedTenantId },
    });
    return NextResponse.json(
      { error: "Only Platform Admins can stop impersonation." },
      { status: 403 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: "current_tenant_id",
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });

  await logPermissionCheck({
    userId: user.id,
    tenantId: selectedTenantId,
    action: "impersonation_end",
    resource: "tenant",
    permission: "impersonation.switch",
    allowed: true,
    reason: reason || undefined,
    metadata: { selectedTenantId },
  });

  return response;
}
