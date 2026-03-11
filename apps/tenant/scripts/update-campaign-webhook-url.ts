#!/usr/bin/env tsx
/**
 * Update campaign webhookUrl from root to /draft-orders for psd-custom-function-staging.
 *
 * Usage (repo root):
 *   pnpm exec tsx apps/tenant/scripts/update-campaign-webhook-url.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { createClient } from "@supabase/supabase-js";

const tenantEnv = path.join(__dirname, "../.env.local");
const rootEnv = path.join(__dirname, "../../../.env.local");
if (fs.existsSync(tenantEnv)) dotenv.config({ path: tenantEnv });
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv, override: false });

const OLD_BASE = "https://psd-custom-function-staging.up.railway.app";
const OLD_URL = `${OLD_BASE}/`;
const NEW_URL = `${OLD_BASE}/draft-orders`;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function needsUpdate(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const u = url.trim();
  return (
    u === OLD_URL ||
    u === OLD_BASE ||
    (u.startsWith(OLD_BASE) && !u.startsWith(NEW_URL))
  );
}

async function main() {
  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("id, name, settings");

  if (error) {
    console.error("Failed to fetch campaigns:", error.message);
    process.exit(1);
  }

  const toUpdate = (campaigns || []).filter((c) => {
    const s = c.settings as Record<string, unknown> | null;
    const url =
      (s?.webhookUrl as string) ?? (s?.railwayWebhookUrl as string) ?? "";
    return needsUpdate(url);
  });

  if (toUpdate.length === 0) {
    console.log("No campaigns found with webhookUrl pointing at root. Nothing to update.");
    return;
  }

  console.log(`Found ${toUpdate.length} campaign(s) to update:`);
  for (const c of toUpdate) {
    console.log(`  - ${c.name} (${c.id})`);
  }

  for (const c of toUpdate) {
    const s = (c.settings as Record<string, unknown>) || {};
    const updated = {
      ...s,
      webhookUrl: NEW_URL,
    };
    delete (updated as Record<string, unknown>).railwayWebhookUrl;

    const { error: updErr } = await supabase
      .from("campaigns")
      .update({ settings: updated })
      .eq("id", c.id);

    if (updErr) {
      console.error(`Failed to update ${c.name}:`, updErr.message);
      process.exit(1);
    }
    console.log(`Updated: ${c.name}`);
  }

  console.log("Done.");
}

main();
