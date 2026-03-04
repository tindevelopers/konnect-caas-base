import { NextResponse, type NextRequest } from "next/server";
import { createPublicKey, verify as cryptoVerify } from "crypto";
import { telnyxWebhookConfig } from "@/src/core/telnyx/config";
import { getAgentAnswer } from "@/src/core/agents/answer-service";
import { createAdminClient } from "@/core/database/admin-client";
import {
  consumePendingProductLinks,
  storePendingProductLinks,
} from "@/src/core/agents/conversation-links";
import {
  extractEmailFromMessage,
  sendProductLinksEmail,
} from "@/src/core/agents/product-link-emailer";
import {
  getAgentInstanceById,
  getAgentInstanceByExternalRef,
  getAgentInstanceByPublicKey,
  listAgentInstances,
} from "@/src/core/agents/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const EMAIL_PROMPT_TEXT =
  "I can send these product links to your email so you can open them easily. Please share your email address.";

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
  // Direct top-level
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

  // data.payload.arguments (Telnyx tool invocation)
  const nestedArgs = asRecord(nested.arguments);
  for (const key of keys) {
    const v = nestedArgs[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }

  // data.arguments
  const dataArgs = asRecord(data.arguments);
  for (const key of keys) {
    const v = dataArgs[key];
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

  // messages[] — last user message (OpenAI-style tool context)
  const messages = payload.messages ?? data.messages ?? nested.messages;
  if (Array.isArray(messages) && messages.length > 0) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i] as Record<string, unknown> | undefined;
      if (!m || typeof m !== "object") continue;
      const role = (m.role as string) ?? "";
      if (role !== "user" && role !== "human") continue;
      const content = m.content ?? m.text;
      if (typeof content === "string" && content.trim()) return content.trim();
      const parts = m.parts ?? m.content_parts;
      if (Array.isArray(parts)) {
        for (const p of parts) {
          const text = typeof p === "string" ? p : (p as Record<string, unknown>)?.text;
          if (typeof text === "string" && text.trim()) return text.trim();
        }
      }
    }
  }

  return null;
}

function extractTextFromUnknown(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value) return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = extractTextFromUnknown(item);
      if (extracted) return extracted;
    }
    return null;
  }

  if (typeof value !== "object") return null;
  const record = asRecord(value);
  const commonTextKeys = [
    "text",
    "content",
    "message",
    "value",
    "body",
    "input",
    "prompt",
  ];

  for (const key of commonTextKeys) {
    const extracted = extractTextFromUnknown(record[key]);
    if (extracted) return extracted;
  }

  const nestedContainers = ["arguments", "payload", "data", "parts", "content_parts"];
  for (const key of nestedContainers) {
    const extracted = extractTextFromUnknown(record[key]);
    if (extracted) return extracted;
  }

  return null;
}

function extractMessageDeep(payload: Record<string, unknown>): string | null {
  const messageKeys = [
    "message",
    "content",
    "text",
    "query",
    "input",
    "user_message",
    "userMessage",
    "prompt",
    "body",
    "user_input",
  ];

  const byStringSearch = extractStringDeep(payload, messageKeys);
  if (byStringSearch) return byStringSearch;

  const data = asRecord(payload.data);
  const nested = asRecord(data.payload);
  const containers: Record<string, unknown>[] = [
    payload,
    data,
    nested,
    asRecord(nested.arguments),
    asRecord(data.arguments),
    asRecord(payload.arguments),
    asRecord(payload.input),
  ];

  for (const container of containers) {
    for (const key of messageKeys) {
      const extracted = extractTextFromUnknown(container[key]);
      if (extracted) return extracted;
    }
  }

  // messages[] — last user message (OpenAI-style tool context)
  const messages = payload.messages ?? data.messages ?? nested.messages;
  if (Array.isArray(messages) && messages.length > 0) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i] as Record<string, unknown> | undefined;
      if (!m || typeof m !== "object") continue;
      const role = (m.role as string) ?? "";
      if (role !== "user" && role !== "human") continue;
      const extracted =
        extractTextFromUnknown(m.content) ??
        extractTextFromUnknown(m.text) ??
        extractTextFromUnknown(m.parts) ??
        extractTextFromUnknown(m.content_parts);
      if (extracted) return extracted;
    }
  }

  return null;
}

function extractUniqueUrls(text: string): string[] {
  const urlMatches = text.match(/https?:\/\/[^\s)\]}\]]+/gi) ?? [];
  return [...new Set(urlMatches.map((u) => u.replace(/[.,;:!?)]+$/, "").trim()))].filter(Boolean);
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

