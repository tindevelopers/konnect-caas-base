import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/database/server";
import { ensureTenantId } from "@/core/multi-tenancy/validation";
import { getAgentAnswer } from "@/src/core/agents/answer-service";

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
      channel?: "webchat" | "sms" | "voice";
      conversationId?: string;
      externalConversationId?: string;
      context?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    };

    if (!body.message?.trim()) {
      return NextResponse.json(
        { error: "message is required." },
        { status: 400 }
      );
    }

    const response = await getAgentAnswer({
      agentId,
      tenantId,
      channel: body.channel ?? "webchat",
      message: body.message.trim(),
      conversationId: body.conversationId,
      externalConversationId: body.externalConversationId,
      userId: user.id,
      context: body.context,
      metadata: body.metadata,
    });

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to get agent answer.",
      },
      { status: 500 }
    );
  }
}
