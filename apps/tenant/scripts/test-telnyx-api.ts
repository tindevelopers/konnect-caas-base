#!/usr/bin/env tsx
/**
 * Test script to verify Telnyx API credentials and connectivity.
 * Run from repo root: pnpm exec tsx apps/tenant/scripts/test-telnyx-api.ts
 * Or from apps/tenant: pnpm exec tsx scripts/test-telnyx-api.ts
 *
 * Loads TELNYX_API_KEY from apps/tenant/.env.local or .env.local (root).
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load env: tenant .env.local first, then root .env.local (don't override)
const tenantEnv = path.join(__dirname, "../.env.local");
const rootEnv = path.join(__dirname, "../../../.env.local");
if (fs.existsSync(tenantEnv)) dotenv.config({ path: tenantEnv });
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv, override: false });

const TELNYX_API_KEY = process.env.TELNYX_API_KEY || "";
const TELNYX_BASE = "https://api.telnyx.com/v2";

async function telnyxFetch<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${TELNYX_BASE}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${TELNYX_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = (body as { errors?: Array<{ title?: string; detail?: string }> })?.errors?.[0];
    const detail = msg ? [msg.title, msg.detail].filter(Boolean).join(": ") : res.statusText;
    throw new Error(`Telnyx API ${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

async function testTelnyxAPI() {
  console.log("🧪 Testing Telnyx API credentials...\n");

  if (!TELNYX_API_KEY?.trim()) {
    console.error("❌ TELNYX_API_KEY is not set");
    console.log("\nTo fix:");
    console.log("  1. Set TELNYX_API_KEY in apps/tenant/.env.local or .env.local (root)");
    console.log("  2. Or configure via System Admin → Integrations → Telnyx");
    process.exit(1);
  }

  try {
    console.log("✅ TELNYX_API_KEY found (length:", TELNYX_API_KEY.length, "chars)");
    console.log("   Preview:", TELNYX_API_KEY.substring(0, 10) + "...\n");

    // Test 1: List AI Assistants (validates auth and AI product access)
    console.log("Test 1: GET /ai/assistants...");
    const assistantsRes = await telnyxFetch<{ data?: unknown[] }>("/ai/assistants");
    const assistants = assistantsRes?.data ?? [];
    console.log(`   ✅ Success — ${assistants.length} assistant(s)`);
    if (assistants.length > 0) {
      (assistants as { id?: string; name?: string; model?: string }[]).slice(0, 3).forEach((a, i) => {
        console.log(`      ${i + 1}. ${a.name ?? a.id} (${a.model ?? "N/A"})`);
      });
    }

    // Test 2: List AI Models (optional)
    console.log("\nTest 2: GET /ai/models...");
    try {
      const modelsRes = await telnyxFetch<{ data?: unknown[] }>("/ai/models");
      const models = modelsRes?.data ?? [];
      console.log(`   ✅ Success — ${models.length} model(s)`);
    } catch (e) {
      console.log("   ⚠️  Skipped or not available:", (e as Error).message);
    }

    console.log("\n✅ Telnyx API credentials are valid.");
    console.log("\n📝 Optional: TELNYX_PUBLIC_KEY / TELNYX_WEBHOOK_SECRET for webhook verification.");
  } catch (error) {
    const err = error as Error;
    console.error("\n❌ Telnyx API test failed:", err.message);
    if (err.message.includes("401") || err.message.includes("Unauthorized")) {
      console.error("\n💡 Check your API key at: Telnyx Mission Control → API Keys");
    }
    process.exit(1);
  }
}

// Run tests
testTelnyxAPI()
  .then(() => {
    console.log("\n✨ All tests completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Test suite failed:", error);
    process.exit(1);
  });
