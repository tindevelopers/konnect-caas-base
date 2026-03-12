import "server-only";

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

async function getRecentConversationTurns(
  tenantId: string,
  conversationId: string,
  limit = 20
) {
  const admin = createAdminClient();
  const { data, error } = await (admin.from("chatbot_messages") as any)
    .select("role, content, created_at")
    .eq("tenant_id", tenantId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[AbacusProvider] Failed to fetch conversation history", error);
    return [] as Array<{ role: string; content: string }>;
  }

  const rows = Array.isArray(data) ? [...data].reverse() : [];
  return rows
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const r = row as Record<string, unknown>;
      return {
        role: String(r.role ?? ""),
        content: String(r.content ?? ""),
      };
    })
    .filter((row) => row.role && row.content.trim().length > 0);
}

function mapTurnsToAbacusMessages(turns: Array<{ role: string; content: string }>) {
  return turns
    .filter((turn) => turn.role === "user" || turn.role === "assistant")
    .map((turn) => ({
      is_user: turn.role === "user",
      text: turn.content,
    }));
}

function buildContextBlock(
  turns: Array<{ role: string; content: string }>,
  currentMessage: string
) {
  const history = turns
    .map((turn) => `[${turn.role}] ${turn.content}`)
    .join("\n");
  if (!history.trim()) return currentMessage;
  return [
    "Previous conversation context:",
    history,
    "",
    "Current user message:",
    currentMessage,
  ].join("\n");
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
    const deploymentId =
      tenantSettings.deploymentId ??
      tenantSettings.deployment_id ??
      decryptedTenantCreds.deploymentId ??
      decryptedTenantCreds.deployment_id ??
      process.env.ABACUS_DEPLOYMENT_ID ??
      "";
    const useDeployment = deploymentId.trim().length > 0;
    const defaultBase = "https://routellm.abacus.ai/v1";
    return {
      apiKey: decryptedTenantCreds.apiKey ?? decryptedTenantCreds.api_key ?? "",
      baseUrl:
        tenantSettings.baseUrl ??
        tenantSettings.apiBase ??
        decryptedTenantCreds.baseUrl ??
        defaultBase,
      llmName: tenantSettings.llmName ?? "OPENAI_GPT4O",
      deploymentId,
      deploymentToken:
        decryptedTenantCreds.deploymentToken ??
        decryptedTenantCreds.deployment_token ??
        tenantSettings.deploymentToken ??
        tenantSettings.deployment_token ??
        process.env.ABACUS_DEPLOYMENT_TOKEN ??
        "",
    };
  }

  const platformConfig = await getPlatformIntegrationConfig("abacus");
  const platformCreds = toStringRecord(
    decryptIntegrationCredentials(
      platformConfig?.credentials as Record<string, unknown>
    )
  );
  const platformSettings = toStringRecord(platformConfig?.settings);

  const deploymentId =
    platformSettings.deploymentId ??
    platformSettings.deployment_id ??
    process.env.ABACUS_DEPLOYMENT_ID ??
    "";
  const useDeployment = deploymentId.trim().length > 0;
  const defaultBase = "https://routellm.abacus.ai/v1";
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
      defaultBase,
    llmName:
      platformSettings.llmName ??
      process.env.ABACUS_LLM_NAME ??
      "OPENAI_GPT4O",
    deploymentId,
    deploymentToken:
      platformCreds.deploymentToken ??
      platformCreds.deployment_token ??
      platformSettings.deploymentToken ??
      platformSettings.deployment_token ??
      process.env.ABACUS_DEPLOYMENT_TOKEN ??
      "",
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

function extractAbacusContent(response: AbacusChatResponse | RouteLLMChatResponse): string {
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

function safeJsonLog(value: unknown, maxChars = 20000): string {
  try {
    const text = JSON.stringify(value, null, 2);
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars) + `\n... (truncated, total ${text.length} chars)`;
  } catch (err) {
    return `[unserializable: ${err instanceof Error ? err.message : String(err)}]`;
  }
}

