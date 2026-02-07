"use server";

import {
  getPlatformIntegrationConfig,
  upsertPlatformIntegrationConfig,
  type PlatformIntegrationConfigParams,
} from "@/core/integrations";
import { isPlatformAdmin } from "@/core/database/organization-admins";

export interface SavePlatformIntegrationConfigParams {
  provider: string;
  category: string;
  credentials: Record<string, unknown>;
  settings?: Record<string, unknown> | null;
  status?: string;
}

export async function fetchPlatformIntegrationConfig(provider: string) {
  const ok = await isPlatformAdmin();
  if (!ok) {
    throw new Error("Only Platform Admins can view system default integrations.");
  }
  return getPlatformIntegrationConfig(provider);
}

export async function savePlatformIntegrationConfig(
  params: SavePlatformIntegrationConfigParams
) {
  const ok = await isPlatformAdmin();
  if (!ok) {
    throw new Error("Only Platform Admins can set system default integrations.");
  }
  return upsertPlatformIntegrationConfig({
    provider: params.provider,
    category: params.category,
    credentials: params.credentials,
    settings: params.settings ?? null,
    status: params.status ?? "connected",
  });
}
