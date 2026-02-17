import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/database/server";
import { ensureTenantId } from "@/core/multi-tenancy/validation";
import { routeAgentChat } from "@/src/core/agents/router";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ agentId: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = await ensureTenantId();
    const { agentId } = await context.params;
    const body = (await request.json()) as {
      message?: string;
      conversationId?: string;
      channel?: "webchat" | "sms" | "voice";
      metadata?: Record<string, unknown>;
    };

    if (!body.message?.trim()) {
      return NextResponse.json({ error: "message is required." }, { status: 400 });
    }

    const response = await routeAgentChat({
      tenantId,
      agentId,
      message: body.message.trim(),
      conversationId: body.conversationId,
      channel: body.channel ?? "webchat",
      userId: user.id,
      metadata: body.metadata ?? {},
    });

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to process agent chat.",
      },
      { status: 500 }
    );
  }
}

