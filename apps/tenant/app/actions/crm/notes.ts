"use server";

import { createClient } from "@/core/database/server";
import { getCurrentTenant } from "@/core/multi-tenancy/server";
import { getTenantForCrm } from "./tenant-helper";
import { logNoteAdded } from "./activities";
// Temporary types until database types are regenerated
type Note = {
  id: string;
  tenant_id: string;
  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  title: string | null;
  content: string;
  type: "note" | "email" | "call" | "meeting" | "other";
  metadata: Record<string, any> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  contact?: any | null;
  company?: any | null;
  deal?: any | null;
};

/**
 * Get notes for a specific entity (contact, company, or deal)
 */
export async function getNotes(filters: {
  contact_id?: string;
  company_id?: string;
  deal_id?: string;
}): Promise<Note[]> {
  try {
    const tenantId = await getTenantForCrm();

  const supabase = await createClient();
  let query = (supabase.from("notes") as any)
    .select(`
      *,
      contact:contacts(*),
      company:companies(*),
      deal:deals(*)
    `)
    .eq("tenant_id", tenantId);

  if (filters.contact_id) {
    query = query.eq("contact_id", filters.contact_id);
  }

  if (filters.company_id) {
    query = query.eq("company_id", filters.company_id);
  }

  if (filters.deal_id) {
    query = query.eq("deal_id", filters.deal_id);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching notes:", error);
      throw error;
    }

    return (data as Note[]) || [];
  } catch (error: any) {
    // If no tenant found (Platform Admin with no tenants), return empty array
    if (error.message?.includes("No tenants found")) {
      console.warn("No tenant found for current user, returning empty notes list");
      return [];
    }
    throw error;
  }
}

/**
 * Create a new note
 */
export async function createNote(
  noteData: Omit<Note, "id" | "tenant_id" | "created_at" | "updated_at" | "created_by" | "contact" | "company" | "deal">
): Promise<Note> {
  const tenantId = await getTenantForCrm();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await (supabase.from("notes") as any)
    .insert({
      ...noteData,
      tenant_id: tenantId,
      created_by: user?.id || null,
    })
    .select(`
      *,
      contact:contacts(*),
      company:companies(*),
      deal:deals(*)
    `)
    .single();

  if (error) {
    console.error("Error creating note:", error);
    throw error;
  }

  // Log activity
  if (noteData.contact_id) {
    await logNoteAdded(data.id, "contact", noteData.contact_id);
  } else if (noteData.company_id) {
    await logNoteAdded(data.id, "company", noteData.company_id);
  } else if (noteData.deal_id) {
    await logNoteAdded(data.id, "deal", noteData.deal_id);
  }

  return data as Note;
}

/**
 * Update a note
 */
export async function updateNote(
  id: string,
  updates: Partial<Omit<Note, "id" | "tenant_id" | "created_at" | "created_by" | "contact" | "company" | "deal">>
): Promise<Note> {
  const tenantId = await getTenantForCrm();

  const supabase = await createClient();
  const { data, error } = await (supabase.from("notes") as any)
    .update(updates)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select(`
      *,
      contact:contacts(*),
      company:companies(*),
      deal:deals(*)
    `)
    .single();

  if (error) {
    console.error("Error updating note:", error);
    throw error;
  }

  return data as Note;
}

/**
 * Delete a note
 */
export async function deleteNote(id: string): Promise<void> {
  const tenantId = await getTenantForCrm();

  const supabase = await createClient();
  const { error } = await (supabase.from("notes") as any)
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("Error deleting note:", error);
    throw error;
  }
}
