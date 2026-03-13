"use server";

import Papa from "papaparse";
import ExcelJS from "exceljs";

export type ParseResult = {
  rows: Record<string, unknown>[];
  headers: string[];
  errors: string[];
};

/**
 * Parse uploaded file from FormData (for use in server actions).
 */
export async function parseFileFromFormData(
  formData: FormData
): Promise<ParseResult | null> {
  const file = formData.get("file") as File | null;
  if (!file) return null;
  const ext = file.name.split(".").pop()?.toLowerCase();
  const type =
    ext === "csv" ? "csv" : ["xlsx", "xls"].includes(ext ?? "") ? "excel" : null;
  if (!type) return null;
  const buffer = Buffer.from(await file.arrayBuffer());
  return parseFileContent(buffer, file.name, type);
}

/**
 * Parse CSV or Excel file content into rows with headers.
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

