import { NextRequest, NextResponse } from "next/server";
import { getAgentAnswer } from "@/src/core/agents/answer-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RateState = { windowStart: number; count: number };
const RATE_LIMIT_PER_MINUTE = 30;
const rateLimitStore: Map<string, RateState> =
  (globalThis as unknown as { __agentAnswerRateLimit?: Map<string, RateState> })
    .__agentAnswerRateLimit ?? new Map<string, RateState>();

(globalThis as unknown as { __agentAnswerRateLimit?: Map<string, RateState> }).__agentAnswerRateLimit =
  rateLimitStore;

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

function enforceRateLimit(key: string) {
  const now = Date.now();
  const current = rateLimitStore.get(key);
  if (!current || now - current.windowStart > 60_000) {
    rateLimitStore.set(key, { windowStart: now, count: 1 });
    return { ok: true };
  }
  if (current.count >= RATE_LIMIT_PER_MINUTE) {
    return { ok: false };
  }
  current.count += 1;
  rateLimitStore.set(key, current);
  return { ok: true };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      publicKey?: string;
      tenantId?: string;
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
    if (!body.publicKey) {
      return NextResponse.json(
        { error: "publicKey is required for public answer API." },
        { status: 400 }
      );
    }

    const ip = getClientIp(request);
    const rateKey = `answer:${ip}:${body.publicKey}`;
    const rate = enforceRateLimit(rateKey);
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please retry in a minute." },
        { status: 429 }
      );
    }

    const response = await getAgentAnswer({
      publicKey: body.publicKey,
      tenantId: body.tenantId,
      channel: body.channel ?? "webchat",
      message: body.message.trim(),
      conversationId: body.conversationId,
      externalConversationId: body.externalConversationId,
      context: body.context,
      metadata: {
        ...(body.metadata ?? {}),
        public_request: true,
        source_ip: ip,
      },
    });

    // Response includes conversationId; clients must send it on follow-up messages for L2 state to persist.
    return NextResponse.json(response, {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to process public answer.",
      },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
