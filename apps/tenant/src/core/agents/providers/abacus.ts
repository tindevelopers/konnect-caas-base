import "server-only";

import { createAdminClient } from "@/core/database/admin-client";
import { decryptIntegrationCredentials } from "@/core/integrations/crypto";
import { getPlatformIntegrationConfig } from "@/core/integrations";
import type { AgentProviderDriver } from "./base";
import type { AgentProviderRequest, AgentProviderResponse } from "../types";

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
    const defaultBase = useDeployment ? "https://apps.abacus.ai" : "https://api.abacus.ai";
    const defaultPath = useDeployment ? "/api/getChatResponse" : "/predict/getChatResponse";
    return {
      apiKey: decryptedTenantCreds.apiKey ?? decryptedTenantCreds.api_key ?? "",
      baseUrl:
        tenantSettings.baseUrl ??
        tenantSettings.apiBase ??
        decryptedTenantCreds.baseUrl ??
        defaultBase,
      apiPath:
        tenantSettings.apiPath ??
        tenantSettings.path ??
        decryptedTenantCreds.apiPath ??
        decryptedTenantCreds.path ??
        defaultPath,
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
  const defaultBase = useDeployment ? "https://apps.abacus.ai" : "https://api.abacus.ai";
  const defaultPath = useDeployment ? "/api/getChatResponse" : "/predict/getChatResponse";
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
    apiPath:
      platformSettings.apiPath ??
      platformSettings.path ??
      process.env.ABACUS_API_PATH ??
      defaultPath,
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

/** Extract reply text from Abacus API payload (handles multiple response shapes). */
function extractAbacusContent(response: Record<string, unknown>): string {
  const top = (key: string) => {
    const v = response[key];
    return typeof v === "string" && v.trim().length > 0 ? v.trim() : "";
  };
  if (top("content")) return top("content");
  if (top("response")) return top("response");
  if (top("message")) return top("message");
  if (top("text")) return top("text");
  if (top("output")) return top("output");
  const data = response.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    if (typeof d.content === "string" && d.content.trim()) return d.content.trim();
    if (typeof d.response === "string" && d.response.trim()) return d.response.trim();
    if (typeof d.message === "string" && d.message.trim()) return d.message.trim();
    if (typeof d.text === "string" && d.text.trim()) return d.text.trim();
  }
  const result = response.result;
  if (typeof result === "string" && result.trim()) return result.trim();
  if (result && typeof result === "object" && !Array.isArray(result)) {
    const r = result as Record<string, unknown>;
    if (typeof r.content === "string" && r.content.trim()) return r.content.trim();
    if (typeof r.text === "string" && r.text.trim()) return r.text.trim();
    if (typeof r.message === "string" && r.message.trim()) return r.message.trim();
    if (typeof r.response === "string" && r.response.trim()) return r.response.trim();
    if (typeof r.output === "string" && r.output.trim()) return r.output.trim();
    // Abacus Predictions API: result.messages = [{ is_user, text }, ...]; last assistant message has reply
    const resultMessages = r.messages;
    if (Array.isArray(resultMessages) && resultMessages.length > 0) {
      for (let i = resultMessages.length - 1; i >= 0; i--) {
        const m = resultMessages[i] as Record<string, unknown> | undefined;
        if (m && m.is_user === false && typeof m.text === "string" && m.text.trim()) {
          return m.text.trim();
        }
      }
    }
    const choices = r.choices;
    if (Array.isArray(choices) && choices.length > 0) {
      const first = choices[0] as Record<string, unknown> | undefined;
      const msg = first?.message;
      if (msg && typeof msg === "object" && msg !== null) {
        const m = msg as Record<string, unknown>;
        if (typeof m.content === "string" && m.content.trim()) return m.content.trim();
      }
    }
  }
  const messages = response.messages;
  if (Array.isArray(messages) && messages.length > 0) {
    const last = messages[messages.length - 1];
    if (last && typeof last === "object" && last !== null) {
      const m = last as Record<string, unknown>;
      if (typeof m.content === "string" && m.content.trim()) return m.content.trim();
      if (typeof m.text === "string" && m.text.trim()) return m.text.trim();
      if (typeof m.message === "string" && m.message.trim()) return m.message.trim();
    }
  }
  // Predictions API / alternate shapes
  const pred = response.Prediction ?? response.prediction;
  if (typeof pred === "string" && pred.trim()) return pred.trim();
  if (pred && typeof pred === "object" && !Array.isArray(pred)) {
    const p = pred as Record<string, unknown>;
    if (typeof p.content === "string" && p.content.trim()) return p.content.trim();
    if (typeof p.text === "string" && p.text.trim()) return p.text.trim();
    if (typeof p.response === "string" && p.response.trim()) return p.response.trim();
  }
  const outputs = response.outputs;
  if (Array.isArray(outputs) && outputs.length > 0) {
    const first = outputs[0];
    if (typeof first === "string" && first.trim()) return first.trim();
    if (first && typeof first === "object" && first !== null) {
      const o = first as Record<string, unknown>;
      if (typeof o.content === "string" && o.content.trim()) return o.content.trim();
      if (typeof o.text === "string" && o.text.trim()) return o.text.trim();
    }
  }
  const chatResp = response.chat_response ?? response.chatResponse;
  if (typeof chatResp === "string" && chatResp.trim()) return chatResp.trim();
  const genText = response.generated_text ?? response.generatedText;
  if (typeof genText === "string" && genText.trim()) return genText.trim();

  console.warn(
    "[AbacusProvider] Could not extract content. Keys:",
    Object.keys(response).join(", ")
  );
  return "I was unable to generate a response from Abacus.";
}

