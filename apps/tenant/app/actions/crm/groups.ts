"use server";

import { createClient } from "@/core/database/server";
import { getTenantForCrm } from "./tenant-helper";

export type ContactGroup = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  color: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  member_count?: number;
};

export type ContactGroupWithMembers = ContactGroup & {
  members: {
    id: string;
    contact_id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    email: string | null;
  }[];
};

/**
 * Get all contact groups for the current tenant with member counts
 */
export async function getContactGroups(): Promise<ContactGroup[]> {
  const tenantId = await getTenantForCrm();
  const supabase = await createClient();

  const { data, error } = await (supabase.from("contact_groups") as any)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching contact groups:", error);
    throw error;
  }

  // Get member counts
  const groups = (data || []) as ContactGroup[];
  if (groups.length === 0) return groups;

  const { data: counts } = await (supabase.from("contact_group_members") as any)
    .select("group_id")
    .eq("tenant_id", tenantId)
    .in(
      "group_id",
      groups.map((g) => g.id)
    );

  const countMap: Record<string, number> = {};
  for (const row of counts || []) {
    countMap[row.group_id] = (countMap[row.group_id] || 0) + 1;
  }

  return groups.map((g) => ({
    ...g,
    member_count: countMap[g.id] || 0,
  }));
}

/**
 * Get a single contact group with its members
 */
export async function getContactGroup(
  groupId: string
): Promise<ContactGroupWithMembers | null> {
  const tenantId = await getTenantForCrm();
  const supabase = await createClient();

  const { data: group, error } = await (supabase.from("contact_groups") as any)
    .select("*")
    .eq("id", groupId)
    .eq("tenant_id", tenantId)
    .single();

  if (error || !group) return null;

  const { data: memberRows } = await (
    supabase.from("contact_group_members") as any
  )
    .select("id, contact_id, contacts(first_name, last_name, phone, email)")
    .eq("group_id", groupId)
    .eq("tenant_id", tenantId);

  const members = (memberRows || []).map((m: any) => ({
    id: m.id,
    contact_id: m.contact_id,
    first_name: m.contacts?.first_name ?? "",
    last_name: m.contacts?.last_name ?? "",
    phone: m.contacts?.phone ?? null,
    email: m.contacts?.email ?? null,
  }));

  return { ...group, member_count: members.length, members };
}

/**
 * Create a new contact group
 */
export async function createContactGroup(input: {
  name: string;
  description?: string;
  color?: string;
}): Promise<{ ok: true; group: ContactGroup } | { ok: false; error: string }> {
  try {
    const tenantId = await getTenantForCrm();
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await (supabase.from("contact_groups") as any)
      .insert({
        tenant_id: tenantId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        color: input.color || "#6366f1",
        created_by: user?.id || null,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: "A group with this name already exists" };
      }
      return { ok: false, error: error.message };
    }

    return { ok: true, group: data as ContactGroup };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Update a contact group
 */
export async function updateContactGroup(
  groupId: string,
  updates: { name?: string; description?: string; color?: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const tenantId = await getTenantForCrm();
    const supabase = await createClient();

    const payload: Record<string, unknown> = {};
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.description !== undefined)
      payload.description = updates.description.trim() || null;
    if (updates.color !== undefined) payload.color = updates.color;

    const { error } = await (supabase.from("contact_groups") as any)
      .update(payload)
      .eq("id", groupId)
      .eq("tenant_id", tenantId);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Delete a contact group
 */
export async function deleteContactGroup(
  groupId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const tenantId = await getTenantForCrm();
    const supabase = await createClient();

    const { error } = await (supabase.from("contact_groups") as any)
      .delete()
      .eq("id", groupId)
      .eq("tenant_id", tenantId);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Add contacts to a group
 */
export async function addContactsToGroup(
  groupId: string,
  contactIds: string[]
): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  try {
    const tenantId = await getTenantForCrm();
    const supabase = await createClient();

    const rows = contactIds.map((contactId) => ({
      tenant_id: tenantId,
      group_id: groupId,
      contact_id: contactId,
    }));

    const { error, count } = await (
      supabase.from("contact_group_members") as any
    )
      .upsert(rows, { onConflict: "group_id,contact_id", ignoreDuplicates: true })
      .select("id");

    if (error) return { ok: false, error: error.message };
    return { ok: true, added: contactIds.length };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Remove a contact from a group
 */
export async function removeContactFromGroup(
  groupId: string,
  contactId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const tenantId = await getTenantForCrm();
    const supabase = await createClient();

    const { error } = await (supabase.from("contact_group_members") as any)
      .delete()
      .eq("group_id", groupId)
      .eq("contact_id", contactId)
      .eq("tenant_id", tenantId);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Get contacts in a group (for campaign import)
 */
export async function getGroupContacts(groupId: string): Promise<
  {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    email: string | null;
    mobile: string | null;
    tags: string[] | null;
  }[]
> {
  const tenantId = await getTenantForCrm();
  const supabase = await createClient();

  const { data, error } = await (
    supabase.from("contact_group_members") as any
  )
    .select(
      "contact_id, contacts(id, first_name, last_name, phone, email, mobile, tags)"
    )
    .eq("group_id", groupId)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("Error fetching group contacts:", error);
    return [];
  }

  return (data || [])
    .map((m: any) => m.contacts)
    .filter(Boolean);
}
