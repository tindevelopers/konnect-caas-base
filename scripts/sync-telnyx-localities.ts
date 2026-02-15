#!/usr/bin/env tsx
/**
 * Sync Telnyx localities to Supabase for prefix search in Buy Numbers.
 * Run: pnpm exec tsx scripts/sync-telnyx-localities.ts
 *
 * Requires in .env.local:
 *   TELNYX_API_KEY - Telnyx API key (or platform integration)
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load env: tenant app uses apps/tenant/.env.local (often remote Supabase)
// Root .env.local has TELNYX_API_KEY. Load tenant first so its Supabase URL wins.
const tenantEnvPath = path.join(__dirname, "../apps/tenant/.env.local");
const rootEnvPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(tenantEnvPath)) {
  dotenv.config({ path: tenantEnvPath });
}
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath, override: false }); // don't overwrite tenant's Supabase
}

const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!TELNYX_API_KEY?.trim()) {
  console.error("❌ TELNYX_API_KEY is not set in .env.local");
  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY?.trim()) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY is not set in .env.local");
  process.exit(1);
}

const TELNYX_BASE = "https://api.telnyx.com/v2";

async function fetchLocalitiesFromTelnyx(
  countryCode: string,
  phoneNumberType?: string
): Promise<string[]> {
  const allGroups: string[] = [];
  let pageNumber = 1;
  const pageSize = 100;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({
      "filter[country_code]": countryCode,
      "filter[groupBy]": "locality",
      "page[number]": String(pageNumber),
      "page[size]": String(pageSize),
    });
    if (phoneNumberType?.trim()) {
      params.set("filter[phone_number_type]", phoneNumberType.trim());
    }

    const res = await fetch(`${TELNYX_BASE}/inventory_coverage?${params}`, {
      headers: { Authorization: `Bearer ${TELNYX_API_KEY}` },
    });

    if (!res.ok) {
      throw new Error(`Telnyx API error: ${res.status} ${await res.text()}`);
    }

    const json = (await res.json()) as {
      data?: Array<{ group?: string }>;
      meta?: { total_pages?: number };
    };
    const items = json.data ?? [];
    for (const x of items) {
      if (typeof x.group === "string" && x.group.length > 0) {
        allGroups.push(x.group);
      }
    }

    const totalPages = json.meta?.total_pages;
    hasMore = items.length >= pageSize && (totalPages === undefined || pageNumber < totalPages);
    pageNumber += 1;
  }

  return [...new Set(allGroups)].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const countries = [
    { code: "US", types: ["local", "toll_free"] as const },
    { code: "CA", types: ["local"] as const },
    { code: "GB", types: ["local", "toll_free", "national"] as const },
    { code: "IE", types: ["local"] as const },
    { code: "FR", types: ["local"] as const },
    { code: "DE", types: ["local"] as const },
    { code: "ES", types: ["local"] as const },
    { code: "IT", types: ["local"] as const },
    { code: "NL", types: ["local"] as const },
    { code: "BE", types: ["local"] as const },
    { code: "AT", types: ["local"] as const },
    { code: "CH", types: ["local"] as const },
    { code: "PT", types: ["local"] as const },
    { code: "LU", types: ["local"] as const },
    { code: "SE", types: ["local"] as const },
    { code: "NO", types: ["local"] as const },
    { code: "DK", types: ["local"] as const },
    { code: "FI", types: ["local"] as const },
  ];

  const rows: { country_code: string; locality: string; phone_number_type: string; source: string }[] = [];
  const seen = new Set<string>();

  for (const { code, types } of countries) {
    for (const phoneNumberType of types) {
      try {
        console.log(`Fetching localities for ${code} / ${phoneNumberType}...`);
        const localities = await fetchLocalitiesFromTelnyx(code, phoneNumberType);
        console.log(`  Found ${localities.length} localities`);
        for (const locality of localities) {
          const key = `${code}|${locality.trim()}|${phoneNumberType}`;
          if (seen.has(key)) continue;
          seen.add(key);
          rows.push({
            country_code: code,
            locality: locality.trim(),
            phone_number_type: phoneNumberType,
            source: "telnyx",
          });
        }
      } catch (err) {
        console.warn(`  Skipped ${code}/${phoneNumberType}:`, (err as Error).message);
      }
    }
  }

  console.log(`\nUpserting ${rows.length} localities (Telnyx inventory only)...`);

  const { error } = await supabase.from("telnyx_localities").upsert(rows, {
    onConflict: "country_code,locality,phone_number_type,source",
    ignoreDuplicates: false,
  });

  if (error) {
    console.error("❌ Supabase upsert error:", error);
    process.exit(1);
  }

  console.log("✅ Sync complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