function estimateTokenCount(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

const PSD_NEW_AGENT_ID = "c146b5d4-94c1-4430-9ed6-b907b0a08a69";
const ABACUS_DEPLOYMENT_ENDPOINT = "https://apps.abacus.ai/api/getChatResponse";

function resolveAbacusMode(): "deployment" | "model" {
  const mode = (process.env.ABACUS_MODE ?? "").trim().toLowerCase();
  return mode === "deployment" ? "deployment" : "model";
}

function isPsdNewAgentCampaignVoiceCall(request: AgentProviderRequest): boolean {
  if (request.agent.id !== PSD_NEW_AGENT_ID) return false;
  const metadata = (request.metadata ?? {}) as Record<string, unknown>;
  return metadata.telnyx_proxy_brain === true;
}

function getAbacusTimeoutMs(request: AgentProviderRequest): number {
  const routing = request.agent.routing ?? {};
  const fromRouting = Number(
    (routing as Record<string, unknown>).tieredAbacusTimeoutSeconds
  );
  if (Number.isFinite(fromRouting) && fromRouting > 0) {
    return Math.floor(fromRouting * 1000);
  }
  const fromEnv = Number(process.env.ABACUS_TIMEOUT_SECONDS);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.floor(fromEnv * 1000);
  }
  return 30000;
}

