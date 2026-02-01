"use server";

import { createTenantAwareServerClient } from "@/core/database/tenant-client";
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

  const client = await createTenantAwareServerClient(tenantId);
  const { data, error } = await client
    .from("telnyx_mcp_servers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data as McpServerRecord[];
}

export async function createMcpServerAction(
  payload: McpServerCreateRequest
): Promise<McpServerRecord> {
  const tenantId = await getCurrentUserTenantId();
  if (!tenantId) {
    throw new Error("Tenant context missing");
  }

  await requirePermission("integrations.write", { tenantId });

  const client = await createTenantAwareServerClient(tenantId);
  const { data, error } = await client
    .from("telnyx_mcp_servers")
    .insert({
      tenant_id: tenantId,
      name: payload.name,
      server_url: payload.server_url,
      secret_ref: payload.secret_ref ?? null,
      description: payload.description ?? null,
    })
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

  const client = await createTenantAwareServerClient(tenantId);
  const { error } = await client.from("telnyx_mcp_servers").delete().eq("id", id);

  if (error) {
    throw error;
  }
}
