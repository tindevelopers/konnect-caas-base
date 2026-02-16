"use server";

import { createClient } from "@/core/database/server";
import { getTenantForCrm } from "../crm/tenant-helper";
import {
  importRecipientsAction,
  type FieldMapping,
} from "./import";
export type GoogleSheetsConfig = {
  sheetId: string;
  range?: string;
  apiKey?: string;
};

/**
 * Fetch data from a public Google Sheet (no auth required).
 * For private sheets, use a service account or OAuth - not implemented here.
 */
async function fetchPublicSheet(
  sheetId: string,
  range: string = "Sheet1!A:Z"
): Promise<Record<string, unknown>[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${process.env.GOOGLE_SHEETS_API_KEY ?? ""}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google Sheets API error: ${res.status}`);
  }
  const data = (await res.json()) as { values?: unknown[][] };
  const values = data.values ?? [];
  if (values.length < 2) return [];

  const headers = values[0].map((h) => String(h ?? "").trim());
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < values.length; i++) {
    const row: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      const val = values[i][j];
      if (headers[j] && val != null) {
        row[headers[j]] = String(val).trim();
      }
    }
    if (Object.keys(row).length > 0) {
      rows.push(row);
    }
  }
  return rows;
}

/**
 * Import recipients from a Google Sheet into a campaign.
 * Requires GOOGLE_SHEETS_API_KEY for non-public sheets.
 * For public sheets, the sheet must be published to web.
 */
export async function importFromGoogleSheetsAction(
  campaignId: string,
  listName: string,
  config: GoogleSheetsConfig,
  mapping: FieldMapping
): Promise<{ ok: true; imported: number } | { ok: false; error: string }> {
  try {
    const rows = await fetchPublicSheet(config.sheetId, config.range);
    if (rows.length === 0) {
      return { ok: false, error: "No data found in sheet" };
    }
    return importRecipientsAction(
      campaignId,
      listName,
      rows,
      mapping,
      "google_sheets"
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: msg };
  }
}

/**
 * Preview data from a Google Sheet (headers + sample rows).
 */
export async function previewGoogleSheetAction(
  sheetId: string,
  range?: string
): Promise<{
  ok: true;
  headers: string[];
  rows: Record<string, unknown>[];
} | { ok: false; error: string }> {
  try {
    const rows = await fetchPublicSheet(sheetId, range);
    const headers = rows.length ? Object.keys(rows[0]) : [];
    return { ok: true, headers, rows };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: msg };
  }
}
