#!/usr/bin/env node
/**
 * Diagnose why L2 (Abacus) returns "I was unable to generate a response from Abacus."
 *
 * Run: cd apps/tenant && node scripts/diagnose-abacus-l2.mjs
 * Requires: .env.local, app running at TEST_BASE_URL (default localhost:3020)
 *
 * This script:
 * 1. Checks if Abacus integration is configured (tenant or platform)
 * 2. Runs the integration health check via API (if you have an API route)
 * 3. Triggers escalation and tells you to check server logs for [AbacusProvider]
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

async function main() {
  console.log("=== Abacus L2 Escalation Diagnostic ===\n");

  const supabase = loadSupabase();

  // 1. Check integration configs
  const { data: tenantConfigs } = await supabase
    .from("integration_configs")
    .select("tenant_id, provider, credentials, settings")
    .eq("provider", "abacus");
  const { data: platformConfig } = await supabase
    .from("platform_integration_configs")
    .select("provider, credentials, settings")
    .eq("provider", "abacus")
    .maybeSingle();

  console.log("1) Abacus integration config:");
  if (tenantConfigs?.length) {
    console.log("   Tenant config(s):", tenantConfigs.length);
    for (const c of tenantConfigs) {
      const creds = c.credentials || {};
      const hasKey = !!(creds.apiKey || creds.api_key || creds.deploymentToken || creds.deployment_token);
      console.log("     - tenant_id:", c.tenant_id, "| has credentials:", hasKey);
    }
  } else {
    console.log("   No tenant integration_configs for abacus");
  }
  if (platformConfig) {
    const creds = platformConfig.credentials || {};
    const hasKey = !!(creds.apiKey || creds.api_key || creds.deploymentToken || creds.deployment_token);
    console.log("   Platform config: has credentials:", hasKey);
  } else {
    console.log("   No platform_integration_configs for abacus");
  }
  if (!tenantConfigs?.length && !platformConfig) {
    console.log("   → Configure Abacus in Integrations (tenant or System Admin → Integrations → Abacus.AI)");
    console.log("   → Or set env: ABACUS_API_KEY, ABACUS_DEPLOYMENT_ID, ABACUS_DEPLOYMENT_TOKEN");
  }
  console.log("");

  // 2. Check L2 agent
  const { data: agents } = await supabase
    .from("agent_instances")
    .select("id, display_name, provider, routing")
    .eq("provider", "abacus");
  const tiered = agents?.filter((a) => a.routing?.tieredChat || a.routing?.level2AgentId);
  const l2Agents = agents?.filter((a) => {
    const r = a.routing || {};
    return !!r.level2AgentId || (tiered && tiered.some((t) => t.routing?.level2AgentId === a.id));
  });
  console.log("2) Abacus (L2) agents:");
  if (agents?.length) {
    agents.forEach((a) => console.log("   -", a.display_name, `(${a.id})`));
  } else {
    console.log("   No agent with provider=abacus. Create one in Agent Manager.");
  }
  console.log("");

  // 3. Trigger escalation and capture raw response
  const { data: entry } = await supabase
    .from("agent_instances")
    .select("id, public_key, routing")
    .not("public_key", "is", null)
    .limit(1)
    .maybeSingle();
  const entryRow = entry || (await supabase.from("agent_instances").select("id, public_key, routing").limit(1).single()).data;
  if (!entryRow?.public_key) {
    console.log("3) No entry agent with public_key found. Configure tiered chat.");
    process.exit(1);
  }

  console.log("3) Triggering escalation (buy message) to capture raw Abacus response...");
  const res = await fetch(`${BASE}/api/public/agents/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey: entryRow.public_key,
      message: "I want to buy a clipper",
      channel: "webchat",
    }),
  });
  const json = await res.json().catch(() => ({}));
  const content = json.chat_markdown ?? json.voice_text ?? json.message ?? "";
  const hasBanner = !!json.tieredEscalationBanner || (typeof content === "string" && content.includes("Strategic"));

  console.log("   Status:", res.status);
  console.log("   Escalation banner?", hasBanner ? "YES" : "NO");
  console.log("   Content sample:", String(content).slice(0, 150));
  if (content.includes("unable to generate a response from Abacus")) {
    console.log("");
    console.log("   >>> Abacus returned 200 but content extraction failed. Check your SERVER TERMINAL");
    console.log("   >>> for [AbacusProvider] log — it shows the raw response keys and structure.");
    console.log("");
    console.log("   Common causes:");
    console.log("   - Abacus API returns a different structure (e.g. Prediction, outputs[])");
    console.log("   - Missing/invalid ABACUS_API_KEY or deployment token");
    console.log("   - Wrong API path for your deployment (Predictions vs ChatLLM)");
    console.log("");
    console.log("   Fix: Add Abacus in Integrations → Abacus.AI with API Key, Deployment ID if using Predictions API.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
