#!/usr/bin/env tsx
/**
 * Update campaign webhookUrl to a new URL.
 *
 * Usage (repo root):
 *   pnpm exec tsx apps/tenant/scripts/update-campaign-webhook-url.ts
 *
 * Or with custom URL:
 *   WEBHOOK_URL=https://example.com/draft pnpm exec tsx apps/tenant/scripts/update-campaign-webhook-url.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { createClient } from "@supabase/supabase-js";

const tenantEnv = path.join(__dirname, "../.env.local");
const rootEnv = path.join(__dirname, "../../../.env.local");
if (fs.existsSync(tenantEnv)) dotenv.config({ path: tenantEnv });
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv, override: false });

const NEW_URL =
  process.env.WEBHOOK_URL?.trim() ||
  "https://shopify-mcp-retell-integration-production-0355.up.railway.app/functions/shopify_send_draft_invoice";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function hasWebhookUrl(c: { settings?: Record<string, unknown> | null }): boolean {
  const s = c.settings;
  const url = (s?.webhookUrl as string) ?? (s?.railwayWebhookUrl as string) ?? "";
  return typeof url === "string" && url.trim().length > 0;
}

async function main() {
  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("id, name, settings");

  if (error) {
    console.error("Failed to fetch campaigns:", error.message);
    process.exit(1);
  }

  const toUpdate = (campaigns || []).filter(hasWebhookUrl);

  if (toUpdate.length === 0) {
    console.log("No campaigns found with webhookUrl set. Nothing to update.");
    return;
  }

  console.log(`Updating ${toUpdate.length} campaign(s) to:`);
  console.log(`  ${NEW_URL}`);
  console.log("");
  for (const c of toUpdate) {
    console.log(`  - ${c.name} (${c.id})`);
  }
  console.log("");

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
