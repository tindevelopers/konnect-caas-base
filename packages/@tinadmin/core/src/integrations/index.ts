import { createClient } from "../database/server";
import {
  decryptIntegrationCredentials,
  encryptIntegrationCredentials,
} from "./crypto";
import type { Database } from "../database/types";

type IntegrationConfigRow = Database["public"]["Tables"]["integration_configs"]["Row"];
type IntegrationConfigInsert = Database["public"]["Tables"]["integration_configs"]["Insert"];

export interface IntegrationConfigParams {
  tenantId: string;
  provider: string;
  category: string;
  credentials: Record<string, unknown>;
  settings?: Record<string, unknown> | null;
  status?: string;
}

export async function getIntegrationConfigs(tenantId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("integration_configs")
    .select("*")
    .eq("tenant_id", tenantId);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as unknown as IntegrationConfigRow[];
  return rows.map((row) => ({
    ...(row as IntegrationConfigRow),
    credentials:
      (decryptIntegrationCredentials(
        row.credentials as Record<string, unknown>
      ) as Record<string, unknown> | null) ?? {},
  }));
}

export async function getIntegrationConfig(
  tenantId: string,
  provider: string
): Promise<IntegrationConfigRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("integration_configs")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("provider", provider)
    .single();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as IntegrationConfigRow;
  return {
    ...row,
    credentials:
      (decryptIntegrationCredentials(
        row.credentials as Record<string, unknown>
      ) as Record<string, unknown> | null) ?? {},
  };
}

export async function upsertIntegrationConfig(params: IntegrationConfigParams) {
  const supabase = await createClient();

  const row: IntegrationConfigInsert = {
    tenant_id: params.tenantId,
    provider: params.provider,
    category: params.category,
    credentials: encryptIntegrationCredentials(params.credentials),
    settings: params.settings ?? null,
    status: params.status ?? "disconnected",
  };

  // Supabase client infers never for upsert when Table uses Record<string, unknown> for jsonb; assert.
  const { data, error } = await supabase
    .from("integration_configs")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert(row as any)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export {
  getPlatformIntegrationConfig,
  upsertPlatformIntegrationConfig,
  type PlatformIntegrationConfigParams,
} from "./platform";
