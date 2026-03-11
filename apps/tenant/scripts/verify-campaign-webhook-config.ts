#!/usr/bin/env tsx
/**
 * Read-only verification: list campaign.settings.webhookUrl (and legacy railwayWebhookUrl).
 * Use to confirm Phase 2 will call the expected webhook.
 *
 * Usage (repo root):
 *   pnpm exec tsx apps/tenant/scripts/verify-campaign-webhook-config.ts
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (e.g. in .env.local)
 */
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { createClient } from "@supabase/supabase-js";

const tenantEnv = path.join(__dirname, "../.env.local");
const rootEnv = path.join(__dirname, "../../../.env.local");
if (fs.existsSync(tenantEnv)) dotenv.config({ path: tenantEnv });
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv, override: false });

const EXPECTED_WEBHOOK_URL =
  "https://shopify-mcp-retell-integration-staging.up.railway.app/draft-orders-konnect";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("id, name, settings");

  if (error) {
    console.error("Failed to fetch campaigns:", error.message);
    process.exit(1);
  }

  console.log("=== Campaign webhook config (Phase 2) ===\n");
  if (!campaigns?.length) {
    console.log("No campaigns found.");
    return;
  }

  let anyWithWebhook = 0;
  let matchingExpected = 0;
  let hasLegacy = 0;

  for (const c of campaigns) {
    const s = (c.settings as Record<string, unknown>) || {};
    const webhookUrl = typeof s.webhookUrl === "string" ? s.webhookUrl.trim() : "";
    const railwayWebhookUrl = typeof s.railwayWebhookUrl === "string" ? s.railwayWebhookUrl.trim() : "";
    const enablePurchase = s.enableProductPurchaseFlow === true;

    if (!webhookUrl && !railwayWebhookUrl) continue;
    anyWithWebhook++;

    if (railwayWebhookUrl) hasLegacy++;
    const effectiveUrl = webhookUrl || railwayWebhookUrl;
    const isExpected = effectiveUrl === EXPECTED_WEBHOOK_URL;
    if (isExpected) matchingExpected++;

    console.log(`Campaign: ${c.name} (${c.id})`);
    console.log(`  enableProductPurchaseFlow: ${enablePurchase}`);
    console.log(`  settings.webhookUrl: ${webhookUrl || "(not set)"}`);
    if (railwayWebhookUrl) console.log(`  settings.railwayWebhookUrl: ${railwayWebhookUrl} (legacy – should be removed)`);
    console.log(`  Effective URL (Phase 2): ${effectiveUrl}`);
    console.log(`  Matches expected: ${isExpected ? "YES" : "NO"}`);
    console.log("");
  }

  if (anyWithWebhook === 0) {
    console.log("No campaigns have webhookUrl or railwayWebhookUrl set.");
    return;
  }

  console.log("--- Summary ---");
  console.log(`Campaigns with webhook: ${anyWithWebhook}`);
  console.log(`Using expected URL: ${matchingExpected}`);
  console.log(`Still have railwayWebhookUrl: ${hasLegacy}`);
  if (matchingExpected === anyWithWebhook && hasLegacy === 0) {
    console.log("\n✅ All configured campaigns use the new webhook; no legacy key.");
  } else if (matchingExpected < anyWithWebhook) {
    console.log("\n⚠️ Some campaigns do not use the expected URL. Run update-campaign-webhook-url.ts to fix.");
  }
  if (hasLegacy > 0) {
    console.log("\n⚠️ Remove railwayWebhookUrl by running update-campaign-webhook-url.ts (it clears legacy on save).");
  }
}

main();
