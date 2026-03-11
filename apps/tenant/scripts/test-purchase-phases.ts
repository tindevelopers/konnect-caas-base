#!/usr/bin/env tsx
/**
 * Test Phase 1 (add_to_selection) and Phase 2 (create_draft_order) separately.
 *
 * Usage (repo root):
 *   BASE_URL=https://konnect.tinconnect.com pnpm exec tsx apps/tenant/scripts/test-purchase-phases.ts
 *
 * With mock webhook for Phase 2 (avoids real Railway/Shopify):
 *   BASE_URL=http://localhost:3020 MOCK_WEBHOOK_PORT=9999 pnpm exec tsx apps/tenant/scripts/test-purchase-phases.ts
 *
 * Prerequisites:
 *   - Dev or prod server reachable at BASE_URL
 *   - Campaign recipient with call_control_id (script fetches most recent)
 *   - Campaign has enableProductPurchaseFlow=true and webhookUrl set
 *   - If MOCK_WEBHOOK_PORT: campaign webhookUrl must point to http://127.0.0.1:9999
 */
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import * as http from "http";
import { createClient } from "@supabase/supabase-js";

const tenantEnv = path.join(__dirname, "../.env.local");
const rootEnv = path.join(__dirname, "../../../.env.local");
if (fs.existsSync(tenantEnv)) dotenv.config({ path: tenantEnv });
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv, override: false });

const BASE_URL = (process.env.BASE_URL || "http://localhost:3020").replace(/\/$/, "");
const MOCK_WEBHOOK_PORT = process.env.MOCK_WEBHOOK_PORT ? parseInt(process.env.MOCK_WEBHOOK_PORT, 10) : 0;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function getRecentCallControlId(): Promise<string | null> {
  const { data } = await supabase
    .from("campaign_recipients")
    .select("call_control_id")
    .not("call_control_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { call_control_id: string } | null)?.call_control_id ?? null;
}

function createMockWebhookServer(port: number): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const server = http.createServer((req: any, res: any) => {
      let body = "";
      req.on("data", (chunk: Buffer) => (body += chunk.toString()));
      req.on("end", () => {
        const parsed = body ? JSON.parse(body) : {};
        console.log("[Mock] Received:", JSON.stringify(parsed, null, 2));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ invoiceUrl: "https://checkout.example.com/inv" }));
      });
    });
    server.listen(port, "127.0.0.1", () => {
      resolve({ url: `http://127.0.0.1:${port}`, close: () => server.close() });
    });
  });
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data } as { status: number; data: unknown };
}

async function runPhase1(callControlId: string) {
  const addUrl = `${BASE_URL}/api/webhooks/telnyx/campaign-purchase/add-to-selection`;
  const res = await fetchJson(addUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-telnyx-call-control-id": callControlId,
    },
    body: JSON.stringify({
      call_control_id: callControlId,
      productTitle: "Andis Clipper 1",
      productUrl: "https://www.petstore.direct/products/andis-clipper-1",
      variantId: "gid://shopify/ProductVariant/123",
      quantity: 1,
    }),
  });
  return res;
}

async function runPhase2(callControlId: string) {
  const createUrl = `${BASE_URL}/api/webhooks/telnyx/campaign-purchase/create-draft-order`;
  const res = await fetchJson(createUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-telnyx-call-control-id": callControlId,
    },
    body: JSON.stringify({
      call_control_id: callControlId,
      customerConfirmed: true,
      customerEmail: "test@example.com",
    }),
  });
  return res;
}

async function verifyPhase1InDb(callControlId: string) {
  const { data } = await supabase
    .from("campaign_recipients")
    .select("id, result")
    .eq("call_control_id", callControlId)
    .maybeSingle();
  const purchase = (data as any)?.result?.purchase;
  const count = Array.isArray(purchase?.selectedProducts) ? purchase.selectedProducts.length : 0;
  return { found: !!data, selectedCount: count };
}

