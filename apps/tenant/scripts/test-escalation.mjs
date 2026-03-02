#!/usr/bin/env node
/**
 * Test escalation flow via assistant-proxy and public answer API.
 * Usage: node scripts/test-escalation.mjs [publicKey]
 * If no publicKey, tries to fetch from agent_instances (needs .env.local with Supabase).
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3020";

async function fetchPublicKeyFromDb() {
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    const env = readFileSync(envPath, "utf8");
    const url = env.match(/NEXT_PUBLIC_SUPABASE_URL="?([^"\n]+)/)?.[1];
    const key = env.match(/SUPABASE_SERVICE_ROLE_KEY="?([^"\n]+)/)?.[1];
    if (!url || !key) return null;
    const supabase = createClient(url, key);
    const { data } = await supabase
      .from("agent_instances")
      .select("public_key")
      .limit(1)
      .maybeSingle();
    return data?.public_key ?? null;
  } catch {
    return null;
  }
}

async function testProxy(publicKey, message) {
  const url = `${BASE}/api/webhooks/telnyx/assistant-proxy?publicKey=${encodeURIComponent(publicKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, arguments: { message } }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { status: res.status, body: text };
  }
  return { status: res.status, ...json };
}

async function testPublicAnswer(publicKey, message) {
  const res = await fetch(`${BASE}/api/public/agents/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicKey, message }),
  });
  const json = await res.json();
  return { status: res.status, ...json };
}

async function main() {
  let publicKey = process.argv[2] || process.env.TEST_PUBLIC_KEY;
  if (!publicKey) {
    console.log("No publicKey provided. Trying to fetch from agent_instances...");
    publicKey = await fetchPublicKeyFromDb();
    if (!publicKey) {
      console.error(
        "Usage: node scripts/test-escalation.mjs <publicKey>\n" +
          "Or set TEST_PUBLIC_KEY env var.\n" +
          "Get publicKey from Agent Manager (agent_instances.public_key)."
      );
      process.exit(1);
    }
    console.log("Using publicKey:", publicKey.slice(0, 20) + "...");
  }

  const tests = [
    { name: "L1 (simple)", msg: "What are your business hours?" },
    { name: "L2 (strategic)", msg: "I run a 50-agent call center. Compare your plans and propose the best option." },
  ];

  console.log("\n=== Testing via assistant-proxy (Telnyx webhook format) ===\n");
  for (const t of tests) {
    const result = await testProxy(publicKey, t.msg);
    const content = result.content ?? result.result ?? result.error ?? JSON.stringify(result);
    const hasBanner = typeof content === "string" && (
      content.includes("Connecting to Strategic") ||
      content.includes("Strategic")
    );
    console.log(`[${t.name}] status=${result.status}`);
    console.log(`  ${content.slice(0, 200)}${content.length > 200 ? "..." : ""}`);
    if (hasBanner) console.log("  ✓ Escalation banner detected");
    console.log();
  }

  console.log("\n=== Testing via public answer API ===\n");
  for (const t of tests) {
    const result = await testPublicAnswer(publicKey, t.msg);
    const content = result.chat_markdown ?? result.voice_text ?? result.error ?? JSON.stringify(result);
    const hasBanner = result.tieredEscalationBanner || (
      typeof content === "string" && (
        content.includes("Connecting to Strategic")
      )
    );
    console.log(`[${t.name}] status=${result.status}`);
    console.log(`  ${String(content).slice(0, 200)}${String(content).length > 200 ? "..." : ""}`);
    if (hasBanner) console.log("  ✓ Escalation banner:", result.tieredEscalationBanner?.slice(0, 80));
    console.log();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// --- Test Chat verification ---
// Test Chat (AssistantActions → TestChatModal) uses @telnyx/ai-agent-lib. When you send a
// message, Telnyx invokes the assistant; if it's the proxy assistant with a webhook tool,
// Telnyx POSTs to our /api/webhooks/telnyx/assistant-proxy. For Test Chat to work:
// 1. Proxy assistant must have Widget enabled in Telnyx Portal (AI → Assistants → Edit → Widget)
// 2. Webhook tool URL must be publicly reachable (use ngrok for local: ngrok http 3020)
// 3. Run this script to verify the proxy returns 200 + content
