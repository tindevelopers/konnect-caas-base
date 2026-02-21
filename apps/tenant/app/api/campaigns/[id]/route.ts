import { NextResponse } from "next/server";
import { createClient } from "@/core/database/server";
import { getTenantForCrm } from "@/app/actions/crm/tenant-helper";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ ok: false, error: "Campaign id is required" }, { status: 400 });
  }

  try {
    const tenantId = await getTenantForCrm();

    const { data: existing, error: readError } = await (supabase.from("campaigns") as any)
      .select("id")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .maybeSingle();

    if (readError) {
      return NextResponse.json({ ok: false, error: readError.message }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ ok: false, error: "Campaign not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const { error: deleteError } = await (supabase.from("campaigns") as any)
      .update({ deleted_at: now, status: "cancelled" })
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null);

    if (deleteError) {
      return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to delete campaign",
      },
      { status: 500 }
    );
  }
}