async function postWithTimeout(
  url: string,
  body: Record<string, unknown>,
  headers: Record<string, string>,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error(`Abacus chat timed out after ${Math.floor(timeoutMs / 1000)}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export class AbacusAgentProvider implements AgentProviderDriver {
  readonly name = "abacus";

  async sendMessage(
    request: AgentProviderRequest
  ): Promise<AgentProviderResponse> {
    const {
      apiKey,
      baseUrl,
      llmName,
      deploymentId,
      deploymentToken,
    } = await getAbacusCredentials(request.tenantId);
    const mode = resolveAbacusMode();
    const isPsdCampaignCall = isPsdNewAgentCampaignVoiceCall(request);

    if (isPsdCampaignCall) {
      const forcedDeploymentToken = process.env.ABACUS_DEPLOYMENT_TOKEN?.trim() ?? "";
      const forcedDeploymentId = process.env.ABACUS_DEPLOYMENT_ID?.trim() ?? "";
      if (!forcedDeploymentToken || !forcedDeploymentId) {
        console.error("Abacus deployment configuration missing for PSD new agent", {
          agentId: request.agent.id,
        });
        throw new Error("Abacus deployment configuration missing for PSD new agent");
      }
      const params = new URLSearchParams({
        deploymentToken: forcedDeploymentToken,
        deploymentId: forcedDeploymentId,
      });
      const endpoint = `${ABACUS_DEPLOYMENT_ENDPOINT}?${params.toString()}`;
      console.log("PSD new agent campaign call → using Abacus deployment endpoint", {
        agentId: request.agent.id,
        deploymentId: forcedDeploymentId,
        endpoint: ABACUS_DEPLOYMENT_ENDPOINT,
      });

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              is_user: true,
              text: request.message,
            },
          ],
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Abacus deployment chat failed (${response.status}): ${text}`);
      }

      const payload = (await response.json()) as RouteLLMChatResponse & AbacusChatResponse;
      const debugRaw =
        process.env.ABACUS_DEBUG_RAW_RESPONSE === "true" ||
        (request.metadata as Record<string, unknown> | undefined)?.abacus_debug_raw === true;
      if (debugRaw) {
        console.log(
          "[AbacusProvider] RAW_RESPONSE",
          safeJsonLog(payload, Number(process.env.ABACUS_DEBUG_RAW_MAX_CHARS ?? 20000))
        );
      } else {
        const topKeys = payload && typeof payload === "object" ? Object.keys(payload as object) : [];
        console.log("[AbacusProvider] RESPONSE_KEYS", topKeys.slice(0, 40));
      }

      let content = extractAbacusContent(payload);
      const prefix = process.env.ABACUS_RESPONSE_PREFIX?.trim();
      if (prefix) content = prefix + content;
      const inputTokens =
        Number(payload.usage?.prompt_tokens ?? (payload.usage as { input_tokens?: number })?.input_tokens ?? 0) ||
        estimateTokenCount(request.message);
      const outputTokens =
        Number(payload.usage?.completion_tokens ?? (payload.usage as { output_tokens?: number })?.output_tokens ?? 0) ||
        estimateTokenCount(content);
      const estimatedCost = inputTokens * 0.000002 + outputTokens * 0.000008;
      return {
        content,
        externalConversationId: payload.conversation_id as string | undefined,
        usage: {
          inputTokens,
          outputTokens,
          estimatedCost,
          currency: "USD",
        },
        raw: payload as unknown as Record<string, unknown>,
      };
    }

    if (mode === "deployment") {
      if (!deploymentToken?.trim() || !deploymentId?.trim()) {
        throw new Error(
          "Abacus deployment mode requires ABACUS_DEPLOYMENT_TOKEN and ABACUS_DEPLOYMENT_ID."
        );
      }
      console.log("Abacus provider using deployment API");
      const params = new URLSearchParams({
        deploymentToken: deploymentToken.trim(),
        deploymentId: deploymentId.trim(),
      });
      const url = `${ABACUS_DEPLOYMENT_ENDPOINT}?${params.toString()}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              is_user: true,
              text: request.message,
            },
          ],
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Abacus deployment chat failed (${response.status}): ${text}`);
      }

      const payload = (await response.json()) as RouteLLMChatResponse & AbacusChatResponse;
      const debugRaw =
        process.env.ABACUS_DEBUG_RAW_RESPONSE === "true" ||
        (request.metadata as Record<string, unknown> | undefined)?.abacus_debug_raw === true;
      if (debugRaw) {
        console.log(
          "[AbacusProvider] RAW_RESPONSE",
          safeJsonLog(payload, Number(process.env.ABACUS_DEBUG_RAW_MAX_CHARS ?? 20000))
        );
      } else {
        const topKeys = payload && typeof payload === "object" ? Object.keys(payload as object) : [];
        console.log("[AbacusProvider] RESPONSE_KEYS", topKeys.slice(0, 40));
      }

      let content = extractAbacusContent(payload);
      const prefix = process.env.ABACUS_RESPONSE_PREFIX?.trim();
      if (prefix) content = prefix + content;
      const inputTokens =
        Number(payload.usage?.prompt_tokens ?? (payload.usage as { input_tokens?: number })?.input_tokens ?? 0) ||
        estimateTokenCount(request.message);
      const outputTokens =
        Number(payload.usage?.completion_tokens ?? (payload.usage as { output_tokens?: number })?.output_tokens ?? 0) ||
        estimateTokenCount(content);
      const estimatedCost = inputTokens * 0.000002 + outputTokens * 0.000008;
      return {
        content,
        externalConversationId: payload.conversation_id as string | undefined,
        usage: {
          inputTokens,
          outputTokens,
          estimatedCost,
          currency: "USD",
        },
        raw: payload as unknown as Record<string, unknown>,
      };
    }

    console.log("Abacus provider using RouteLLM API");
    if (!apiKey?.trim()) {
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
    const debugRaw =
      process.env.ABACUS_DEBUG_RAW_RESPONSE === "true" ||
      (request.metadata as Record<string, unknown> | undefined)?.abacus_debug_raw === true;
    if (debugRaw) {
      console.log(
        "[AbacusProvider] RAW_RESPONSE",
        safeJsonLog(payload, Number(process.env.ABACUS_DEBUG_RAW_MAX_CHARS ?? 20000))
      );
    } else {
      // Lightweight always-on signal so we can tell whether Abacus includes catalog/product fields.
      const topKeys = payload && typeof payload === "object" ? Object.keys(payload as object) : [];
      console.log("[AbacusProvider] RESPONSE_KEYS", topKeys.slice(0, 40));
    }
    let content = extractAbacusContent(payload);
    const prefix = process.env.ABACUS_RESPONSE_PREFIX?.trim();
    if (prefix) content = prefix + content;
    const inputTokens =
      Number(payload.usage?.prompt_tokens ?? (payload.usage as { input_tokens?: number })?.input_tokens ?? 0) ||
      estimateTokenCount(request.message);
    const outputTokens =
      Number(payload.usage?.completion_tokens ?? (payload.usage as { output_tokens?: number })?.output_tokens ?? 0) ||
      estimateTokenCount(content);
    // Abacus routes to multiple models, use conservative blended estimate.
    const estimatedCost = inputTokens * 0.000002 + outputTokens * 0.000008;
    return {
      content,
      externalConversationId: payload.conversation_id as string | undefined,
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