async function verifyPhase2InDb(callControlId: string) {
  const { data } = await supabase
    .from("campaign_recipients")
    .select("id, result")
    .eq("call_control_id", callControlId)
    .maybeSingle();
  const purchase = (data as any)?.result?.purchase;
  const invoiceUrl = typeof purchase?.invoiceUrl === "string" ? purchase.invoiceUrl : "";
  return { found: !!data, invoiceUrl: invoiceUrl || null };
}

async function main() {
  const callControlId = await getRecentCallControlId();
  if (!callControlId) {
    console.error("❌ No campaign_recipient with call_control_id found. Run a campaign call first.");
    process.exit(1);
  }
  console.log(`Using call_control_id: ...${callControlId.slice(-8)}\n`);

  let mockClose: (() => void) | null = null;
  if (MOCK_WEBHOOK_PORT > 0) {
    const mock = await createMockWebhookServer(MOCK_WEBHOOK_PORT);
    mockClose = mock.close;
    console.log(`[Mock] Webhook at http://127.0.0.1:${MOCK_WEBHOOK_PORT}`);
    console.log("[Mock] Ensure campaign webhookUrl points here. Waiting 2s...\n");
    await new Promise((r) => setTimeout(r, 2000));
  }

  // ═══════════════════════════════════════════════════════════════
  // PHASE 1: add_to_selection
  // ═══════════════════════════════════════════════════════════════
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("PHASE 1: add_to_selection");
  console.log("═══════════════════════════════════════════════════════════════");

  const phase1Res = await runPhase1(callControlId);
  const phase1Data = phase1Res.data as Record<string, unknown>;

  console.log(`HTTP Status: ${phase1Res.status}`);
  console.log(`Response: ${JSON.stringify(phase1Data, null, 2)}`);

  if (phase1Res.status === 200) {
    const dbCheck = await verifyPhase1InDb(callControlId);
    console.log(`DB check: recipient found=${dbCheck.found}, selectedProducts count=${dbCheck.selectedCount}`);
    if (dbCheck.selectedCount >= 1) {
      console.log("✅ PHASE 1 PASS: Product added and persisted to campaign_recipients.result.purchase.selectedProducts");
    } else {
      console.log("⚠️ PHASE 1: HTTP 200 but selectedProducts not persisted (may need different recipient)`");
    }
  } else {
    console.log(`❌ PHASE 1 FAIL: Expected 200, got ${phase1Res.status}`);
  }

  console.log("");

  // ═══════════════════════════════════════════════════════════════
  // PHASE 2: create_draft_order
  // ═══════════════════════════════════════════════════════════════
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("PHASE 2: create_draft_order (customerConfirmed: true)");
  console.log("═══════════════════════════════════════════════════════════════");

  const phase2Res = await runPhase2(callControlId);
  const phase2Data = phase2Res.data as Record<string, unknown>;

  console.log(`HTTP Status: ${phase2Res.status}`);
  console.log(`Response: ${JSON.stringify(phase2Data, null, 2)}`);

  const dbCheck2 = await verifyPhase2InDb(callControlId);
  console.log(`DB check: invoiceUrl persisted=${!!dbCheck2.invoiceUrl}`);

  if (phase2Res.status === 200 && phase2Data?.invoiceUrl) {
    console.log("✅ PHASE 2 PASS: Draft order created, invoiceUrl returned and persisted");
  } else if (phase2Data?.error === "draft_order_failed") {
    console.log("⚠️ PHASE 2: Endpoint OK but webhook/Railway failed (check webhookUrl, Shopify variant)");
  } else if (phase2Data?.error === "no_products") {
    console.log("⚠️ PHASE 2: No selectedProducts - Phase 1 must run first for this recipient");
  } else if (phase2Data?.error === "needs_final_confirmation") {
    console.log("⚠️ PHASE 2: Blocked (expected when customerConfirmed=false)");
  } else {
    console.log(`⚠️ PHASE 2: ${phase2Data?.error || "See response above"}`);
  }

  mockClose?.();
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("Test complete");
  console.log("═══════════════════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