function estimateTokenCount(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
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
      apiPath,
      llmName,
      deploymentId,
      deploymentToken,
    } = await getAbacusCredentials(request.tenantId);

    const token = deploymentToken || apiKey;
    if (!token) {
      throw new Error(
        "Abacus API key or deployment token is not configured. Connect Abacus under Integrations first."
      );
    }
    const useDeploymentApi = Boolean(deploymentId?.trim() && deploymentToken);
    // Predictions API (apps.abacus.ai): deploymentToken + deploymentId in query; body has messages only.
    const systemPrompt = request.agent.model_profile?.systemPrompt as
      | string
      | undefined;

    const base = baseUrl.replace(/\/$/, "");
    const path = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
    let url = `${base}${path}`;
    let body: Record<string, unknown>;
    const turns =
      request.conversationId && request.conversationId.trim().length > 0
        ? await getRecentConversationTurns(request.tenantId, request.conversationId.trim())
        : [];
    const historyMessages = mapTurnsToAbacusMessages(turns);
    const fullMessages = [
      ...historyMessages,
      { is_user: true, text: request.message },
    ];
    const singleContextMessage = [
      {
        is_user: true,
        text: buildContextBlock(turns, request.message),
      },
    ];

    if (useDeploymentApi) {
      const params = new URLSearchParams({
        deploymentToken: token,
        deploymentId: deploymentId.trim(),
      });
      url = `${url}${url.includes("?") ? "&" : "?"}${params.toString()}`;
      body = {
        messages: fullMessages,
        llmName: llmName || null,
        numCompletionTokens: null,
        systemMessage: systemPrompt ?? null,
        temperature: 0.0,
        filterKeyValues: null,
        searchScoreCutoff: null,
        chatConfig: null,
        userInfo: null,
      };
    } else {
      body = {
        prompt: buildContextBlock(turns, request.message),
        llm_name: llmName,
        system_message: systemPrompt ?? "You are a helpful assistant.",
      };
    }

    const requestHeaders = {
      "Content-Type": "application/json",
      ...(useDeploymentApi ? {} : { Authorization: `Bearer ${apiKey || token}` }),
    };
    const timeoutMs = getAbacusTimeoutMs(request);
    let response = await postWithTimeout(url, body, requestHeaders, timeoutMs);

    if (
      !response.ok &&
      useDeploymentApi &&
      fullMessages.length > 1 &&
      (response.status === 400 || response.status === 422)
    ) {
      body = {
        ...body,
        messages: singleContextMessage,
      };
      response = await postWithTimeout(url, body, requestHeaders, timeoutMs);
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Abacus chat failed (${response.status}): ${text}`);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const content = extractAbacusContent(payload);
    const usage = payload.usage as { input_tokens?: number; output_tokens?: number } | undefined;
    const inputTokens =
      Number(usage?.input_tokens ?? 0) || estimateTokenCount(request.message);
    const outputTokens =
      Number(usage?.output_tokens ?? 0) || estimateTokenCount(content);
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

