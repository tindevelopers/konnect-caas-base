"use server";

import { getCurrentUserTenantId } from "@/core/multi-tenancy/validation";
import { requirePermission } from "@/core/permissions/middleware";
import { getIntegrationConfigs } from "@/core/integrations";
import { createCalendarProvider } from "../../../../../packages/integrations/calendar/calendar-provider-factory";
import type { CalendarEvent } from "../../../../../packages/integrations/calendar/calendar-types";

const schedulingProviderPriority = [
  "calcom",
  "google-calendar",
  "nylas",
  "calendly",
] as const;

export interface ListCalendarEventsResult {
  provider: string | null;
  events: CalendarEvent[];
  warning?: string;
}

function hasCredentialValue(credentials: Record<string, unknown> | null | undefined) {
  if (!credentials) return false;
  return Object.values(credentials).some(
    (value) => String(value ?? "").trim().length > 0
  );
}

function toCalendarProviderType(provider: string) {
  if (provider === "calcom") return "calendaring:calcom";
  return null;
}

export async function listCalendarEventsAction(params?: {
  start?: string;
  end?: string;
}): Promise<ListCalendarEventsResult> {
  const tenantId = await getCurrentUserTenantId();
  if (!tenantId) {
    throw new Error("Tenant context missing");
  }

  await requirePermission("integrations.read", { tenantId });

  const configs = await getIntegrationConfigs(tenantId);
  const connectedScheduling = configs.filter((config) => {
    if (config.category !== "Scheduling") return false;
    const statusConnected = config.status === "connected";
    const credentialConnected = hasCredentialValue(
      config.credentials as Record<string, unknown>
    );
    return statusConnected || credentialConnected;
  });

  if (connectedScheduling.length === 0) {
    return {
      provider: null,
      events: [],
      warning: "No connected scheduling integration. Connect Cal.com or another provider.",
    };
  }

  const chosen =
    schedulingProviderPriority
      .map((provider) =>
        connectedScheduling.find((config) => config.provider === provider)
      )
      .find(Boolean) ?? connectedScheduling[0];

  const providerType = toCalendarProviderType(chosen.provider);
  if (!providerType) {
    return {
      provider: chosen.provider,
      events: [],
      warning: `${chosen.provider} is connected but calendar adapter is not implemented yet.`,
    };
  }

  try {
    const provider = await createCalendarProvider({
      provider: providerType,
      credentials: (chosen.credentials as Record<string, unknown>) ?? {},
      settings: (chosen.settings as Record<string, unknown> | undefined) ?? undefined,
    });

    const events = provider.listEvents
      ? await provider.listEvents({
          start: params?.start,
          end: params?.end,
          limit: 100,
        })
      : [];

    return {
      provider: chosen.provider,
      events,
    };
  } catch (error) {
    return {
      provider: chosen.provider,
      events: [],
      warning:
        error instanceof Error
          ? error.message
          : "Failed to load events from the calendar provider.",
    };
  }
}
