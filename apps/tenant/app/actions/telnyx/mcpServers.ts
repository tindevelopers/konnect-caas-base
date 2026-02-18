"use server";

import { createClient } from "@/core/database/server";
import { getCurrentUserTenantId } from "@/core/multi-tenancy/validation";
import { requirePermission } from "@/core/permissions/middleware";

export interface McpServerRecord {
  id: string;
  tenant_id: string;
  name: string;
  server_url: string;
  secret_ref: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface McpServerCreateRequest {
  name: string;
  server_url: string;
  secret_ref?: string | null;
  description?: string | null;
}

export async function listMcpServersAction(): Promise<McpServerRecord[]> {
  const tenantId = await getCurrentUserTenantId();
  if (!tenantId) {
    throw new Error("Tenant context missing");
  }

  await requirePermission("integrations.read", { tenantId });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("telnyx_mcp_servers")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as McpServerRecord[];
}

export async function createMcpServerAction(
  payload: McpServerCreateRequest
): Promise<McpServerRecord> {
  const tenantId = await getCurrentUserTenantId();
  if (!tenantId) {
    throw new Error("Tenant context missing");
  }

  await requirePermission("integrations.write", { tenantId });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("telnyx_mcp_servers")
    // Supabase client types may infer `never` for inserts when generated types are missing.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(
      {
        tenant_id: tenantId,
        name: payload.name,
        server_url: payload.server_url,
        secret_ref: payload.secret_ref ?? null,
        description: payload.description ?? null,
      } as any
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as McpServerRecord;
}

export async function deleteMcpServerAction(id: string) {
  const tenantId = await getCurrentUserTenantId();
  if (!tenantId) {
    throw new Error("Tenant context missing");
  }

  await requirePermission("integrations.write", { tenantId });

  const supabase = await createClient();
  const { error } = await supabase
    .from("telnyx_mcp_servers")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", id);

  if (error) {
    throw error;
  }
}
