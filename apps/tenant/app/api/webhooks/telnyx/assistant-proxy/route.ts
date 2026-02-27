import { NextResponse, type NextRequest } from "next/server";
import { createPublicKey, verify as cryptoVerify } from "crypto";
import { telnyxWebhookConfig } from "@/src/core/telnyx/config";
import { getAgentAnswer } from "@/src/core/agents/answer-service";
import { createAdminClient } from "@/core/database/admin-client";
import {
  getAgentInstanceByExternalRef,
  getAgentInstanceByPublicKey,
} from "@/src/core/agents/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizePublicKeyToPem(publicKey: string) {
  const trimmed = publicKey.trim();
  if (!trimmed) return "";
  if (trimmed.includes("BEGIN PUBLIC KEY")) return trimmed;
  const base64 = trimmed.replace(/\s+/g, "");
  const lines = base64.match(/.{1,64}/g) ?? [base64];
  return ["-----BEGIN PUBLIC KEY-----", ...lines, "-----END PUBLIC KEY-----"].join(
    "\n"
  );
}

/**
 * Verify Telnyx webhook signature using ED25519 (API v2 webhook signing).
 * Signature is computed over `${timestamp}|${payload}` and Base64-encoded.
 */
function verifyTelnyxEd25519Signature(args: {
  rawBody: string;
  timestamp: string;
  signature: string;
  publicKey: string;
}): boolean {
  const { rawBody, timestamp, signature, publicKey } = args;
  if (!rawBody || !timestamp || !signature || !publicKey) return false;

  try {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) return false;
    if (Math.abs(nowSeconds - ts) > 5 * 60) return false;

    const message = Buffer.from(`${timestamp}|${rawBody}`, "utf8");
    const sig = Buffer.from(signature, "base64");
    const pem = normalizePublicKeyToPem(publicKey);
    const key = createPublicKey(pem);
    return cryptoVerify(null, message, key, sig);
  } catch {
    return false;
  }
}

function extractStringDeep(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const direct = payload[key];
    if (typeof direct === "string" && direct.trim()) return direct.trim();
  }

  const data = asRecord(payload.data);
  for (const key of keys) {
    const v = data[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }

  const nested = asRecord(data.payload);
  for (const key of keys) {
    const v = nested[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }

  const args = asRecord(payload.arguments);
  for (const key of keys) {
    const v = args[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }

  const input = asRecord(payload.input);
  for (const key of keys) {
    const v = input[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }

  return null;
}

async function lookupInternalConversationId(args: {
  tenantId: string;
  providerConversationId: string;
}) {
  const admin = createAdminClient();
  const { data } = await (admin.from("chatbot_conversations") as any)
    .select("id")
    .eq("tenant_id", args.tenantId)
    // PostgREST JSON path filter
    .eq("metadata->>provider_conversation_id", args.providerConversationId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? undefined;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, telnyx-signature-ed25519, telnyx-timestamp",
    },
  });
}

/**
 * Telnyx AI Assistant webhook tool endpoint.
 *
 * Configure a Telnyx assistant "webhook" tool pointing here. In the assistant instructions,
 * tell Telnyx to always call this tool and use the returned `content` as the final reply.
 *
 * This endpoint resolves the platform entry agent by `assistant_id` (mapped to `agent_instances.external_ref`),
 * then runs tiered orchestration (L1→L2→L3) via `getAgentAnswer()`.
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const publicKeyParam = url.searchParams.get("publicKey")?.trim() || "";

  const rawBody = await request.text();

  const ed25519Signature =
    request.headers.get("telnyx-signature-ed25519") ||
    request.headers.get("Telnyx-Signature-Ed25519");
  const ed25519Timestamp =
    request.headers.get("telnyx-timestamp") || request.headers.get("Telnyx-Timestamp");

  if (ed25519Signature && ed25519Timestamp) {
    if (telnyxWebhookConfig.isEd25519Configured()) {
      const ok = verifyTelnyxEd25519Signature({
        rawBody,
        timestamp: ed25519Timestamp,
        signature: ed25519Signature,
        publicKey: telnyxWebhookConfig.publicKey,
      });
      if (!ok) {
        return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
      }
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const assistantId = extractStringDeep(payload, [
    "assistant_id",
    "assistantId",
    "agent_id",
    "agentId",
  ]);
  if (!assistantId && !publicKeyParam) {
    return NextResponse.json({ error: "assistant_id is required" }, { status: 400 });
  }

  const message = extractStringDeep(payload, [
    "message",
    "content",
    "text",
    "query",
    "input",
    "user_message",
    "userMessage",
  ]);
  if (!message) {
    return NextResponse.json({ error: "message content is required" }, { status: 400 });
  }

  const providerConversationId = extractStringDeep(payload, [
    "conversation_id",
    "conversationId",
    "telnyx_conversation_id",
  ]);

  try {
    const entryAgent = publicKeyParam
      ? await getAgentInstanceByPublicKey(publicKeyParam)
      : await getAgentInstanceByExternalRef(assistantId ?? "");
    if (!entryAgent) {
      return NextResponse.json(
        {
          error: publicKeyParam
            ? "publicKey did not match any platform agent."
            : "No platform agent mapped to this assistant_id. Map your Telnyx proxy assistant id to agent_instances.external_ref, or add ?publicKey=... to the webhook tool URL.",
        },
        { status: 404 }
      );
    }

    const internalConversationId =
      providerConversationId
        ? await lookupInternalConversationId({
            tenantId: entryAgent.tenant_id,
            providerConversationId,
          })
        : undefined;

    const response = await getAgentAnswer({
      publicKey: entryAgent.public_key,
      message,
      channel: "webchat",
      conversationId: internalConversationId,
      externalConversationId: providerConversationId ?? undefined,
      metadata: {
        telnyx_proxy_brain: true,
        telnyx_proxy_assistant_id: assistantId ?? null,
      },
    });

    const banner =
      typeof response.tieredEscalationBanner === "string"
        ? response.tieredEscalationBanner.trim()
        : "";
    const content = response.chat_markdown ?? response.voice_text ?? "";
    const finalText = banner ? `${banner}\n\n${content}` : content;

    // Return multiple common fields so the Telnyx tool bridge can pick one up.
    return NextResponse.json(
      {
        content: finalText,
        result: finalText,
        data: {
          content: finalText,
        },
        // Echo through Telnyx conversation id if present (harmless).
        conversation_id: providerConversationId ?? undefined,
      },
      { headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error) {
    const safeMessage =
      "Sorry — the assistant is temporarily unavailable. Please try again in a moment.";
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[TelnyxAssistantProxy] Tool request failed", errMsg);
    // Telnyx tools generally behave better with 2xx responses. Return a safe message.
    return NextResponse.json(
      {
        content: safeMessage,
        result: safeMessage,
        data: { content: safeMessage },
        error: "proxy_brain_failed",
      },
      { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}

