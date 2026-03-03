import "server-only";

import { appendFileSync } from "fs";
import { join } from "path";
import { createAdminClient } from "@/core/database/admin-client";
import { decryptIntegrationCredentials } from "@/core/integrations/crypto";
import { getPlatformIntegrationConfig } from "@/core/integrations";
import type { AgentProviderDriver } from "./base";
import type { AgentProviderRequest, AgentProviderResponse } from "../types";

/** RouteLLM OpenAI-compatible chat completion response. */
type RouteLLMChatResponse = {
  choices?: Array<{
    message?: { content?: string | null };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
};

/** Legacy predict/getChatResponse response (kept for fallback). */
type AbacusChatResponse = {
  content?: string;
  response?: string;
  message?: string;
  conversation_id?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
};

function toStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "string") out[key] = raw;
  }
  return out;
}

async function getAbacusCredentials(tenantId: string) {
  const admin = createAdminClient();
  const { data } = await (admin.from("integration_configs") as any)
    .select("credentials, settings")
    .eq("tenant_id", tenantId)
    .eq("provider", "abacus")
    .maybeSingle();

  const decryptedTenantCreds = toStringRecord(
    decryptIntegrationCredentials(data?.credentials as Record<string, unknown>)
  );
  const tenantSettings = toStringRecord(data?.settings);

  if (decryptedTenantCreds.apiKey || decryptedTenantCreds.api_key) {
    return {
      apiKey: decryptedTenantCreds.apiKey ?? decryptedTenantCreds.api_key ?? "",
      baseUrl:
        tenantSettings.baseUrl ??
        tenantSettings.apiBase ??
        "https://routellm.abacus.ai/v1",
      llmName: tenantSettings.llmName ?? "OPENAI_GPT4O",
    };
  }

  const platformConfig = await getPlatformIntegrationConfig("abacus");
  const platformCreds = toStringRecord(
    decryptIntegrationCredentials(
      platformConfig?.credentials as Record<string, unknown>
    )
  );
  const platformSettings = toStringRecord(platformConfig?.settings);

  return {
    apiKey:
      platformCreds.apiKey ??
      platformCreds.api_key ??
      process.env.ABACUS_API_KEY ??
      "",
    baseUrl:
      platformSettings.baseUrl ??
      platformSettings.apiBase ??
      process.env.ABACUS_API_URL ??
      "https://routellm.abacus.ai/v1",
    llmName:
      platformSettings.llmName ??
      process.env.ABACUS_LLM_NAME ??
      "OPENAI_GPT4O",
  };
}

/** Map legacy llm_name to RouteLLM model id. */
function toRouteLLMModel(llmName: string): string {
  const normalized = (llmName ?? "").trim().toUpperCase();
  const map: Record<string, string> = {
    OPENAI_GPT4O: "gpt-4o",
    OPENAI_GPT4O_MINI: "gpt-4o-mini",
    ROUTE_LLM: "route-llm",
  };
  if (map[normalized]) return map[normalized];
  if (normalized === "ROUTE-LLM" || normalized === "ROUTE_LLM") return "route-llm";
  if (llmName && /^[a-z0-9.-]+$/i.test(llmName)) return llmName;
  return "route-llm";
}

function extractAbacusContent(response: AbacusChatResponse | RouteLLMChatResponse) {
  const r = response as RouteLLMChatResponse;
  if (Array.isArray(r.choices) && r.choices[0]?.message?.content != null) {
    const content = r.choices[0].message.content;
    if (typeof content === "string" && content.trim()) return content;
  }
  const legacy = response as AbacusChatResponse;
  if (typeof legacy.content === "string" && legacy.content.trim()) return legacy.content;
  if (typeof legacy.response === "string" && legacy.response.trim()) return legacy.response;
  if (typeof legacy.message === "string" && legacy.message.trim()) return legacy.message;
  return "I was unable to generate a response from Abacus.";
}

function estimateTokenCount(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

export class AbacusAgentProvider implements AgentProviderDriver {
  readonly name = "abacus";

  async sendMessage(
    request: AgentProviderRequest
  ): Promise<AgentProviderResponse> {
    const { apiKey, baseUrl, llmName } = await getAbacusCredentials(
      request.tenantId
    );
    if (!apiKey) {
      throw new Error(
        "Abacus API key is not configured. Connect Abacus under Integrations first."
      );
    }

    let systemPrompt =
      (request.agent.model_profile?.systemPrompt as string | undefined) ??
      "You are a helpful assistant.";
    const fromWidget = Boolean((request.metadata as Record<string, unknown>)?.telnyx_proxy_brain);
    if (fromWidget) {
      systemPrompt +=
        "\n\nWhen the user asks for product links or pricing details, include the actual product URLs in your reply in this chat. Do not say you cannot send links in chat or ask for their email; provide the links directly in your message.";
    }
    const model = toRouteLLMModel(llmName);
    const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: request.message },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Abacus chat failed (${response.status}): ${text}`);
    }

    const payload = (await response.json()) as RouteLLMChatResponse & AbacusChatResponse;
    let content = extractAbacusContent(payload);
    // #region debug link flow (session 722982)
    const _hasInsertLink = /\[\s*insert\s+link\s*\]/i.test(content);
    const _hasHttp = /https?:\/\//i.test(content);
    const _payload = {
      sessionId: "722982",
      location: "abacus.ts:sendMessage:afterExtractContent",
      message: "Abacus raw content",
      data: {
        fromWidget,
        contentLen: content.length,
        hasInsertLinkPlaceholder: _hasInsertLink,
        hasUrlInContent: _hasHttp,
        contentSnippet: content.slice(0, 250),
      },
      timestamp: Date.now(),
      hypothesisId: "H1",
    };
    try {
      appendFileSync(join(process.cwd(), ".cursor", "debug-722982.log"), JSON.stringify(_payload) + "\n");
    } catch (_) {}
    fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "722982" },
      body: JSON.stringify(_payload),
    }).catch(() => {});
    // #endregion
    const prefix = process.env.ABACUS_RESPONSE_PREFIX?.trim();
    if (prefix) content = prefix + content;
    const inputTokens =
      Number(payload.usage?.prompt_tokens ?? payload.usage?.input_tokens ?? 0) ||
      estimateTokenCount(request.message);
    const outputTokens =
      Number(payload.usage?.completion_tokens ?? payload.usage?.output_tokens ?? 0) ||
      estimateTokenCount(content);
    // Abacus routes to multiple models, use conservative blended estimate.
    const estimatedCost = inputTokens * 0.000002 + outputTokens * 0.000008;
    return {
      content,
      externalConversationId: payload.conversation_id,
      usage: {
        inputTokens,
        outputTokens,
        estimatedCost,
        currency: "USD",
      },
      raw: payload as unknown as Record<string, unknown>,
    };
  }
}

