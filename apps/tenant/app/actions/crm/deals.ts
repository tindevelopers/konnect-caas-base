"use server";

import { createClient } from "@/core/database/server";
import { getCurrentTenant } from "@/core/multi-tenancy/server";
import { getTenantForCrm } from "./tenant-helper";
import { logEntityCreated, logEntityUpdated, logEntityDeleted } from "./activities";
// Temporary types until database types are regenerated
type DealStage = {
  id: string;
  tenant_id: string;
  name: string;
  position: number;
  color: string;
  is_closed: boolean;
  created_at: string;
};

type Deal = {
  id: string;
  tenant_id: string;
  contact_id: string | null;
  company_id: string | null;
  name: string;
  stage_id: string;
  value: number;
  currency: string;
  probability: number | null;
  expected_close_date: string | null;
  actual_close_date: string | null;
  description: string | null;
  tags: string[] | null;
  custom_fields: Record<string, any> | null;
  created_by: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  contact?: any | null;
  company?: any | null;
  stage?: DealStage | null;
};

/**
 * Get all deal stages for the current tenant
 */
export async function getDealStages(): Promise<DealStage[]> {
  try {
    const tenantId = await getTenantForCrm();

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("deal_stages")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("position", { ascending: true });

    if (error) {
      console.error("Error fetching deal stages:", error);
      throw error;
    }

    return (data as DealStage[]) || [];
  } catch (error: any) {
    // If no tenant found (Platform Admin with no tenants), return empty array
    if (error.message?.includes("No tenants found")) {
      console.warn("No tenant found for current user, returning empty deal stages list");
      return [];
    }
    throw error;
  }
}

/**
 * Create default deal stages for a tenant
 */
export async function createDefaultDealStages(): Promise<DealStage[]> {
  const tenantId = await getTenantForCrm();

  const defaultStages = [
    { name: "Lead", position: 0, color: "#94a3b8", is_closed: false },
    { name: "Qualified", position: 1, color: "#60a5fa", is_closed: false },
    { name: "Proposal", position: 2, color: "#a78bfa", is_closed: false },
    { name: "Negotiation", position: 3, color: "#f59e0b", is_closed: false },
    { name: "Won", position: 4, color: "#10b981", is_closed: true },
    { name: "Lost", position: 5, color: "#ef4444", is_closed: true },
  ];

  const supabase = await createClient();
  const stages = [];

  for (const stage of defaultStages) {
    const { data, error } = await (supabase.from("deal_stages") as any)
      .insert({
        ...stage,
        tenant_id: tenantId,
      })
      .select("*")
      .single();

    if (error && !error.message.includes("duplicate")) {
      console.error("Error creating deal stage:", error);
    } else if (data) {
      stages.push(data as DealStage);
    }
  }

  return stages;
}

/**
 * Get all deals for the current tenant
 */
export async function getDeals(): Promise<Deal[]> {
  try {
    const tenantId = await getTenantForCrm();

  const supabase = await createClient();
  const { data, error } = await (supabase.from("deals") as any)
    .select(`
      *,
      contact:contacts(*),
      company:companies(*),
      stage:deal_stages(*)
    `)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching deals:", error);
      throw error;
    }

    return (data as Deal[]) || [];
  } catch (error: any) {
    // If no tenant found (Platform Admin with no tenants), return empty array
    if (error.message?.includes("No tenants found")) {
      console.warn("No tenant found for current user, returning empty deals list");
      return [];
    }
    throw error;
  }
}

/**
 * Get deals grouped by stage (for Kanban board)
 */
export async function getDealsByStage(): Promise<Record<string, Deal[]>> {
  try {
    const deals = await getDeals();
    const grouped: Record<string, Deal[]> = {};

    deals.forEach((deal) => {
      const stageId = deal.stage_id;
      if (!grouped[stageId]) {
        grouped[stageId] = [];
      }
      grouped[stageId].push(deal);
    });

    return grouped;
  } catch (error: any) {
    // If no tenant found (Platform Admin with no tenants), return empty object
    if (error.message?.includes("No tenants found")) {
      console.warn("No tenant found for current user, returning empty deals by stage");
      return {};
    }
    throw error;
  }
}

/**
 * Get a single deal by ID
 */
export async function getDeal(id: string): Promise<Deal | null> {
  const tenantId = await getTenantForCrm();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals")
    .select(`
      *,
      contact:contacts(*),
      company:companies(*),
      stage:deal_stages(*)
    `)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (error) {
    console.error("Error fetching deal:", error);
    throw error;
  }

  return data as Deal | null;
}

/**
 * Create a new deal
 */
export async function createDeal(
  dealData: Omit<Deal, "id" | "tenant_id" | "created_at" | "updated_at" | "created_by" | "contact" | "company" | "stage">
): Promise<Deal> {
  const tenantId = await getTenantForCrm();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await (supabase.from("deals") as any)
    .insert({
      ...dealData,
      tenant_id: tenantId,
      created_by: user?.id || null,
    })
    .select(`
      *,
      contact:contacts(*),
      company:companies(*),
      stage:deal_stages(*)
    `)
    .single();

  if (error) {
    console.error("Error creating deal:", error);
    throw error;
  }

  // Log activity
  await logEntityCreated("deal", data.id, data.name);

  return data as Deal;
}

/**
 * Update a deal
 */
export async function updateDeal(
  id: string,
  updates: Partial<Omit<Deal, "id" | "tenant_id" | "created_at" | "created_by" | "contact" | "company" | "stage">>
): Promise<Deal> {
  const tenantId = await getCurrentTenant();
  if (!tenantId) {
    throw new Error("No tenant found");
  }

  const supabase = await createClient();
  const { data, error } = await (supabase.from("deals") as any)
    .update(updates)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select(`
      *,
      contact:contacts(*),
      company:companies(*),
      stage:deal_stages(*)
    `)
    .single();

  if (error) {
    console.error("Error updating deal:", error);
    throw error;
  }

  // Log activity (special handling for stage changes)
  if (updates.stage_id) {
    // This will be logged as a separate activity type if needed
  }
  await logEntityUpdated("deal", id, data.name, updates);

  return data as Deal;
}

/**
 * Delete a deal
 */
export async function deleteDeal(id: string): Promise<void> {
  const tenantId = await getTenantForCrm();

  // Get deal name before deletion for activity log
  const supabase = await createClient();
  const { data: deal } = await (supabase.from("deals") as any)
    .select("name")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  const { error } = await (supabase.from("deals") as any)
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("Error deleting deal:", error);
    throw error;
  }

  // Log activity
  if (deal) {
    await logEntityDeleted("deal", id, deal.name);
  }
}
