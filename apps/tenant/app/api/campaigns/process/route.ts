import { NextRequest, NextResponse } from "next/server";
import { processCampaignVoiceBatch } from "@/app/actions/campaigns/executor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron-triggered route to process due campaign recipients.
 * Can be called by Vercel Cron or external scheduler.
 * Optionally pass tenantId via query or x-tenant-id header.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = request.nextUrl.searchParams.get("tenantId") ?? request.headers.get("x-tenant-id") ?? undefined;

  try {
    const result = await processCampaignVoiceBatch(tenantId);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
