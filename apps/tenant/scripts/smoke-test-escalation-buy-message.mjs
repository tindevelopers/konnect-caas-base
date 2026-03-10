#!/usr/bin/env node
/**
 * Smoke test: chat escalation with "buy" message and escalation banner.
 * Uses the Customer support (or first tiered) agent's public key and calls Answer API.
 *
 * Run: cd apps/tenant && node scripts/smoke-test-escalation-buy-message.mjs
 * Requires: .env.local (Supabase), app running at TEST_BASE_URL (default localhost:3020)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3020";

function loadSupabase() {
  const envPath = resolve(process.cwd(), ".env.local");
  const env = readFileSync(envPath, "utf8");
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL="?([^"\n]+)/)?.[1]?.replace(/"?\s*$/, "");
  const key = env.match(/SUPABASE_SERVICE_ROLE_KEY="?([^"\n]+)/)?.[1]?.replace(/"?\s*$/, "");
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  return createClient(url, key);
}

async function getTieredEntryAgentPublicKey(supabase) {
  const { data: rows } = await supabase
    .from("agent_instances")
    .select("id, display_name, public_key, routing")
    .not("public_key", "is", null);
  if (!rows?.length) return null;
  const byName = rows.find((r) => (r.display_name || "").toLowerCase().includes("customer support"));
  const tiered = rows.find((r) => r.routing?.tieredChat === true);
  const agent = byName || tiered || rows[0];
  return agent?.public_key ?? null;
}

async function testAnswerApi(publicKey, message) {
  const res = await fetch(`${BASE}/api/public/agents/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicKey, message, channel: "webchat" }),
  });
  const json = await res.json().catch(() => ({}));
  const banner = json.tieredEscalationBanner ?? "";
  const content = json.chat_markdown ?? json.voice_text ?? json.message ?? "";
  const hasBanner =
    (typeof banner === "string" && banner.includes("Strategic")) ||
    (typeof content === "string" && content.includes("Connecting to Strategic"));
  return {
    status: res.status,
    ok: res.ok,
    banner,
    content: String(content).slice(0, 300),
    hasBanner,
    error: json.error,
  };
}

async function main() {
  console.log("=== Smoke test: escalation with 'buy' message and escalation banner ===\n");
  console.log("Base URL:", BASE);

  const supabase = loadSupabase();
  const publicKey = await getTieredEntryAgentPublicKey(supabase);
  if (!publicKey) {
    console.error("No agent with tiered chat or public_key found. Configure Customer support with tiered chat and Level 2 agent.");
    process.exit(1);
  }
  console.log("Using public key:", publicKey.slice(0, 28) + "...\n");

  // 1) Simple – no escalation
  console.log("1) Simple message (expect no escalation banner)");
  const simple = await testAnswerApi(publicKey, "What are your business hours?");
  console.log("   Status:", simple.status);
  console.log("   Escalation banner?", simple.hasBanner ? "YES" : "NO (expected)");
  if (simple.error) console.log("   Error:", simple.error);
  console.log("");

  // 2) "I want to buy a clipper" – should escalate and show banner
  console.log("2) Buy message: 'I want to buy a clipper' (expect escalation banner)");
  const buy = await testAnswerApi(publicKey, "I want to buy a clipper");
  console.log("   Status:", buy.status);
  console.log("   Escalation banner?", buy.hasBanner ? "YES (expected)" : "NO");
  if (buy.banner) console.log("   Banner:", buy.banner.slice(0, 80) + (buy.banner.length > 80 ? "..." : ""));
  console.log("   Content sample:", buy.content.slice(0, 120) + (buy.content.length > 120 ? "..." : ""));
  if (buy.error) console.log("   Error:", buy.error);
  console.log("");

  const pass = simple.status === 200 && !simple.hasBanner && buy.status === 200 && buy.hasBanner;
  if (pass) {
    console.log("PASS: Chat escalation is working. Buy message returned escalation banner.");
  } else {
    console.log("RESULT: Simple ok?", simple.status === 200 && !simple.hasBanner, "| Buy escalated?", buy.hasBanner);
    if (!buy.hasBanner) {
      console.log("\nWhy Test Chat may not show escalation:");
      console.log("  Test Chat in Telnyx talks directly to Telnyx. Escalation only runs when messages go through");
      console.log("  your app (Answer API or proxy webhook). To see escalation in chat:");
      console.log("  - Use the in-app Chat Preview for the Customer support agent (uses Answer API), or");
      console.log("  - In Telnyx, add a webhook tool to the assistant pointing to your assistant-proxy URL.");
    }
  }
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
