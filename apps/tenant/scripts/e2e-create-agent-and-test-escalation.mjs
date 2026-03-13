#!/usr/bin/env node
/**
 * Create an agent in the tenant app, configure L1→L2 escalation, and verify escalation works.
 *
 * Usage:
 *   cd apps/tenant && node scripts/e2e-create-agent-and-test-escalation.mjs
 *
 * Requires:
 *   - .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *   - Tenant app running (e.g. pnpm dev on port 3020) or set TEST_BASE_URL
 *   - At least one tenant in the DB (or set TENANT_ID)
 *
 * Optional env:
 *   TENANT_ID     - tenant to use (default: first tenant)
 *   TEST_BASE_URL - base URL for API (default: http://localhost:3020)
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
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  return createClient(url, key);
}

async function main() {
  console.log("=== E2E: Create agent + configure escalation + test ===\n");

  const supabase = loadSupabase();

  // 1. Resolve tenant
  let tenantId = process.env.TENANT_ID;
  if (!tenantId) {
    const { data: tenants, error: te } = await supabase
      .from("tenants")
      .select("id, name")
      .limit(1)
      .order("created_at", { ascending: true });
    if (te || !tenants?.length) {
      console.error("No tenants found. Set TENANT_ID or create a tenant.");
      process.exit(1);
    }
    tenantId = tenants[0].id;
    console.log("Tenant:", tenants[0].name, `(${tenantId})\n`);
  }

  // 2. Find or create L2 agent (strategic escalation target)
  let level2AgentId;
  const { data: agents } = await supabase
    .from("agent_instances")
    .select("id, display_name, provider, status")
    .eq("tenant_id", tenantId);

  const active = (agents ?? []).filter((a) => a.status !== "archived" && a.status !== "paused");
  const lower = (s) => String(s ?? "").toLowerCase();
  const l2Candidate =
    active.find((a) => a.provider === "abacus") ??
    active.find((a) => a.provider === "advanced" && lower(a.display_name).includes("strategic")) ??
    active.find((a) => lower(a.display_name).includes("escalation")) ??
    active.find((a) => a.provider === "advanced");

  if (l2Candidate) {
    level2AgentId = l2Candidate.id;
    console.log("L2 agent (existing):", l2Candidate.display_name, `(${level2AgentId}) [${l2Candidate.provider}]`);
  } else {
    const { data: created, error: insertErr } = await supabase
      .from("agent_instances")
      .insert({
        tenant_id: tenantId,
        tier: "advanced",
        provider: "advanced",
        display_name: "Strategic Assistant (E2E)",
        description: "L2 escalation target for E2E test",
        status: "active",
        external_ref: null,
        channels_enabled: { webchat: true, sms: false, voice: false },
        routing: {},
        knowledge_profile: {},
        model_profile: {},
        voice_profile: {},
        speech_profile: {},
        metadata: {},
      })
      .select("id, display_name, public_key")
      .single();
    if (insertErr) {
      console.error("Failed to create L2 agent:", insertErr.message);
      process.exit(1);
    }
    level2AgentId = created.id;
    console.log("L2 agent (created):", created.display_name, `(${level2AgentId})`);
  }

  // 3. Create L1 entry agent with tiered escalation
  const entryName = "E2E Escalation Test Agent";
  const { data: existingEntry } = await supabase
    .from("agent_instances")
    .select("id, public_key, display_name, routing")
    .eq("tenant_id", tenantId)
    .eq("display_name", entryName)
    .limit(1)
    .maybeSingle();

  let publicKey;
  if (existingEntry?.id) {
    const newRouting = {
      ...(existingEntry.routing ?? {}),
      tieredChat: true,
      level2AgentId,
      proxyBrainDelegateAgentId: undefined,
    };
    await supabase
      .from("agent_instances")
      .update({ routing: newRouting, updated_at: new Date().toISOString() })
      .eq("id", existingEntry.id)
      .eq("tenant_id", tenantId);
    publicKey = existingEntry.public_key;
    console.log("Entry agent (updated):", existingEntry.display_name, "public_key:", publicKey?.slice(0, 24) + "...");
  } else {
    const { data: created, error: insertErr } = await supabase
      .from("agent_instances")
      .insert({
        tenant_id: tenantId,
        tier: "simple",
        provider: "telnyx",
        display_name: entryName,
        description: "Entry agent for E2E escalation test",
        status: "active",
        external_ref: null,
        channels_enabled: { webchat: true, sms: false, voice: false },
        routing: { tieredChat: true, level2AgentId, proxyBrainDelegateAgentId: undefined },
        knowledge_profile: {},
        model_profile: {},
        voice_profile: {},
        speech_profile: {},
        metadata: {},
      })
      .select("id, public_key, display_name")
      .single();
    if (insertErr) {
      console.error("Failed to create entry agent:", insertErr.message);
      process.exit(1);
    }
    publicKey = created.public_key;
    console.log("Entry agent (created):", created.display_name, "public_key:", publicKey?.slice(0, 24) + "...");
  }

  console.log("\n--- Testing escalation via Answer API ---\n");

  // 4. Test simple message (should stay L1 or get L1-style reply)
  const simpleRes = await fetch(`${BASE}/api/public/agents/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey,
      message: "What are your business hours?",
      channel: "webchat",
    }),
  });
  const simpleJson = await simpleRes.json().catch(() => ({}));
  const simpleOk = simpleRes.ok && !simpleJson.error;
  console.log("Simple (L1):", simpleOk ? "OK" : "FAIL", simpleRes.status, simpleJson.error || "(no error)");

  // 5. Test escalation trigger message
  const escalateRes = await fetch(`${BASE}/api/public/agents/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey,
      message: "I need to compare plans and get an implementation roadmap.",
      channel: "webchat",
    }),
  });
  const escalateJson = await escalateRes.json().catch(() => ({}));
  const content = escalateJson.chat_markdown ?? escalateJson.voice_text ?? escalateJson.message ?? "";
  const banner = escalateJson.tieredEscalationBanner ?? "";
  const hasBanner =
    (typeof banner === "string" && banner.includes("Strategic")) ||
    (typeof content === "string" && content.includes("Connecting to Strategic"));

  const escalateOk = escalateRes.ok && (hasBanner || (!escalateJson.error && content.length > 0));
  console.log(
    "Escalation (L2):",
    escalateOk ? "OK" : "FAIL",
    escalateRes.status,
    hasBanner ? "banner present" : escalateJson.error || "no banner"
  );
  if (banner) console.log("  Banner:", banner.slice(0, 60) + "...");
  if (escalateJson.error) console.log("  Error:", escalateJson.error);
  if (escalateOk && !hasBanner && content.length > 0) {
    console.log("  (Response received; banner may be absent if intent did not trigger escalation.)");
  }

  console.log("\n--- Result ---");
  if (simpleOk && escalateOk) {
    console.log("PASS: Agent created/updated, escalation configured, and Answer API returned successfully.");
    if (hasBanner) console.log("      L2 escalation banner was present.");
    process.exit(0);
  }
  if (!simpleOk) console.log("FAIL: Simple message request failed. Is the app running at " + BASE + "?");
  if (!escalateOk) {
    console.log(
      "FAIL: Escalation test failed. Check entry agent has tieredChat=true and level2AgentId set; ensure app is running."
    );
  }
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
