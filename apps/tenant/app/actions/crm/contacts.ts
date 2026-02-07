"use server";

import { createClient } from "@/core/database/server";
import { getCurrentTenant } from "@/core/multi-tenancy/server";
import { getTenantForCrm } from "./tenant-helper";
import { logEntityCreated, logEntityUpdated, logEntityDeleted } from "./activities";

// Temporary types until database types are regenerated
type ContactRow = {
  id: string;
  tenant_id: string;
  company_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  job_title: string | null;
  department: string | null;
  address: Record<string, any> | null;
  avatar_url: string | null;
  tags: string[] | null;
  custom_fields: Record<string, any> | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type CompanyRow = {
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

type Contact = ContactRow & {
  company?: CompanyRow | null;
};

type ContactInsert = Omit<Contact, "id" | "tenant_id" | "created_at" | "updated_at" | "created_by" | "company">;

/**
 * Get all contacts for the current tenant
 */
export async function getContacts(): Promise<Contact[]> {
  try {
    const tenantId = await getTenantForCrm();

  const supabase = await createClient();
  const { data, error } = await (supabase.from("contacts") as any)
    .select(`
      *,
      company:companies(*)
    `)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching contacts:", error);
      throw error;
    }

    return (data as Contact[]) || [];
  } catch (error: any) {
    // If no tenant found (Platform Admin with no tenants), return empty array
    if (error.message?.includes("No tenants found")) {
      console.warn("No tenant found for current user, returning empty contacts list");
      return [];
    }
    throw error;
  }
}

/**
 * Get a single contact by ID
 */
export async function getContact(id: string): Promise<Contact | null> {
  const tenantId = await getTenantForCrm();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select(`
      *,
      company:companies(*)
    `)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (error) {
    console.error("Error fetching contact:", error);
    throw error;
  }

  return data as Contact | null;
}

/**
 * Create a new contact
 */
export async function createContact(
  contactData: ContactInsert
): Promise<Contact> {
  const tenantId = await getTenantForCrm();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await (supabase.from("contacts") as any)
    .insert({
      ...contactData,
      tenant_id: tenantId,
      created_by: user?.id || null,
    })
    .select(`
      *,
      company:companies(*)
    `)
    .single();

  if (error) {
    console.error("Error creating contact:", error);
    throw error;
  }

  // Log activity
  const contactName = `${data.first_name} ${data.last_name}`;
  await logEntityCreated("contact", data.id, contactName);

  return data as Contact;
}

/**
 * Update a contact
 */
export async function updateContact(
  id: string,
  updates: Partial<Omit<Contact, "id" | "tenant_id" | "created_at" | "created_by" | "company">>
): Promise<Contact> {
  const tenantId = await getTenantForCrm();

  const supabase = await createClient();
  const { data, error } = await (supabase.from("contacts") as any)
    .update(updates)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select(`
      *,
      company:companies(*)
    `)
    .single();

  if (error) {
    console.error("Error updating contact:", error);
    throw error;
  }

  // Log activity
  const contactName = `${data.first_name} ${data.last_name}`;
  await logEntityUpdated("contact", id, contactName, updates);

  return data as Contact;
}

/**
 * Delete a contact
 */
export async function deleteContact(id: string): Promise<void> {
  const tenantId = await getTenantForCrm();

  // Get contact name before deletion for activity log
  const supabase = await createClient();
  const { data: contact } = await (supabase.from("contacts") as any)
    .select("first_name, last_name")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  const { error } = await (supabase.from("contacts") as any)
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("Error deleting contact:", error);
    throw error;
  }

  // Log activity
  if (contact) {
    const contactName = `${contact.first_name} ${contact.last_name}`;
    await logEntityDeleted("contact", id, contactName);
  }
}
