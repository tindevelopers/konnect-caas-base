"use server";

import {
  importRecipientsAction,
  type FieldMapping,
} from "./import";

export type AirtableConfig = {
  baseId: string;
  tableIdOrName: string;
  viewIdOrName?: string;
  apiToken: string;
};

/**
 * Fetch records from an Airtable base/table.
 */
async function fetchAirtableRecords(config: AirtableConfig): Promise<Record<string, unknown>[]> {
  const baseUrl = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(config.tableIdOrName)}`;
  const params = new URLSearchParams();
  if (config.viewIdOrName) {
    params.set("view", config.viewIdOrName);
  }
  const url = params.toString() ? `${baseUrl}?${params}` : baseUrl;

  const rows: Record<string, unknown>[] = [];
  let offset: string | undefined;

  do {
    const reqUrl = offset ? `${url}${url.includes("?") ? "&" : "?"}offset=${offset}` : url;
    const res = await fetch(reqUrl, {
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
      },
    });
    if (!res.ok) {
      throw new Error(`Airtable API error: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as {
      records?: { id: string; fields: Record<string, unknown> }[];
      offset?: string;
    };
    for (const rec of data.records ?? []) {
      rows.push(rec.fields);
    }
    offset = data.offset;
  } while (offset);

  return rows;
}

/**
 * Import recipients from Airtable into a campaign.
 * Requires Airtable Personal Access Token (create at airtable.com/create/tokens).
 */
export async function importFromAirtableAction(
  campaignId: string,
  listName: string,
  config: AirtableConfig,
  mapping: FieldMapping
): Promise<{ ok: true; imported: number } | { ok: false; error: string }> {
  try {
    const rows = await fetchAirtableRecords(config);
    if (rows.length === 0) {
      return { ok: false, error: "No records found in Airtable" };
    }
    return importRecipientsAction(
      campaignId,
      listName,
      rows,
      mapping,
      "airtable"
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: msg };
  }
}

/**
 * Preview Airtable table (field names + sample records).
 */
export async function previewAirtableAction(
  config: AirtableConfig
): Promise<{
  ok: true;
  headers: string[];
  rows: Record<string, unknown>[];
} | { ok: false; error: string }> {
  try {
    const rows = await fetchAirtableRecords(config);
    const allKeys = new Set<string>();
    for (const r of rows) {
      for (const k of Object.keys(r)) {
        allKeys.add(k);
      }
    }
    const headers = [...allKeys];
    return { ok: true, headers, rows };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: msg };
  }
}
