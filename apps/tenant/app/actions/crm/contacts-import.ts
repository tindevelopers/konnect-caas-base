"use server";

import { createClient } from "@/core/database/server";
import { getTenantForCrm } from "./tenant-helper";

export type ContactFieldMapping = {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  job_title?: string;
  department?: string;
  company_name?: string;
  [key: string]: string | undefined;
};

export type ContactsImportPreviewRow = {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  job_title: string | null;
  department: string | null;
  company_name: string | null;
};

export type ContactsImportPreview = {
  totalRows: number;
  validRows: number;
  duplicateCount: number;
  sample: ContactsImportPreviewRow[];
  errors: string[];
};

function asTrimmedString(val: unknown): string {
  if (val == null) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number") return String(val).trim();
  return String(val).trim();
}

function toNullable(val: string): string | null {
  const v = val.trim();
  return v ? v : null;
}

function dedupeKey(row: ContactsImportPreviewRow): string {
  const email = (row.email ?? "").trim().toLowerCase();
  if (email) return `email:${email}`;
  const mobile = (row.mobile ?? "").trim();
  if (mobile) return `mobile:${mobile}`;
  const phone = (row.phone ?? "").trim();
  if (phone) return `phone:${phone}`;
  return `name:${row.first_name.toLowerCase()}|${row.last_name.toLowerCase()}`;
}

export async function previewContactsImport(
  rows: Record<string, unknown>[],
  mapping: ContactFieldMapping
): Promise<ContactsImportPreview> {
  const errors: string[] = [];
  const normalized: ContactsImportPreviewRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? {};
    const first = mapping.first_name ? asTrimmedString(row[mapping.first_name]) : "";
    const last = mapping.last_name ? asTrimmedString(row[mapping.last_name]) : "";

    if (!first) {
      errors.push(`Row ${i + 2}: Missing first name`);
      continue;
    }
    if (!last) {
      errors.push(`Row ${i + 2}: Missing last name`);
      continue;
    }

    const out: ContactsImportPreviewRow = {
      first_name: first,
      last_name: last,
      email: mapping.email ? toNullable(asTrimmedString(row[mapping.email])) : null,
      phone: mapping.phone ? toNullable(asTrimmedString(row[mapping.phone])) : null,
      mobile: mapping.mobile ? toNullable(asTrimmedString(row[mapping.mobile])) : null,
      job_title: mapping.job_title
        ? toNullable(asTrimmedString(row[mapping.job_title]))
        : null,
      department: mapping.department
        ? toNullable(asTrimmedString(row[mapping.department]))
        : null,
      company_name: mapping.company_name
        ? toNullable(asTrimmedString(row[mapping.company_name]))
        : null,
    };

    normalized.push(out);
  }

  const seen = new Set<string>();
  const deduped: ContactsImportPreviewRow[] = [];
  for (const r of normalized) {
    const key = dedupeKey(r);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }

  return {
    totalRows: rows.length,
    validRows: deduped.length,
    duplicateCount: normalized.length - deduped.length,
    sample: deduped.slice(0, 10),
    errors: errors.slice(0, 20),
  };
}

export async function importContactsAction(args: {
  rows: Record<string, unknown>[];
  mapping: ContactFieldMapping;
  createMissingCompanies?: boolean;
}): Promise<
  | { ok: true; imported: number; skipped: number; companiesCreated: number }
  | { ok: false; error: string }
