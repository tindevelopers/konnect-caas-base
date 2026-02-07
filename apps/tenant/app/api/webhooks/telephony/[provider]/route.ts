import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/core/database/admin-client";

function resolveTenantId(request: NextRequest, payload: Record<string, unknown>) {
  const headerTenant = request.headers.get("x-tenant-id");
  if (headerTenant) return headerTenant;

  const url = new URL(request.url);
  const queryTenant =
    url.searchParams.get("tenantId") || url.searchParams.get("tenant_id");
  if (queryTenant) return queryTenant;

  const payloadTenant =
    (payload.tenant_id as string | undefined) ||
    (payload.tenantId as string | undefined);
  return payloadTenant;
}

function resolveEventType(payload: Record<string, unknown>) {
  const data = payload.data as Record<string, unknown> | undefined;
  return (
    (data?.event_type as string | undefined) ||
    (payload.event_type as string | undefined) ||
    (payload.type as string | undefined) ||
    "unknown"
  );
}

function resolveExternalId(payload: Record<string, unknown>) {
  const data = payload.data as Record<string, unknown> | undefined;
  return (
    (data?.id as string | undefined) ||
    (payload.id as string | undefined) ||
    null
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  const { provider } = await context.params;
  const payload = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const tenantId = resolveTenantId(request, payload);

  if (!tenantId) {
    return NextResponse.json(
      { error: "tenantId is required" },
      { status: 400 }
    );
  }

  const adminClient = createAdminClient();
  // Supabase types can infer `never` for inserts with generic Database types; assert to avoid build breaks.
  const { error } = await (adminClient.from("telephony_events") as any).insert({
    tenant_id: tenantId,
    provider,
    event_type: resolveEventType(payload),
    external_id: resolveExternalId(payload),
    payload,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to store telephony event" },
      { status: 500 }
    );
  }

  return NextResponse.json({ status: "ok" });
}
