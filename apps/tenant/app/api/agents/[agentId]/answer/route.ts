import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/database/server";
import { ensureTenantId } from "@/core/multi-tenancy/validation";
import { getAgentAnswer } from "@/src/core/agents/answer-service";
import { createAdminClient } from "@/core/database/admin-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveAgentId(
  tenantId: string,
  idOrExternalRef: string
): Promise<string> {
  if (UUID_RE.test(idOrExternalRef)) return idOrExternalRef;

  const admin = createAdminClient();
  const { data, error } = await (admin.from("agent_instances") as any)
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("external_ref", idOrExternalRef)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch agent: ${error.message}`);
  }
  if (!data?.id) {
    throw new Error(
      `No platform agent found for external ref "${idOrExternalRef}". ` +
        "Register this assistant in Agent Manager first."
    );
  }
  return String(data.id);
}

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
    const { agentId: rawId } = await context.params;
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

    const agentId = await resolveAgentId(tenantId, rawId);

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
