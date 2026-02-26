"use server";

import { getCurrentUserTenantId } from "@/core/multi-tenancy/validation";
import { requirePermission } from "@/core/permissions/middleware";
import { isPlatformAdmin } from "@/core/database/organization-admins";
import {
  getIntegrationConfig,
  getPlatformIntegrationConfig,
  upsertIntegrationConfig,
  upsertPlatformIntegrationConfig,
} from "@/core/integrations";
import { createProvider as createCrmProvider } from "../../../../../packages/integrations/crm/crm-provider-factory";
import { createCalendarProvider } from "../../../../../packages/integrations/calendar/calendar-provider-factory";

export interface IntegrationHealthResult {
  provider: string;
  ok: boolean;
  status: "active" | "error";
  message: string;
  checkedAt: string;
}

function hasCredentialValue(credentials: Record<string, unknown>) {
  return Object.values(credentials).some(
    (value) => String(value ?? "").trim().length > 0
  );
}

function extractToken(
  credentials: Record<string, unknown>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = credentials[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function toStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "string") out[key] = raw;
  }
  return out;
}

/** Extract reply text from Abacus API payload (handles multiple response shapes). */
function extractAbacusContentFromPayload(payload: Record<string, unknown>): string {
  const top = (key: string) => {
    const v = payload[key];
    return typeof v === "string" && v.trim().length > 0 ? v.trim() : "";
  };
  if (top("content")) return top("content");
  if (top("response")) return top("response");
  if (top("message")) return top("message");
  if (top("text")) return top("text");
  if (top("output")) return top("output");
  const data = payload.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    if (typeof d.content === "string" && d.content.trim()) return d.content.trim();
    if (typeof d.response === "string" && d.response.trim()) return d.response.trim();
    if (typeof d.message === "string" && d.message.trim()) return d.message.trim();
    if (typeof d.text === "string" && d.text.trim()) return d.text.trim();
  }
  const result = payload.result;
  if (typeof result === "string" && result.trim()) return result.trim();
  if (result && typeof result === "object" && !Array.isArray(result)) {
    const r = result as Record<string, unknown>;
    if (typeof r.content === "string" && r.content.trim()) return r.content.trim();
    if (typeof r.text === "string" && r.text.trim()) return r.text.trim();
    if (typeof r.message === "string" && r.message.trim()) return r.message.trim();
    if (typeof r.response === "string" && r.response.trim()) return r.response.trim();
    if (typeof r.output === "string" && r.output.trim()) return r.output.trim();
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
  const messages = payload.messages;
  if (Array.isArray(messages) && messages.length > 0) {
    const last = messages[messages.length - 1];
    if (last && typeof last === "object" && last !== null) {
      const m = last as Record<string, unknown>;
      if (typeof m.content === "string" && m.content.trim()) return m.content.trim();
      if (typeof m.text === "string" && m.text.trim()) return m.text.trim();
      if (typeof m.message === "string" && m.message.trim()) return m.message.trim();
    }
  }
  return "";
}

