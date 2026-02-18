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
  const tenantId = await getCurrentUserTenantId();
  if (!tenantId) {
    throw new Error("Tenant context missing");
  }

  await requirePermission("integrations.write", { tenantId });

  const config = await getIntegrationConfig(tenantId, provider);
  if (!config) {
    throw new Error("Integration not configured for this tenant.");
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
