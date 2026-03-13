import { NextRequest, NextResponse } from "next/server";
import { routeAgentChat } from "@/src/core/agents/router";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ listingId: string }> }
) {
  try {
    const { listingId } = await context.params;
    const body = (await request.json()) as {
      tenantId?: string;
      message?: string;
      conversationId?: string;
      metadata?: Record<string, unknown>;
    };

    const tenantId =
      body.tenantId ||
      new URL(request.url).searchParams.get("tenantId") ||
      undefined;
    if (!tenantId) {
      return NextResponse.json(
        { error: "tenantId is required for listing chat." },
        { status: 400 }
      );
    }
    if (!body.message?.trim()) {
      return NextResponse.json({ error: "message is required." }, { status: 400 });
    }

    const response = await routeAgentChat({
      tenantId,
      listingExternalId: listingId,
      message: body.message.trim(),
      conversationId: body.conversationId,
      channel: "webchat",
      metadata: {
        ...(body.metadata ?? {}),
        public_request: true,
        listing_id: listingId,
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to process listing chat.",
      },
      { status: 500 }
    );
  }
}

