#!/usr/bin/env tsx
/**
 * Smoke test: verify outbound campaign calls use the current prompt.
 *
 * Fetches the assistant from Telnyx (same path as webhook), extracts instructions,
 * and checks for expected current-prompt markers (Luna, Groom'D, PetStore.Direct).
 *
 * Run from repo root:
 *   pnpm exec tsx apps/tenant/scripts/smoke-test-campaign-prompt.ts
 *
 * Or with custom assistant:
 *   ASSISTANT_ID=assistant-xxx pnpm exec tsx apps/tenant/scripts/smoke-test-campaign-prompt.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load env: tenant .env.local first, then root .env.local
const tenantEnv = path.join(__dirname, "../.env.local");
const rootEnv = path.join(__dirname, "../../../.env.local");
if (fs.existsSync(tenantEnv)) dotenv.config({ path: tenantEnv });
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv, override: false });

const TELNYX_API_KEY = process.env.TELNYX_API_KEY || "";
const ASSISTANT_ID = process.env.ASSISTANT_ID || "assistant-52bbbd69-427e-4906-bb8c-d3c3e5867c7e";
const TELNYX_BASE = "https://api.telnyx.com/v2";

// Expected markers in current prompt (from PSD new agent / Luna)
// Use "Groom" to avoid apostrophe encoding issues (Groom'D vs Groom'D)
const EXPECTED_MARKERS = ["Luna", "Groom", "PetStore.Direct"];

async function fetchAssistant(assistantId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${TELNYX_BASE}/ai/assistants/${assistantId}`, {
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
  return res.json() as Promise<Record<string, unknown>>;
}

/**
 * Extract instructions using same logic as call-events webhook.
 */
function extractInstructions(response: Record<string, unknown>): string | undefined {
  const res = response;
  const assistant = (res?.data as Record<string, unknown> | undefined) ?? res;
  const raw = assistant?.instructions;
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim();
  }
  return undefined;
}

async function main() {
  console.log("Smoke test: outbound campaign prompt resolution\n");
  console.log("Assistant ID:", ASSISTANT_ID);
  console.log("Expected markers:", EXPECTED_MARKERS.join(", "));
  console.log("");

  if (!TELNYX_API_KEY?.trim()) {
    console.error("❌ TELNYX_API_KEY is not set");
    console.log("   Set it in apps/tenant/.env.local");
    process.exit(1);
  }

  try {
    console.log("1) Fetching assistant from Telnyx (GET /ai/assistants/{id})...");
    const response = await fetchAssistant(ASSISTANT_ID);
    console.log("   ✅ Fetched");

    console.log("\n2) Extracting instructions (same logic as webhook)...");
    const instructions = extractInstructions(response);
    if (!instructions) {
      console.error("   ❌ No instructions found in response");
      console.log("   Response keys:", Object.keys(response));
      if (response.data && typeof response.data === "object") {
        console.log("   data keys:", Object.keys(response.data as object));
      }
      process.exit(1);
    }
    console.log(`   ✅ Extracted ${instructions.length} chars`);
    console.log("   Preview:", instructions.slice(0, 150).replace(/\n/g, " ") + "...");

    console.log("\n3) Checking for current-prompt markers...");
    let allFound = true;
    for (const marker of EXPECTED_MARKERS) {
      const found = instructions.includes(marker);
      console.log(`   ${found ? "✅" : "❌"} "${marker}": ${found ? "found" : "MISSING"}`);
      if (!found) allFound = false;
    }

    if (allFound) {
      console.log("\n✅ PASS: Current prompt is being used (all markers found).");
      console.log("   Outbound campaign calls should use this prompt.");
    } else {
      console.log("\n❌ FAIL: Some markers missing. Prompt may be stale.");
      console.log("   Update the assistant in AI Assistants → View settings → Instructions.");
      process.exit(1);
    }
  } catch (error) {
    const err = error as Error;
    console.error("\n❌ Smoke test failed:", err.message);
    if (err.message.includes("401") || err.message.includes("404")) {
      console.error("   Check TELNYX_API_KEY and ASSISTANT_ID.");
    }
    process.exit(1);
  }
}

main();
