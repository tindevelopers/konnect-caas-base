"use server";

import { getTelemetryEvents, getTelemetryStats } from "@/src/core/telemetry";
import { requirePermission } from "@/core/permissions/middleware";
import { ensureTenantId } from "@/core/multi-tenancy/validation";
import { isPlatformAdmin } from "@/core/database/organization-admins";

export async function getTelemetryEventsAction(options?: {
  tenantId?: string | null;
  eventType?: string;
  operation?: string;
  provider?: string;
  status?: "success" | "error" | "timeout";
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
}) {
  // Check permissions
  const isAdmin = await isPlatformAdmin();
  let tenantId: string | null = null;

  if (!isAdmin) {
    try {
      tenantId = await ensureTenantId();
      await requirePermission("integrations.read", { tenantId });
    } catch {
      throw new Error("Permission denied");
    }
  } else {
    // Platform Admins can view all telemetry
    tenantId = options?.tenantId ?? null;
  }

  const startDate = options?.startDate ? new Date(options.startDate) : undefined;
  const endDate = options?.endDate ? new Date(options.endDate) : undefined;

  return getTelemetryEvents({
    tenantId,
    eventType: options?.eventType,
    operation: options?.operation,
    provider: options?.provider,
    status: options?.status,
    limit: options?.limit || 100,
    offset: options?.offset || 0,
    startDate,
    endDate,
  }).then((events) => {
    if (isAdmin) return events;
    // Non-platform admins should not see supplier/provider details.
    return events.map((e) => ({
      ...e,
      provider: "redacted",
      request_data: undefined,
      response_data: undefined,
      error_stack: undefined,
      metadata: undefined,
    }));
  });
}

export async function getTelemetryStatsAction(options?: {
  tenantId?: string | null;
  provider?: string;
  startDate?: string;
  endDate?: string;
}) {
  // Check permissions
  const isAdmin = await isPlatformAdmin();
  let tenantId: string | null = null;

  if (!isAdmin) {
    try {
      tenantId = await ensureTenantId();
      await requirePermission("integrations.read", { tenantId });
    } catch {
      throw new Error("Permission denied");
    }
  } else {
    // Platform Admins can view all telemetry
    tenantId = options?.tenantId ?? null;
  }

  const startDate = options?.startDate ? new Date(options.startDate) : undefined;
  const endDate = options?.endDate ? new Date(options.endDate) : undefined;

  return getTelemetryStats({
    tenantId,
    provider: isAdmin ? options?.provider : undefined,
    startDate,
    endDate,
  });
}