async function validateAssistantTenantMapping(args: {
  tenantId: string;
  assistantId: string;
}) {
  const admin = createAdminClient();
  const { data, error } = await (admin.from("tenant_ai_assistants") as any)
    .select("id")
    .eq("tenant_id", args.tenantId)
    .eq("telnyx_assistant_id", args.assistantId)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("[TelnyxAssistantProxy] tenant_ai_assistants validation failed", error);
    return false;
  }
  return Boolean(data?.id);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, telnyx-signature-ed25519, telnyx-timestamp, x-telnyx-call-control-id",
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
 * then runs tiered orchestration (L1→L2) via `getAgentAnswer()`.
 */
export async function POST(request: NextRequest) {
  try {
    return await handleProxyPost(request);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[TelnyxAssistantProxy] Unhandled error", msg);
    return NextResponse.json(
      {
        content: `Sorry — something went wrong: ${msg}`,
        result: msg,
        error: "proxy_brain_error",
      },
      { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}

async function handleProxyPost(request: NextRequest) {
  const url = new URL(request.url);
  const publicKeyParam = url.searchParams.get("publicKey")?.trim() || "";

  const rawBody = await request.text();
  // Observability: grep for [TelnyxAssistantProxy] in Vercel/server logs to trace flow.
  const _bodyLen = rawBody?.length ?? 0;
  console.log(
    "[TelnyxAssistantProxy] TELNYX_INBOUND",
    "hasPublicKey=" + Boolean(publicKeyParam),
    "bodyLen=" + _bodyLen,
  );
  // #region agent log
  const _logStart = { location: "assistant-proxy:start", hasPublicKey: !!publicKeyParam, bodyLen: _bodyLen };
  fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ..._logStart, message: "Proxy request received", data: _logStart, timestamp: Date.now(), hypothesisId: "H0" }),
  }).catch(() => {});
  console.log("[TelnyxAssistantProxy:DEBUG]", JSON.stringify(_logStart));
  // #endregion

  const ed25519Signature =
    request.headers.get("telnyx-signature-ed25519") ||
    request.headers.get("Telnyx-Signature-Ed25519");
  const ed25519Timestamp =
    request.headers.get("telnyx-timestamp") || request.headers.get("Telnyx-Timestamp");
  const requireSignature =
    process.env.NODE_ENV === "production" &&
    telnyxWebhookConfig.isEd25519Configured();

  if (requireSignature && (!ed25519Signature || !ed25519Timestamp)) {
    // #region agent log
    const _logSig = { step: "signatureMissing", requireSignature, hasSig: !!ed25519Signature, hasTs: !!ed25519Timestamp };
    fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location: "assistant-proxy:signatureMissing", message: "Missing webhook signature", data: _logSig, timestamp: Date.now(), hypothesisId: "H4" }),
    }).catch(() => {});
    console.log("[TelnyxAssistantProxy:DEBUG]", JSON.stringify(_logSig));
    // #endregion
    return NextResponse.json(
      { error: "Missing webhook signature headers" },
      { status: 401 }
    );
  }

  if (ed25519Signature && ed25519Timestamp && telnyxWebhookConfig.isEd25519Configured()) {
    const ok = verifyTelnyxEd25519Signature({
      rawBody,
      timestamp: ed25519Timestamp,
      signature: ed25519Signature,
      publicKey: telnyxWebhookConfig.publicKey,
    });
    if (!ok) {
      // #region agent log
      const _logInv = { step: "signatureInvalid" };
      fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: "assistant-proxy:signatureInvalid", message: "Invalid webhook signature", data: _logInv, timestamp: Date.now(), hypothesisId: "H4" }),
      }).catch(() => {});
      console.log("[TelnyxAssistantProxy:DEBUG]", JSON.stringify(_logInv));
      // #endregion
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
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
    console.warn("[TelnyxAssistantProxy] 400: assistant_id/publicKey missing", {
      topKeys: Object.keys(payload ?? {}).join(", "),
    });
    return NextResponse.json(
      {
        error:
          "assistant_id or publicKey is required. Add ?publicKey=<PLATFORM_AGENT_PUBLIC_KEY> to the webhook URL, or include assistant_id in the payload.",
      },
      { status: 400 }
    );
  }

  const message = extractMessageDeep(payload);
  // #region agent log
  const topKeys = Object.keys(payload ?? {}).join(", ");
  const dataKeys = payload?.data && typeof payload.data === "object"
    ? Object.keys(payload.data as object).join(", ")
    : "";
  const _logExtract = { hasMessage: !!message, messageLen: message?.length ?? 0, assistantId: assistantId ?? null, topKeys, dataKeys };
  fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location: "assistant-proxy:extractMessage", message: "Message extraction", data: _logExtract, timestamp: Date.now(), hypothesisId: "H1" }),
  }).catch(() => {});
  console.log("[TelnyxAssistantProxy:DEBUG]", JSON.stringify({ step: "extractMessage", ..._logExtract }));
  // #endregion
  if (!message) {
    console.warn("[TelnyxAssistantProxy] 400: message not found in payload", {
      topKeys,
      dataKeys,
      hasArguments: "arguments" in (payload ?? {}),
    });
    return NextResponse.json(
      { error: "message content is required. Provide a message in the request body (e.g. arguments.message, content, or input)." },
      { status: 400 }
    );
  }

  // conversation_id from payload or x-telnyx-call-control-id header (async tool requests)
  const providerConversationId =
    extractStringDeep(payload, [
      "conversation_id",
      "conversationId",
      "telnyx_conversation_id",
      "call_control_id",
    ]) ?? (request.headers.get("x-telnyx-call-control-id")?.trim() || undefined);

  try {
    const entryAgent = publicKeyParam
      ? await getAgentInstanceByPublicKey(publicKeyParam)
      : await getAgentInstanceByExternalRef(assistantId ?? "");
    if (!entryAgent) {
      // #region agent log
      const _logEntry = { step: "entryAgentNotFound", assistantId: assistantId ?? null, publicKeyParam: !!publicKeyParam };
      fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: "assistant-proxy:entryAgent", message: "Entry agent not found", data: _logEntry, timestamp: Date.now(), hypothesisId: "H1" }),
      }).catch(() => {});
      console.log("[TelnyxAssistantProxy:DEBUG]", JSON.stringify(_logEntry));
      // #endregion
      return NextResponse.json(
        {
          error: publicKeyParam
            ? "publicKey did not match any platform agent."
            : "No platform agent mapped to this assistant_id. Map your Telnyx proxy assistant id to agent_instances.external_ref, or add ?publicKey=... to the webhook tool URL.",
        },
        { status: 404 }
      );
    }

    // #region agent log
    const tieredChat = Boolean((entryAgent as { routing?: { tieredChat?: unknown } }).routing?.tieredChat);
    const level2Id = (entryAgent as { routing?: { level2AgentId?: unknown } }).routing?.level2AgentId;
    const entryProvider = (entryAgent as { provider?: string }).provider;
    const _logResolved = { step: "entryResolved", entryAgentId: entryAgent.id, entryAgentProvider: entryProvider, tieredChat, level2AgentId: level2Id ?? null };
    fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location: "assistant-proxy:entryResolved", message: "Entry agent resolved", data: _logResolved, timestamp: Date.now(), hypothesisId: "H2" }),
    }).catch(() => {});
    console.log("[TelnyxAssistantProxy:DEBUG]", JSON.stringify(_logResolved));
    // #endregion

    if (assistantId && !publicKeyParam) {
      const mapped = await validateAssistantTenantMapping({
        tenantId: entryAgent.tenant_id,
        assistantId,
      });
      if (!mapped) {
        const strictMapping =
          process.env.TELNYX_PROXY_STRICT_ASSISTANT_TENANT_CHECK === "true";
        console.warn("[TelnyxAssistantProxy] assistant_id not found in tenant_ai_assistants", {
          tenantId: entryAgent.tenant_id,
          assistantId,
          entryAgentId: entryAgent.id,
        });
        if (strictMapping) {
          return NextResponse.json(
            {
              error:
                "assistant_id is not mapped to this tenant in tenant_ai_assistants.",
            },
            { status: 403 }
          );
        }
      }
    }

    const internalConversationId =
      providerConversationId
        ? await lookupInternalConversationId({
            tenantId: entryAgent.tenant_id,
            providerConversationId,
          })
        : undefined;
    const resolvedProxyAssistantId =
      (assistantId && assistantId.trim()) ||
      ((entryAgent as { external_ref?: string }).external_ref?.trim() ?? null);
    const messageEmail = extractEmailFromMessage(message);

    if (internalConversationId && messageEmail) {
      const pendingLinks = await consumePendingProductLinks(internalConversationId);
      if (pendingLinks?.links?.length) {
        const sendResult = await sendProductLinksEmail({
          to: messageEmail,
          tenantId: entryAgent.tenant_id,
          tenantName: "PetStore Direct",
          assistantName: "PetStore Direct AI",
          introText: pendingLinks.snippet,
          links: pendingLinks.links,
        });

        if (sendResult.success) {
          const confirmation =
            `Done. I have sent the product links to ${messageEmail}. ` +
            "Please check your inbox.";
          return NextResponse.json(
            {
              content: confirmation,
              result: confirmation,
              data: { content: confirmation },
              conversation_id: providerConversationId ?? undefined,
              provider: "proxy_email_delivery",
              agentId: entryAgent.id,
            },
            { headers: { "Access-Control-Allow-Origin": "*" } }
          );
        }

        // Restore pending links if send failed, so user can retry with the same email.
        await storePendingProductLinks(
          internalConversationId,
          pendingLinks.links,
          pendingLinks.snippet
        );
        const failMessage =
          "I couldn't send the email right now. Please confirm your email address and I will try again.";
        return NextResponse.json(
          {
            content: failMessage,
            result: failMessage,
            data: { content: failMessage },
            conversation_id: providerConversationId ?? undefined,
            provider: "proxy_email_delivery_failed",
            agentId: entryAgent.id,
          },
          { headers: { "Access-Control-Allow-Origin": "*" } }
        );
      }
    }

    // #region agent log
    const _logBefore = {
      step: "beforeGetAgentAnswer",
      entryAgentId: entryAgent.id,
      messageLen: message.length,
      hasConversationId: !!internalConversationId,
      assistantIdFromPayload: assistantId ?? null,
      resolvedProxyAssistantId,
    };
    fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location: "assistant-proxy:beforeGetAgentAnswer", message: "Calling getAgentAnswer", data: _logBefore, timestamp: Date.now(), hypothesisId: "H3" }),
    }).catch(() => {});
    console.log("[TelnyxAssistantProxy:DEBUG]", JSON.stringify(_logBefore));
    // #endregion
    const fromWidget = !publicKeyParam && !!assistantId;
    // For widget path with tiered chat: call L2 directly to avoid L1 (Telnyx) failure + latency so response returns before Telnyx tool timeout and links show in Test Chat.
    let agentToUse = entryAgent;
    if (fromWidget && tieredChat && level2Id != null && typeof level2Id === "string") {
      const level2Agent = await getAgentInstanceById(entryAgent.tenant_id, level2Id);
      if (level2Agent) {
        agentToUse = level2Agent;
        console.log("[TelnyxAssistantProxy] WIDGET_TIERED_SKIP_L1", "level2AgentId=" + level2Id, "provider=" + (level2Agent as { provider?: string }).provider);
      }
    } else if (fromWidget && (entryAgent as { provider?: string }).provider === "telnyx") {
      // Entry is Telnyx with no L2 (tieredChat false or no level2Id). Telnyx often fails in webhook context; use an Abacus agent so the widget gets link-capable replies instead of falling back to Telnyx native "I can't send links".
      const abacusAgents = await listAgentInstances(entryAgent.tenant_id, { provider: "abacus", status: "active", limit: 1 });
      if (abacusAgents.length > 0) {
        agentToUse = abacusAgents[0];
        console.log("[TelnyxAssistantProxy] WIDGET_FALLBACK_ABACUS", "abacusAgentId=" + agentToUse.id);
      }
    }
    console.log("[TelnyxAssistantProxy] GET_AGENT_ANSWER_START", "entryAgentId=" + entryAgent.id, "agentToUse=" + agentToUse.id, "messageLen=" + message.length);
    const response = await getAgentAnswer({
      tenantId: agentToUse.tenant_id,
      publicKey: agentToUse.public_key,
      message,
      channel: "webchat",
      conversationId: internalConversationId,
      externalConversationId: providerConversationId ?? undefined,
      metadata: {
        telnyx_proxy_brain: true,
        telnyx_proxy_assistant_id: resolvedProxyAssistantId,
        telnyx_conversation_id: providerConversationId ?? null,
      },
    });

    // #region agent log — trace links from getAgentAnswer (widget vs direct)
    const responseChatMarkdown = response.chat_markdown ?? "";
    const hasUrlInChatMarkdown = /https?:\/\//i.test(responseChatMarkdown);
    const _afterAnswer = {
      sessionId: "722982",
      location: "assistant-proxy:afterGetAgentAnswer:raw",
      message: "Raw response from getAgentAnswer (link trace)",
      data: {
        fromWidget,
        entryAgentProvider: (entryAgent as { provider?: string }).provider,
        responseProvider: response.provider ?? null,
        chatMarkdownLen: responseChatMarkdown.length,
        hasUrlInChatMarkdown,
        chatMarkdownSnippet: responseChatMarkdown.slice(0, 500),
      },
      timestamp: Date.now(),
      hypothesisId: "H3",
    };
    fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "722982" },
      body: JSON.stringify(_afterAnswer),
    }).catch(() => {});
    try {
      const { appendFileSync } = await import("fs");
      const { join } = await import("path");
      appendFileSync(join(process.cwd(), ".cursor", "debug-722982.log"), JSON.stringify(_afterAnswer) + "\n");
    } catch (_) {}
    // #endregion

    const banner =
      typeof response.tieredEscalationBanner === "string"
        ? response.tieredEscalationBanner.trim()
        : "";
    const content = response.chat_markdown ?? response.voice_text ?? "";
    let finalText = banner ? `${banner}\n\n${content}` : content;
    const uniqueUrls = extractUniqueUrls(content);
    if (uniqueUrls.length > 0) {
      const conversationIdForLinks = response.conversationId || internalConversationId;
      if (conversationIdForLinks) {
        await storePendingProductLinks(
          conversationIdForLinks,
          uniqueUrls.map((url) => ({ url })),
          content.slice(0, 500)
        );
      }
      if (!finalText.includes(EMAIL_PROMPT_TEXT)) {
        finalText += `\n\n${EMAIL_PROMPT_TEXT}`;
      }
    }

    // #region debug link flow (session 722982)
    const _hasMarkdownLinkInFinal = /\]\s*\(\s*https?:\/\//i.test(finalText);
    const _linkPayload = {
      sessionId: "722982",
      location: "assistant-proxy:beforeReturnToTelnyx",
      message: "Payload sent to Telnyx",
      data: {
        fromWidget,
        entryAgentProvider: (entryAgent as { provider?: string }).provider,
        finalTextLen: finalText.length,
        hasMarkdownLinkInPayload: _hasMarkdownLinkInFinal,
        finalTextSnippet: finalText.slice(0, 600),
      },
      timestamp: Date.now(),
      hypothesisId: "H3",
    };
    try {
      const { appendFileSync } = await import("fs");
      const { join } = await import("path");
      appendFileSync(join(process.cwd(), ".cursor", "debug-722982.log"), JSON.stringify(_linkPayload) + "\n");
    } catch (_) {}
    fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "722982" },
      body: JSON.stringify(_linkPayload),
    }).catch(() => {});
    // #endregion
    // #region agent log
    const _logAfter = { step: "afterGetAgentAnswer", hasBanner: !!banner, contentLen: content.length };
    fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location: "assistant-proxy:afterGetAgentAnswer", message: "Response after getAgentAnswer", data: _logAfter, timestamp: Date.now(), hypothesisId: "H5" }),
    }).catch(() => {});
    console.log("[TelnyxAssistantProxy:DEBUG]", JSON.stringify(_logAfter));
    // #endregion
    console.log(
      "[TelnyxAssistantProxy] GET_AGENT_ANSWER_OK",
      "provider=" + (response.provider ?? ""),
      "contentLen=" + finalText.length,
    );
    console.log("[TelnyxAssistantProxy] RESPONSE_TO_TELNYX", "contentLen=" + finalText.length);

    // #region agent log
    const _logSuccess = { step: "success", contentLen: finalText.length, hasBanner: !!banner };
    fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location: "assistant-proxy:success", message: "Proxy response success", data: _logSuccess, timestamp: Date.now(), hypothesisId: "H0" }),
    }).catch(() => {});
    console.log("[TelnyxAssistantProxy:DEBUG]", JSON.stringify(_logSuccess));
    // #endregion
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
        // For smoke tests / debugging: which backend produced the response
        provider: response.provider,
        agentId: response.agentId,
      },
      { headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error) {
    const safeMessage =
      "Sorry — the assistant is temporarily unavailable. Please try again in a moment.";
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    // #region agent log
    const _logCatch = { step: "catch", errMsg, errStack: errStack?.slice(0, 500) };
    fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location: "assistant-proxy:catch", message: "handleProxyPost error", data: _logCatch, timestamp: Date.now(), hypothesisId: "H3" }),
    }).catch(() => {});
    console.log("[TelnyxAssistantProxy:DEBUG]", JSON.stringify(_logCatch));
    // #endregion
    console.error("[TelnyxAssistantProxy] Tool request failed", errMsg);
    console.log("[TelnyxAssistantProxy] GET_AGENT_ANSWER_FAIL", "error=" + errMsg.slice(0, 200));
    return NextResponse.json(
      {
        content: safeMessage,
        result: safeMessage,
        data: { content: safeMessage },
        error: "proxy_brain_failed",
        errorDetail: errMsg,
      },
      { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}