async function runProviderHealthCheck(
  provider: string,
  credentials: Record<string, unknown>,
  settings: Record<string, unknown> | null | undefined
): Promise<{ ok: boolean; message: string }> {
  if (!hasCredentialValue(credentials)) {
    return { ok: false, message: "Missing credentials. Add credentials first." };
  }

  switch (provider) {
    case "gohighlevel":
    case "hubspot": {
      await createCrmProvider({
        provider,
        credentials,
        settings: settings ?? undefined,
      });
      return { ok: true, message: `${provider} credentials are valid.` };
    }

    case "calcom": {
      const calendar = await createCalendarProvider({
        provider: "calendaring:calcom",
        credentials,
        settings: settings ?? undefined,
      });
      if (calendar.listEvents) {
        const now = new Date();
        const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        await calendar.listEvents({
          start: now.toISOString(),
          end: inSevenDays.toISOString(),
          limit: 1,
        });
      }
      return { ok: true, message: "Cal.com connection is healthy." };
    }

    case "telnyx": {
      const apiKey = extractToken(credentials, ["apiKey", "api_key"]);
      if (!apiKey) {
        return { ok: false, message: "Missing telephony API key." };
      }
      const response = await fetch("https://api.telnyx.com/v2/ai/assistants?page[size]=1", {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Telephony provider test failed (${response.status}): ${body}`);
      }
      return { ok: true, message: "Telephony provider connection is healthy." };
    }

    case "abacus": {
      const apiKey = extractToken(credentials, ["apiKey", "api_key"]);
      if (!apiKey) {
        return { ok: false, message: "Missing Abacus API key." };
      }
      const creds = toStringRecord(credentials);
      const sett = toStringRecord(settings);
      const deploymentId =
        sett.deploymentId ?? sett.deployment_id ?? creds.deploymentId ?? creds.deployment_id ?? "";
      const useDeployment = deploymentId.trim().length > 0;
      const defaultBase = useDeployment ? "https://apps.abacus.ai" : "https://api.abacus.ai";
      const defaultPath = useDeployment ? "/api/getChatResponse" : "/predict/getChatResponse";
      const baseUrl =
        sett.baseUrl ?? sett.apiBase ?? creds.baseUrl ?? defaultBase;
      const path =
        sett.apiPath ?? sett.path ?? creds.apiPath ?? creds.path ?? defaultPath;
      const deploymentToken =
        extractToken(credentials, ["deploymentToken", "deployment_token"]) ??
        sett.deploymentToken ??
        sett.deployment_token ??
        apiKey;
      const base = baseUrl.replace(/\/$/, "");
      const pathNorm = path.startsWith("/") ? path : `/${path}`;
      let url = `${base}${pathNorm}`;
      let body: Record<string, unknown>;
      if (useDeployment) {
        const params = new URLSearchParams({
          deploymentToken,
          deploymentId: deploymentId.trim(),
        });
        url = `${url}?${params.toString()}`;
        body = {
          messages: [{ is_user: true, text: "Hi" }],
          llmName: sett.llmName ?? null,
          numCompletionTokens: null,
          systemMessage: null,
          temperature: 0.0,
          filterKeyValues: null,
          searchScoreCutoff: null,
          chatConfig: null,
          userInfo: null,
        };
      } else {
        body = {
          prompt: "Hi",
          system_message: "Reply with one word: OK",
          llm_name: sett.llmName ?? "OPENAI_GPT4O",
        };
      }
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(useDeployment ? {} : { Authorization: `Bearer ${apiKey}` }),
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const text = await response.text();
        return {
          ok: false,
          message: `Abacus API returned ${response.status}. ${text.slice(0, 200)}`,
        };
      }
      const payload = (await response.json()) as Record<string, unknown>;
      const content = extractAbacusContentFromPayload(payload);
      if (!content || content.trim().length === 0) {
        const keys = payload && typeof payload === "object" ? Object.keys(payload).join(", ") : "—";
        return {
          ok: false,
          message: `Abacus returned an empty response. Response keys: ${keys}. Check Abacus docs for the actual response shape.`,
        };
      }
      return { ok: true, message: "Abacus connection is healthy." };
    }

    default:
      return {
        ok: true,
        message:
          "Credentials are saved. Provider-specific health checks are not implemented yet.",
      };
  }
}

function getHealthPatch(result: { ok: boolean; message: string }) {
  const checkedAt = new Date().toISOString();
  return {
    checkedAt,
    status: result.ok ? ("active" as const) : ("error" as const),
    message: result.message,
  };
}

export async function testIntegrationConnection(
  provider: string
): Promise<IntegrationHealthResult> {
  const baseResult = (ok: boolean, message: string): IntegrationHealthResult => ({
    provider,
    ok,
    status: ok ? "active" : "error",
    message,
    checkedAt: new Date().toISOString(),
  });

  try {
    const tenantId = await getCurrentUserTenantId();
    if (!tenantId) {
      return baseResult(false, "Tenant context missing.");
    }

    await requirePermission("integrations.write", { tenantId });

    const config = await getIntegrationConfig(tenantId, provider);
    if (!config) {
      return baseResult(
        false,
        "Integration not configured for this tenant. Save your credentials first."
      );
    }

    let result: { ok: boolean; message: string };
    try {
      result = await runProviderHealthCheck(
        provider,
        (config.credentials as Record<string, unknown>) ?? {},
        (config.settings as Record<string, unknown> | null | undefined) ?? null
      );
    } catch (error) {
      result = {
        ok: false,
        message:
          error instanceof Error ? error.message : "Integration health check failed.",
      };
    }

    const health = getHealthPatch(result);
    const nextSettings = {
      ...((config.settings as Record<string, unknown> | null | undefined) ?? {}),
      health,
    };

    await upsertIntegrationConfig({
      tenantId,
      provider: config.provider,
      category: config.category,
      credentials: (config.credentials as Record<string, unknown>) ?? {},
      status: config.status ?? (result.ok ? "connected" : "disconnected"),
      settings: nextSettings,
    });

    return {
      provider,
      ok: result.ok,
      status: result.ok ? "active" : "error",
      message: result.message,
      checkedAt: health.checkedAt,
    };
  } catch (error) {
    const raw =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : error != null && typeof (error as { message?: string }).message === "string"
            ? (error as { message: string }).message
            : error != null && typeof (error as { error_description?: string }).error_description === "string"
              ? (error as { error_description: string }).error_description
              : String(error);
    if (process.env.NODE_ENV === "development") {
      console.error("[testIntegrationConnection]", provider, error);
    }
    const message = raw.trim().length > 0 ? raw : "Test connection failed.";
    return baseResult(false, message);
  }
}

export async function testPlatformIntegrationConnection(
  provider: string
): Promise<IntegrationHealthResult> {
  const ok = await isPlatformAdmin();
  if (!ok) {
    throw new Error("Only Platform Admins can test system default integrations.");
  }

  const config = await getPlatformIntegrationConfig(provider);
  if (!config) {
    throw new Error("Integration not configured at platform level.");
  }

  let result: { ok: boolean; message: string };
  try {
    result = await runProviderHealthCheck(
      provider,
      (config.credentials as Record<string, unknown>) ?? {},
      (config.settings as Record<string, unknown> | null | undefined) ?? null
    );
  } catch (error) {
    result = {
      ok: false,
      message:
        error instanceof Error ? error.message : "Integration health check failed.",
    };
  }

  const health = getHealthPatch(result);
  const nextSettings = {
    ...((config.settings as Record<string, unknown> | null | undefined) ?? {}),
    health,
  };

  await upsertPlatformIntegrationConfig({
    provider: config.provider,
    category: config.category,
    credentials: (config.credentials as Record<string, unknown>) ?? {},
    status: config.status ?? (result.ok ? "connected" : "disconnected"),
    settings: nextSettings,
  });

  return {
    provider,
    ok: result.ok,
    status: result.ok ? "active" : "error",
    message: result.message,
    checkedAt: health.checkedAt,
  };
}
