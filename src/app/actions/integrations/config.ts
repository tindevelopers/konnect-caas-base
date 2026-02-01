"use server";

import { requirePermission } from "@/core/permissions/middleware";
import { getCurrentUserTenantId } from "@/core/multi-tenancy/validation";
import {
  getIntegrationConfig,
  getIntegrationConfigs,
  upsertIntegrationConfig,
} from "@/core/integrations";

export interface SaveIntegrationConfigParams {
  provider: string;
  category: string;
  credentials: Record<string, any>;
  settings?: Record<string, any> | null;
  status?: string;
}

export async function saveIntegrationConfig(params: SaveIntegrationConfigParams) {
  const tenantId = await getCurrentUserTenantId();
  if (!tenantId) {
    throw new Error("Tenant context missing");
  }

  await requirePermission("integrations.write", { tenantId });

  return upsertIntegrationConfig({
    tenantId,
    provider: params.provider,
    category: params.category,
    credentials: params.credentials,
    settings: params.settings ?? null,
    status: params.status ?? "connected",
  });
}

export async function fetchIntegrationConfig(provider: string) {
  const tenantId = await getCurrentUserTenantId();
  if (!tenantId) {
    throw new Error("Tenant context missing");
  }

  await requirePermission("integrations.read", { tenantId });
  return getIntegrationConfig(tenantId, provider);
}

export async function fetchIntegrationConfigs() {
  const tenantId = await getCurrentUserTenantId();
  if (!tenantId) {
    throw new Error("Tenant context missing");
  }

  await requirePermission("integrations.read", { tenantId });
  return getIntegrationConfigs(tenantId);
}
