/**
 * Platform (system-wide) integration configs.
 * Uses admin client; callers must enforce platform-admin-only access.
 */
import { createAdminClient } from "../database/admin-client";
import {
  decryptIntegrationCredentials,
  encryptIntegrationCredentials,
} from "./crypto";
import type { Database } from "../database/types";

type PlatformConfigRow = Database["public"]["Tables"]["platform_integration_configs"]["Row"];
type PlatformConfigInsert = Database["public"]["Tables"]["platform_integration_configs"]["Insert"];

export interface PlatformIntegrationConfigParams {
  provider: string;
  category: string;
  credentials: Record<string, unknown>;
  settings?: Record<string, unknown> | null;
  status?: string;
}

export async function getPlatformIntegrationConfig(
  provider: string
): Promise<PlatformConfigRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("platform_integration_configs")
    .select("*")
    .eq("provider", provider)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return null;
  }

  return {
    ...(data as PlatformConfigRow),
    credentials:
      (decryptIntegrationCredentials(
        data.credentials as Record<string, unknown>
      ) as Record<string, unknown> | null) ?? {},
  };
}

export async function upsertPlatformIntegrationConfig(
  params: PlatformIntegrationConfigParams
): Promise<PlatformConfigRow> {
  const supabase = createAdminClient();
  const row: PlatformConfigInsert = {
    provider: params.provider,
    category: params.category,
    credentials: encryptIntegrationCredentials(params.credentials),
    settings: params.settings ?? null,
    status: params.status ?? "disconnected",
  };
  const { data, error } = await supabase
    .from("platform_integration_configs")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert(row as any, { onConflict: "provider" })
    .select()
    .single();
  if (error) throw error;
  return data as PlatformConfigRow;
}
