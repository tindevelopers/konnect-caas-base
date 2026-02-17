import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/database/server";
import { getAgentUsageSummaryAction } from "@/app/actions/agents/registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") ?? undefined;
    const endDate = searchParams.get("endDate") ?? undefined;
    const usage = await getAgentUsageSummaryAction({ startDate, endDate });
    return NextResponse.json(usage);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to load agent usage summary.",
      },
      { status: 500 }
    );
  }
}

