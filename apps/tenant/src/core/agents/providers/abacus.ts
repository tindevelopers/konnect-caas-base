import "server-only";

import { createAdminClient } from "@/core/database/admin-client";
import { decryptIntegrationCredentials } from "@/core/integrations/crypto";
import { getPlatformIntegrationConfig } from "@/core/integrations";
import type { AgentProviderDriver } from "./base";
import type { AgentProviderRequest, AgentProviderResponse } from "../types";

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
        "https://api.abacus.ai",
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
      "https://api.abacus.ai",
    llmName:
      platformSettings.llmName ??
      process.env.ABACUS_LLM_NAME ??
      "OPENAI_GPT4O",
  };
}

function extractAbacusContent(response: AbacusChatResponse) {
  if (typeof response.content === "string" && response.content.trim()) {
    return response.content;
  }
  if (typeof response.response === "string" && response.response.trim()) {
    return response.response;
  }
  if (typeof response.message === "string" && response.message.trim()) {
    return response.message;
  }
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

    const url = `${baseUrl.replace(/\/$/, "")}/predict/getChatResponse`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt: request.message,
        llm_name: llmName,
        system_message:
          (request.agent.model_profile?.systemPrompt as string | undefined) ??
          "You are a helpful assistant.",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Abacus chat failed (${response.status}): ${text}`);
    }

    const payload = (await response.json()) as AbacusChatResponse;
    const content = extractAbacusContent(payload);
    const inputTokens =
      Number(payload.usage?.input_tokens ?? 0) || estimateTokenCount(request.message);
    const outputTokens =
      Number(payload.usage?.output_tokens ?? 0) || estimateTokenCount(content);
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