> {
  try {
    const tenantId = await getTenantForCrm();
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const createMissingCompanies = args.createMissingCompanies ?? true;

    const preview = await previewContactsImport(args.rows, args.mapping);
    if (preview.validRows === 0) {
      return {
        ok: false,
        error:
          preview.errors[0] ??
          "No valid contacts found. Ensure first name and last name are mapped correctly.",
      };
    }

    // Resolve company IDs (optional)
    let companiesCreated = 0;
    const companyIdByLowerName = new Map<string, string>();

    if (args.mapping.company_name) {
      const { data: existingCompanies, error: companiesErr } = await (supabase.from(
        "companies"
      ) as any)
        .select("id,name")
        .eq("tenant_id", tenantId);

      if (companiesErr) {
        return { ok: false, error: companiesErr.message };
      }

      for (const c of (existingCompanies ?? []) as Array<{ id: string; name: string }>) {
        const key = String(c.name ?? "").trim().toLowerCase();
        if (!key) continue;
        if (!companyIdByLowerName.has(key)) companyIdByLowerName.set(key, c.id);
      }

      const wantedNames = new Map<string, string>(); // lower -> original
      for (const raw of args.rows) {
        const name = asTrimmedString(raw[args.mapping.company_name]);
        const lower = name.trim().toLowerCase();
        if (!lower) continue;
        if (!wantedNames.has(lower)) wantedNames.set(lower, name.trim());
      }

      const missing: Array<{ lower: string; name: string }> = [];
      for (const [lower, name] of wantedNames.entries()) {
        if (!companyIdByLowerName.has(lower)) missing.push({ lower, name });
      }

      if (createMissingCompanies && missing.length > 0) {
        for (const m of missing) {
          const { data: created, error: createErr } = await (supabase.from(
            "companies"
          ) as any)
            .insert({
              tenant_id: tenantId,
              name: m.name,
              created_by: user?.id || null,
            })
            .select("id,name")
            .single();

          if (!createErr && created?.id) {
            companiesCreated += 1;
            const key = String(created.name ?? "").trim().toLowerCase();
            if (key) companyIdByLowerName.set(key, created.id);
          }
        }
      }
    }

    // Build inserts from full dataset (deduped)
    const inserts: Array<Record<string, unknown>> = [];
    const seen = new Set<string>();

    for (let i = 0; i < args.rows.length; i++) {
      const row = args.rows[i] ?? {};
      const first = args.mapping.first_name ? asTrimmedString(row[args.mapping.first_name]) : "";
      const last = args.mapping.last_name ? asTrimmedString(row[args.mapping.last_name]) : "";

      if (!first || !last) {
        continue;
      }

      const normalized: ContactsImportPreviewRow = {
        first_name: first,
        last_name: last,
        email: args.mapping.email ? toNullable(asTrimmedString(row[args.mapping.email])) : null,
        phone: args.mapping.phone ? toNullable(asTrimmedString(row[args.mapping.phone])) : null,
        mobile: args.mapping.mobile ? toNullable(asTrimmedString(row[args.mapping.mobile])) : null,
        job_title: args.mapping.job_title
          ? toNullable(asTrimmedString(row[args.mapping.job_title]))
          : null,
        department: args.mapping.department
          ? toNullable(asTrimmedString(row[args.mapping.department]))
          : null,
        company_name: args.mapping.company_name
          ? toNullable(asTrimmedString(row[args.mapping.company_name]))
          : null,
      };

      const key = dedupeKey(normalized);
      if (seen.has(key)) continue;
      seen.add(key);

      const companyLower = (normalized.company_name ?? "").trim().toLowerCase();
      const companyId = companyLower ? companyIdByLowerName.get(companyLower) : undefined;

      inserts.push({
        tenant_id: tenantId,
        created_by: user?.id || null,
        first_name: normalized.first_name,
        last_name: normalized.last_name,
        email: normalized.email,
        phone: normalized.phone,
        mobile: normalized.mobile,
        job_title: normalized.job_title,
        department: normalized.department,
        company_id: companyId ?? null,
      });
    }

    if (inserts.length === 0) {
      return { ok: false, error: "No valid contacts to import" };
    }

    const { error: insertErr } = await (supabase.from("contacts") as any).insert(inserts);
    if (insertErr) {
      return { ok: false, error: insertErr.message };
    }

    const skipped = args.rows.length - inserts.length;
    return { ok: true, imported: inserts.length, skipped, companiesCreated };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: msg };
  }
}

