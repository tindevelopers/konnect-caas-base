"use server";

import { createClient } from "@/core/database/server";
import { getTenantForCrm } from "../crm/tenant-helper";
import { getIntegrationConfig } from "@/core/integrations";
import { GoHighLevelProvider } from "../../../../../packages/integrations/crm/providers/gohighlevel-provider";
import {
  normalizeRecipient,
  deduplicateByPhone,
  type NormalizedRecipient,
} from "./normalize";

export type CrmSyncConfig = {
  provider: "gohighlevel" | "hubspot" | "salesforce" | "pipedrive";
  tagFilter?: string;
  listId?: string;
};

/**
 * Sync contacts from a connected CRM into campaign recipients.
 * Currently supports GoHighLevel. HubSpot, Salesforce, Pipedrive require
 * provider implementations to be added.
 */
export async function syncCrmToCampaignAction(
  campaignId: string,
  listName: string,
  config: CrmSyncConfig
): Promise<{ ok: true; imported: number } | { ok: false; error: string }> {
  try {
    const tenantId = await getTenantForCrm();
    const supabase = await createClient();

    const { data: campaign } = await (supabase.from("campaigns") as any)
      .select("id")
      .eq("id", campaignId)
      .eq("tenant_id", tenantId)
      .single();

    if (!campaign) {
      return { ok: false, error: "Campaign not found" };
    }

    if (config.provider !== "gohighlevel") {
      return {
        ok: false,
        error: `${config.provider} sync is not yet implemented. Only GoHighLevel is supported.`,
      };
    }

    const integration = await getIntegrationConfig(tenantId, "gohighlevel");
    if (!integration?.credentials) {
      return { ok: false, error: "GoHighLevel integration not configured" };
    }

    const provider = new GoHighLevelProvider();
    await provider.initialize({
      provider: "gohighlevel",
      credentials: integration.credentials as Record<string, unknown>,
    });

    const contacts = await provider.listContacts?.();
    if (!contacts?.length) {
      return { ok: false, error: "No contacts found in CRM" };
    }

    const normalized: NormalizedRecipient[] = [];
    for (const c of contacts) {
      const result = normalizeRecipient({
        first_name: c.firstName,
        last_name: c.lastName ?? "",
        phone: c.phone ?? "",
        email: c.email ?? "",
        timezone: (c.metadata as Record<string, unknown>)?.timezone as string | undefined,
        client_type: (c.metadata as Record<string, unknown>)?.clientType as string | undefined,
      });
      if (result.ok) {
        normalized.push(result.data);
      }
    }

    const deduped = deduplicateByPhone(normalized);
    if (deduped.length === 0) {
      return { ok: false, error: "No valid recipients with phone numbers" };
    }

    const { data: listData, error: listError } = await (supabase.from(
      "campaign_lists"
    ) as any)
      .insert({
        tenant_id: tenantId,
        campaign_id: campaignId,
        name: listName,
        source_type: config.provider,
        source_config: config,
        field_mapping: {},
        total_records: contacts.length,
        imported_records: 0,
        status: "importing",
      })
      .select("id")
      .single();

    if (listError || !listData) {
      return { ok: false, error: listError?.message ?? "Failed to create list" };
    }

    const recipients = deduped.map((r) => ({
      tenant_id: tenantId,
      campaign_id: campaignId,
      list_id: listData.id,
      first_name: r.first_name,
      last_name: r.last_name,
      phone: r.phone,
      email: r.email,
      timezone: r.timezone,
      client_type: r.client_type,
      custom_fields: r.custom_fields,
      status: "pending",
    }));

    const { error: insertError } = await (supabase.from(
      "campaign_recipients"
    ) as any).insert(recipients);

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
