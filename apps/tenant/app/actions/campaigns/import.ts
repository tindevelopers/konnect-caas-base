"use server";

import Papa from "papaparse";
import ExcelJS from "exceljs";
import { createClient } from "@/core/database/server";
import { getTenantForCrm } from "../crm/tenant-helper";
import {
  normalizeRecipient,
  deduplicateByPhone,
  type NormalizedRecipient,
  type CampaignRecipientInput,
} from "./normalize";

export type FieldMapping = {
  first_name: string;
  last_name?: string;
  phone: string;
  email?: string;
  timezone?: string;
  client_type?: string;
  [key: string]: string | undefined;
};

export type ParseResult = {
  rows: Record<string, unknown>[];
  headers: string[];
  errors: string[];
};

export type ImportPreview = {
  totalRows: number;
  validRows: number;
  duplicateCount: number;
  sample: NormalizedRecipient[];
  errors: string[];
};

/**
 * Parse uploaded file from FormData (for use in form actions)
 */
export async function parseFileFromFormData(
  formData: FormData
): Promise<ParseResult | null> {
  const file = formData.get("file") as File | null;
  if (!file) return null;
  const ext = file.name.split(".").pop()?.toLowerCase();
  const type = ext === "csv" ? "csv" : ["xlsx", "xls"].includes(ext ?? "") ? "excel" : null;
  if (!type) return null;
  const buffer = Buffer.from(await file.arrayBuffer());
  return parseFileContent(buffer, file.name, type);
}

/**
 * Parse CSV or Excel file content into rows with headers
 */
export async function parseFileContent(
  fileContent: Buffer | string,
  filename: string,
  type: "csv" | "excel"
): Promise<ParseResult> {
  const errors: string[] = [];

  if (type === "csv") {
    const str =
      typeof fileContent === "string"
        ? fileContent
        : new TextDecoder("utf-8").decode(fileContent);
    const result = Papa.parse<Record<string, unknown>>(str, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });
    if (result.errors.length) {
      errors.push(...result.errors.map((e) => e.message));
    }
    const headers = result.meta.fields ?? [];
    const rows = result.data;
    return { rows, headers, errors };
  }

  if (type === "excel") {
    const buffer =
      typeof fileContent === "string"
        ? Buffer.from(fileContent, "utf-8")
        : fileContent;
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ExcelJS accepts Node Buffer but types are strict
await workbook.xlsx.load(buffer as any);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return { rows: [], headers: [], errors: ["No sheet found in Excel file"] };
    }
    const rows: Record<string, unknown>[] = [];
    let headers: string[] = [];
    worksheet.eachRow((row, rowNumber) => {
      const values = row.values as (string | number | undefined)[];
      if (!values) return;
      const cells = values.slice(1); // ExcelJS uses 1-based index, first is empty
      if (rowNumber === 1) {
        headers = cells.map((c) => String(c ?? "").trim());
        return;
      }
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        obj[h] = cells[i] ?? "";
      });
      rows.push(obj);
    });
    return { rows, headers, errors };
  }

  return { rows: [], headers: [], errors: ["Unsupported file type"] };
}

/**
 * Map source columns to our schema and produce preview
 */
export async function previewImport(
  rows: Record<string, unknown>[],
  mapping: FieldMapping
): Promise<ImportPreview> {
  const errors: string[] = [];
  const normalized: NormalizedRecipient[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const input: CampaignRecipientInput = {
      first_name: "",
      last_name: "",
      phone: "",
      email: "",
      timezone: "",
      client_type: "",
    };
    for (const [target, source] of Object.entries(mapping)) {
      if (!source) continue;
      const val = row[source];
      if (val != null && val !== "") {
        (input as Record<string, unknown>)[target] = val;
      }
    }
    const result = normalizeRecipient(input);
    if (result.ok) {
      normalized.push(result.data);
    } else {
      errors.push(`Row ${i + 2}: ${result.error}`);
    }
  }

  const deduped = deduplicateByPhone(normalized);
  const duplicateCount = normalized.length - deduped.length;

  return {
    totalRows: rows.length,
    validRows: deduped.length,
    duplicateCount,
    sample: deduped.slice(0, 10),
    errors: errors.slice(0, 20),
  };
}

/**
 * Import recipients into a campaign from parsed and mapped data
 */
export async function importRecipientsAction(
  campaignId: string,
  listName: string,
  rows: Record<string, unknown>[],
  mapping: FieldMapping,
  sourceType: "csv" | "excel" | "google_sheets" | "airtable"
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

    const normalized: NormalizedRecipient[] = [];
    for (const row of rows) {
      const input: CampaignRecipientInput = {
        first_name: "",
        last_name: "",
        phone: "",
        email: "",
        timezone: "",
        client_type: "",
      };
      for (const [target, source] of Object.entries(mapping)) {
        if (!source) continue;
        const val = row[source];
        if (val != null && val !== "") {
          (input as Record<string, unknown>)[target] = val;
        }
      }
      const result = normalizeRecipient(input);
      if (result.ok) {
        normalized.push(result.data);
      }
    }

    const deduped = deduplicateByPhone(normalized);
    if (deduped.length === 0) {
      return { ok: false, error: "No valid recipients to import" };
    }

    const { data: listData, error: listError } = await (supabase.from(
      "campaign_lists"
    ) as any)
      .insert({
        tenant_id: tenantId,
        campaign_id: campaignId,
        name: listName,
        source_type: sourceType,
        source_config: {},
        field_mapping: mapping,
        total_records: rows.length,
        imported_records: 0,
        status: "importing",
      })
      .select("id")
      .single();

    if (listError || !listData) {
      return {
        ok: false,
        error: listError?.message ?? "Failed to create list record",
      };
    }

    const listId = listData.id;
    const recipients = deduped.map((r) => ({
      tenant_id: tenantId,
      campaign_id: campaignId,
      list_id: listId,
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
        .eq("id", listId);
      return { ok: false, error: insertError.message };
    }

    await (supabase.from("campaign_lists") as any)
      .update({
        status: "completed",
        imported_records: deduped.length,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", listId);

    return { ok: true, imported: deduped.length };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: msg };
  }
}
