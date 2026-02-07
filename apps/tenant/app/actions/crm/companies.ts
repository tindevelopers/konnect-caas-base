"use server";

import { createClient } from "@/core/database/server";
import { getCurrentTenant } from "@/core/multi-tenancy/server";
import { getTenantForCrm } from "./tenant-helper";
import { logEntityCreated, logEntityUpdated, logEntityDeleted } from "./activities";
// Temporary types until database types are regenerated
type Company = {
  id: string;
  tenant_id: string;
  name: string;
  website: string | null;
  industry: string | null;
  size: string | null;
  annual_revenue: number | null;
  description: string | null;
  address: Record<string, any> | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  tags: string[] | null;
  custom_fields: Record<string, any> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Get all companies for the current tenant
 */
export async function getCompanies(): Promise<Company[]> {
  try {
    const tenantId = await getTenantForCrm();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching companies:", error);
      throw error;
    }

    return (data as Company[]) || [];
  } catch (error: any) {
    // If no tenant found (Platform Admin with no tenants), return empty array
    if (error.message?.includes("No tenants found")) {
      console.warn("No tenant found for current user, returning empty companies list");
      return [];
    }
    throw error;
  }
}

/**
 * Get a single company by ID
 */
export async function getCompany(id: string): Promise<Company | null> {
  const tenantId = await getTenantForCrm();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (error) {
    console.error("Error fetching company:", error);
    throw error;
  }

  return data as Company | null;
}

/**
 * Create a new company
 */
export async function createCompany(
  companyData: Omit<Company, "id" | "tenant_id" | "created_at" | "updated_at" | "created_by">
): Promise<Company> {
  const tenantId = await getTenantForCrm();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await (supabase.from("companies") as any)
    .insert({
      ...companyData,
      tenant_id: tenantId,
      created_by: user?.id || null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Error creating company:", error);
    throw error;
  }

  return data as Company;
}

/**
 * Update a company
 */
export async function updateCompany(
  id: string,
  updates: Partial<Omit<Company, "id" | "tenant_id" | "created_at" | "created_by">>
): Promise<Company> {
  const tenantId = await getTenantForCrm();

  const supabase = await createClient();
  const { data, error } = await (supabase.from("companies") as any)
    .update(updates)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select("*")
    .single();

  if (error) {
    console.error("Error updating company:", error);
    throw error;
  }

  // Log activity
  await logEntityUpdated("company", id, data.name, updates);

  return data as Company;
}

/**
 * Delete a company
 */
export async function deleteCompany(id: string): Promise<void> {
  const tenantId = await getTenantForCrm();

  // Get company name before deletion for activity log
  const supabase = await createClient();
  const { data: company } = await (supabase.from("companies") as any)
    .select("name")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  const { error } = await (supabase.from("companies") as any)
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("Error deleting company:", error);
    throw error;
  }

  // Log activity
  if (company) {
    await logEntityDeleted("company", id, company.name);
  }
}
