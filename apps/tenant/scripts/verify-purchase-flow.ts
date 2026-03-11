#!/usr/bin/env tsx
import * as http from "http";

/**
 * Local verification harness for the campaign purchase flow.
 *
 * Prerequisites:
 * 1. Dev server running: pnpm dev:tenant (or similar)
 * 2. A campaign_recipients row with call_control_id set
 * 3. The campaign must have enableProductPurchaseFlow=true and webhookUrl set
 *
 * Usage:
 *   CALL_CONTROL_ID=call-xxx BASE_URL=http://localhost:3020 pnpm exec tsx apps/tenant/scripts/verify-purchase-flow.ts
 *
 * Or with mock webhook (script starts a mock server; campaign webhook must point to it):
 *   CALL_CONTROL_ID=call-xxx BASE_URL=http://localhost:3020 MOCK_WEBHOOK_PORT=9999 pnpm exec tsx apps/tenant/scripts/verify-purchase-flow.ts
 *
 * The mock server returns { invoiceUrl: "https://checkout.example.com/inv" } and logs received requests.
 */

const CALL_CONTROL_ID = process.env.CALL_CONTROL_ID?.trim();
const BASE_URL = (process.env.BASE_URL || "http://localhost:3020").replace(/\/$/, "");
const MOCK_WEBHOOK_PORT = process.env.MOCK_WEBHOOK_PORT ? parseInt(process.env.MOCK_WEBHOOK_PORT, 10) : 0;

interface MockRequest {
  method: string;
  url: string;
  body: unknown;
  timestamp: string;
}

const mockRequests: MockRequest[] = [];

function createMockWebhookServer(port: number): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const server = http.createServer((req: any, res: any) => {
      let body = "";
      req.on("data", (chunk: Buffer) => (body += chunk.toString()));
      req.on("end", () => {
        const parsed = body ? JSON.parse(body) : {};
        mockRequests.push({
          method: req.method || "GET",
          url: req.url || "/",
          body: parsed,
          timestamp: new Date().toISOString(),
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ invoiceUrl: "https://checkout.example.com/inv" }));
      });
    });
    server.listen(port, "127.0.0.1", () => {
      const url = `http://127.0.0.1:${port}`;
      console.log(`[Mock] Webhook server listening at ${url}`);
      resolve({
        url,
        close: () => server.close(),
      });
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

async function main() {
  if (!CALL_CONTROL_ID) {
    console.error("❌ CALL_CONTROL_ID is required. Set it as an env var.");
    console.error("   Example: CALL_CONTROL_ID=call-xxx BASE_URL=http://localhost:3020 pnpm exec tsx apps/tenant/scripts/verify-purchase-flow.ts");
    process.exit(1);
  }

  let mockClose: (() => void) | null = null;
  if (MOCK_WEBHOOK_PORT > 0) {
    const mock = await createMockWebhookServer(MOCK_WEBHOOK_PORT);
    mockClose = mock.close;
    console.log(`[Mock] Set your campaign webhook URL to: ${mock.url}`);
    console.log("[Mock] Waiting 2s for you to confirm...\n");
    await new Promise((r) => setTimeout(r, 2000));
  }

  const addUrl = `${BASE_URL}/api/webhooks/telnyx/campaign-purchase/add-to-selection`;
  const createUrl = `${BASE_URL}/api/webhooks/telnyx/campaign-purchase/create-draft-order`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-telnyx-call-control-id": CALL_CONTROL_ID,
  };

  console.log("=== Step 1: add-to-selection ===");
  const addRes = await fetchJson(addUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      call_control_id: CALL_CONTROL_ID,
      productTitle: "Andis Clipper 1",
      productUrl: "https://www.petstore.direct/products/andis-clipper-1",
      variantId: "gid://shopify/ProductVariant/123",
      quantity: 1,
    }),
  });
  if (addRes.status !== 200) {
    console.error("❌ add-to-selection failed:", addRes.status, addRes.data);
    mockClose?.();
    process.exit(1);
  }
  console.log("✅ add-to-selection OK:", (addRes.data as any).content);

  console.log("\n=== Step 2: create-draft-order WITHOUT customerConfirmed ===");
  const noConfirmRes = await fetchJson(createUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ call_control_id: CALL_CONTROL_ID }),
  });
  if (noConfirmRes.status !== 200) {
    console.error("❌ Expected 200, got:", noConfirmRes.status);
    mockClose?.();
    process.exit(1);
  }
  const noConfirmData = noConfirmRes.data as { error?: string; content?: string };
  if (noConfirmData.error !== "needs_final_confirmation") {
    console.error("❌ Expected error=needs_final_confirmation, got:", noConfirmData.error);
    mockClose?.();
    process.exit(1);
  }
  console.log("✅ Correctly blocked (needs_final_confirmation):", noConfirmData.content);

  console.log("\n=== Step 3: create-draft-order WITH customerConfirmed: true ===");
  const beforeWebhookCount = mockRequests.length;
  const confirmRes = await fetchJson(createUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ call_control_id: CALL_CONTROL_ID, customerConfirmed: true }),
  });
  if (confirmRes.status !== 200) {
    console.error("❌ create-draft-order failed:", confirmRes.status, confirmRes.data);
    mockClose?.();
    process.exit(1);
  }
  const confirmData = confirmRes.data as { invoiceUrl?: string; error?: string };
  if (confirmData.error === "draft_order_failed") {
    console.log("⚠️ Webhook call failed (expected if webhook URL not reachable):", confirmData);
  } else if (confirmData.invoiceUrl) {
    console.log("✅ Draft order created, invoiceUrl:", confirmData.invoiceUrl);
  }
  if (MOCK_WEBHOOK_PORT > 0 && mockRequests.length > beforeWebhookCount) {
    const lastReq = mockRequests[mockRequests.length - 1];
    console.log("✅ Mock webhook received request:", JSON.stringify(lastReq.body, null, 2));
  }

  console.log("\n=== Step 4: create-draft-order again (duplicate guard) ===");
  const dupRes = await fetchJson(createUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ call_control_id: CALL_CONTROL_ID, customerConfirmed: true }),
  });
  const dupData = dupRes.data as { error?: string; invoiceUrl?: string };
  if (dupData.error === "invoice_already_exists" && dupData.invoiceUrl) {
    console.log("✅ Duplicate guard returned existing invoiceUrl:", dupData.invoiceUrl);
  } else if (dupData.invoiceUrl) {
    console.log("✅ Returned existing invoiceUrl (no new webhook call):", dupData.invoiceUrl);
  } else {
    console.log("⚠️ Response:", dupData);
  }

  mockClose?.();
  console.log("\n=== Verification complete ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
