import { NextRequest, NextResponse } from "next/server";
import { routeAgentChat } from "@/src/core/agents/router";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RateState = { windowStart: number; count: number };
const RATE_LIMIT_PER_MINUTE = 30;
const rateLimitStore: Map<string, RateState> =
  (globalThis as unknown as { __agentPublicRateLimit?: Map<string, RateState> })
    .__agentPublicRateLimit ?? new Map<string, RateState>();

(globalThis as unknown as { __agentPublicRateLimit?: Map<string, RateState> }).__agentPublicRateLimit =
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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      publicKey?: string;
      tenantId?: string;
      listingExternalId?: string;
      message?: string;
      conversationId?: string;
      channel?: "webchat" | "sms" | "voice";
      metadata?: Record<string, unknown>;
    };

    if (!body.message?.trim()) {
      return NextResponse.json({ error: "message is required." }, { status: 400 });
    }
    if (!body.publicKey && !(body.tenantId && body.listingExternalId)) {
      return NextResponse.json(
        {
          error:
            "Provide either publicKey OR tenantId + listingExternalId for public chat.",
        },
        { status: 400 }
      );
    }

    const ip = getClientIp(request);
    const rateKey = `${ip}:${body.publicKey ?? `${body.tenantId}:${body.listingExternalId}`}`;
    const rate = enforceRateLimit(rateKey);
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please retry in a minute." },
        { status: 429 }
      );
    }

    const response = await routeAgentChat({
      tenantId: body.tenantId ?? "",
      publicKey: body.publicKey,
      listingExternalId: body.listingExternalId,
      message: body.message.trim(),
      conversationId: body.conversationId,
      channel: body.channel ?? "webchat",
      metadata: {
        ...(body.metadata ?? {}),
        public_request: true,
        source_ip: ip,
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to process public chat.",
      },
      { status: 500 }
    );
  }
}

