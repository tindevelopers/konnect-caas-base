"use server";

import { requirePermission } from "@/core/permissions/middleware";
import { getCurrentUserTenantId } from "@/core/multi-tenancy/validation";
import { upsertIntegrationConfig } from "@/core/integrations";
import { GoHighLevelProvider } from "../../../../../packages/integrations/crm/providers/gohighlevel-provider";

export interface ConnectGoHighLevelParams {
  credentials: {
    apiKey: string;
    locationId: string;
  };
}

export async function connectGoHighLevelIntegration(
  params: ConnectGoHighLevelParams
) {
  const tenantId = await getCurrentUserTenantId();
  if (!tenantId) {
    throw new Error("Tenant context missing");
  }

  await requirePermission("integrations.write", { tenantId });

  const provider = new GoHighLevelProvider();
  await provider.initialize({
    provider: "gohighlevel",
    credentials: params.credentials,
  });

  const isHealthy = await provider.healthCheck();
  if (!isHealthy) {
    throw new Error("GoHighLevel credentials could not be validated");
  }

  return upsertIntegrationConfig({
    tenantId,
    provider: "gohighlevel",
    category: "CRM",
    credentials: params.credentials,
    status: "connected",
  });
}
