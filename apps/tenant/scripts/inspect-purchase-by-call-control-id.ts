#!/usr/bin/env tsx
/**
 * Inspect campaign_recipients.result.purchase for a given call_control_id.
 *
 * Usage (repo root):
 *   pnpm exec tsx apps/tenant/scripts/inspect-purchase-by-call-control-id.ts --callControlId <v3:...>
 *
 * Non-sensitive output (no phone, no email).
 */
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { createClient } from "@supabase/supabase-js";

// Load env: tenant .env.local first, then root .env.local
const tenantEnv = path.join(__dirname, "../.env.local");
const rootEnv = path.join(__dirname, "../../../.env.local");
if (fs.existsSync(tenantEnv)) dotenv.config({ path: tenantEnv });
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv, override: false });

function arg(name: string): string | null {
  const idx = process.argv.findIndex((a) => a === `--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1]!;
  return null;
}

const callControlId = (arg("callControlId") || "").trim();
if (!callControlId) {
  console.error("Missing --callControlId");
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function safeHost(url: unknown): string | null {
  if (typeof url !== "string" || !url.trim()) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

async function main() {
  const { data: r, error } = await (supabase.from("campaign_recipients") as any)
    .select("id, tenant_id, campaign_id, status, updated_at, result")
    .eq("call_control_id", callControlId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!r) {
    console.log("No campaign_recipient found for call_control_id (maybe different environment):");
    console.log(callControlId);
    return;
  }

  const purchase = r?.result && typeof r.result === "object" ? (r.result as any).purchase : null;
  const selectedCount = Array.isArray(purchase?.selectedProducts) ? purchase.selectedProducts.length : 0;
  const lineItemsSentCount = Array.isArray(purchase?.lineItemsSent) ? purchase.lineItemsSent.length : 0;
  const invoiceUrl = typeof purchase?.invoiceUrl === "string" ? purchase.invoiceUrl : "";

  console.log("Recipient:", r.id);
  console.log("Tenant:", r.tenant_id);
  console.log("Campaign:", r.campaign_id);
  console.log("Status:", r.status);
  console.log("Updated:", r.updated_at);
  console.log("");
  console.log("purchase state:");
  console.log("- hasPurchase:", purchase && typeof purchase === "object" ? "true" : "false");
  console.log("- selectedProductsCount:", selectedCount);
  console.log("- checkoutConfirmed:", purchase?.checkoutConfirmed === true ? "true" : "false");
  console.log("- checkoutConfirmedAt:", typeof purchase?.checkoutConfirmedAt === "string" ? purchase.checkoutConfirmedAt : "(none)");
  console.log("- lineItemsSentCount:", lineItemsSentCount);
  console.log("- invoiceHost:", safeHost(invoiceUrl) || "(none)");
  console.log("- invoiceUrlPersisted:", invoiceUrl ? "true" : "false");
}

main().catch((e) => {
  console.error("Inspect failed:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});

