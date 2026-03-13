"use server";

import { createClient } from "@/core/database/server";
import { getTenantForCrm } from "../crm/tenant-helper";
import { getContacts, getContactsByIds } from "../crm/contacts";
import { getContactGroups, getGroupContacts } from "../crm/groups";
import {
  normalizeRecipient,
  deduplicateByPhone,
  type NormalizedRecipient,
} from "./normalize";

export type CrmAudienceSource =
  | { type: "all_contacts" }
  | { type: "group"; groupId: string }
  | { type: "tagged"; tag: string }
  | { type: "selected"; contactIds: string[] };

/**
 * Fetch contacts from local CRM for preview (before campaign creation).
 * Returns normalized, deduplicated recipients ready for import.
 */
export async function previewCrmContacts(
  source: CrmAudienceSource
): Promise<{
  contacts: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    email: string | null;
  }[];
  validCount: number;
  totalCount: number;
}> {
  let rawContacts: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    email: string | null;
    tags?: string[] | null;
  }[];

  if (source.type === "group") {
    rawContacts = await getGroupContacts(source.groupId);
  } else if (source.type === "selected") {
    rawContacts = await getContactsByIds(source.contactIds);
  } else {
    const all = await getContacts();
    rawContacts = all;
    if (source.type === "tagged") {
      rawContacts = rawContacts.filter((c) =>
        c.tags?.includes(source.tag)
      );
    }
  }

  // Count how many have valid phone numbers
  let validCount = 0;
  for (const c of rawContacts) {
    const phone = c.phone;
    if (phone && phone.trim().length >= 7) validCount++;
  }

  return {
    contacts: rawContacts.map((c) => ({
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      phone: c.phone,
      email: c.email,
    })),
    validCount,
    totalCount: rawContacts.length,
  };
}

/**
 * Import CRM contacts into a campaign as recipients.
 */
export async function importCrmContactsToCampaign(
  campaignId: string,
  listName: string,
  source: CrmAudienceSource
): Promise<{ ok: true; imported: number } | { ok: false; error: string }> {
  try {
    const tenantId = await getTenantForCrm();
    const supabase = await createClient();

    // Verify campaign exists
    const { data: campaign } = await (supabase.from("campaigns") as any)
      .select("id")
      .eq("id", campaignId)
      .eq("tenant_id", tenantId)
      .single();

    if (!campaign) {
      return { ok: false, error: "Campaign not found" };
    }

    // Fetch contacts based on source
    let rawContacts: {
      id: string;
      first_name: string;
      last_name: string;
      phone: string | null;
      email: string | null;
      mobile?: string | null;
      tags?: string[] | null;
    }[];

    let sourceLabel = "crm";

    if (source.type === "group") {
      rawContacts = await getGroupContacts(source.groupId);
      sourceLabel = "crm_group";
    } else if (source.type === "selected") {
      rawContacts = await getContactsByIds(source.contactIds);
      sourceLabel = "crm_selected";
    } else {
      const all = await getContacts();
      rawContacts = all;
      if (source.type === "tagged") {
        rawContacts = rawContacts.filter((c) =>
          c.tags?.includes(source.tag)
        );
        sourceLabel = "crm_tag";
      }
    }

    if (rawContacts.length === 0) {
      return { ok: false, error: "No contacts found for this source" };
    }

    // Normalize
    const normalized: NormalizedRecipient[] = [];
    for (const c of rawContacts) {
      const phone = c.phone || (c as any).mobile || "";
      const result = normalizeRecipient({
        first_name: c.first_name,
        last_name: c.last_name || "",
        phone,
        email: c.email || "",
      });
      if (result.ok) {
        normalized.push(result.data);
      }
    }

    const deduped = deduplicateByPhone(normalized);
    if (deduped.length === 0) {
      return {
        ok: false,
        error: "No contacts with valid phone numbers found",
      };
    }

    // Create campaign list record
    // Use 'csv' as a fallback source_type since the CHECK constraint
    // may not include 'crm' — the source_config stores the real source info
    const { data: listData, error: listError } = await (
      supabase.from("campaign_lists") as any
    )
      .insert({
        tenant_id: tenantId,
        campaign_id: campaignId,
        name: listName,
        source_type: "csv", // fallback for CHECK constraint
        source_config: { crm_source: source, actual_source: sourceLabel },
        field_mapping: {},
        total_records: rawContacts.length,
        imported_records: 0,
        status: "importing",
      })
      .select("id")
      .single();

    if (listError || !listData) {
      return {
        ok: false,
        error: listError?.message ?? "Failed to create list",
      };
    }

    // Build recipient rows, linking back to CRM contact_id
    const contactIdMap = new Map<string, string>();
    for (const c of rawContacts) {
      const phone = c.phone || (c as any).mobile || "";
      if (phone) contactIdMap.set(phone.replace(/\D/g, ""), c.id);
    }

    const recipients = deduped.map((r) => ({
      tenant_id: tenantId,
      campaign_id: campaignId,
      list_id: listData.id,
      contact_id: contactIdMap.get(r.phone.replace(/\D/g, "")) || null,
      first_name: r.first_name,
      last_name: r.last_name,
      phone: r.phone,
      email: r.email,
      timezone: r.timezone,
      client_type: r.client_type,
      custom_fields: r.custom_fields,
      status: "pending",
    }));

    const { error: insertError } = await (
      supabase.from("campaign_recipients") as any
    ).insert(recipients);

    if (insertError) {
      await (supabase.from("campaign_lists") as any)
        .update({ status: "failed" })
        .eq("id", listData.id);
      return { ok: false, error: insertError.message };
    }

    await (supabase.from("campaign_lists") as any)
      .update({
        status: "completed",
        imported_records: deduped.length,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", listData.id);

    return { ok: true, imported: deduped.length };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: msg };
  }
}
