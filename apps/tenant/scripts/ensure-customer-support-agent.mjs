#!/usr/bin/env node
/**
 * Ensure a platform agent exists for Customer Support Specialist (Telnyx assistant)
 * with external_ref, tiered chat enabled, and Level 2 escalation agent set.
 *
 * Usage: node scripts/ensure-customer-support-agent.mjs
 * Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const CUSTOMER_SUPPORT_ASSISTANT_ID = "assistant-c0b92fc3-a4fd-4633-b37a-fd3b8a60b2c7";

async function loadSupabase() {
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
  const supabase = await loadSupabase();

  // 1. Get a tenant (first tenant or from env)
  const tenantIdFromEnv = process.env.TENANT_ID;
  let tenantId = tenantIdFromEnv;

  if (!tenantId) {
    const { data: tenants, error: tenantsErr } = await supabase
      .from("tenants")
      .select("id, name")
      .limit(1)
      .order("created_at", { ascending: true });

    if (tenantsErr || !tenants?.length) {
      console.error("Could not load tenants. Set TENANT_ID in env or ensure tenants exist.");
      process.exit(1);
    }
    tenantId = tenants[0].id;
    console.log("Using tenant:", tenants[0].name, `(${tenantId})`);
  }

  // 2. Find existing agent with this external_ref (take first if multiple)
  const { data: existingRows, error: findErr } = await supabase
    .from("agent_instances")
    .select("id, display_name, public_key, routing")
    .eq("tenant_id", tenantId)
    .eq("external_ref", CUSTOMER_SUPPORT_ASSISTANT_ID)
    .limit(1);

  if (findErr) {
    console.error("Error looking up agent:", findErr.message);
    process.exit(1);
  }

  const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;

  // 3. Find L2 escalation agent (Escalation, or any abacus/advanced)
  const { data: agents } = await supabase
    .from("agent_instances")
    .select("id, display_name, provider, status")
    .eq("tenant_id", tenantId);

  const active = (agents ?? []).filter((a) => a.status !== "archived" && a.status !== "paused");
  const lower = (v) => String(v ?? "").toLowerCase();
  const level2Agent =
    active.find((a) => lower(a.display_name).includes("escalation")) ??
    active.find((a) => a.provider === "abacus") ??
    active.find((a) => a.provider === "advanced" && lower(a.display_name).includes("strategic"));

  if (!level2Agent) {
    console.error(
      "No L2 escalation agent found in this tenant. Create an agent named 'Escalation' (or Abacus/strategic) in Agent Manager first."
    );
    process.exit(1);
  }

  const level2AgentId = level2Agent.id;
  console.log("L2 escalation agent:", level2Agent.display_name, `(${level2AgentId})`);

  const newRouting = {
    tieredChat: true,
    level2AgentId,
    level1AgentId: undefined,
    level3AgentId: undefined,
  };

  if (existing) {
    // Update existing agent
    const currentRouting = (existing.routing ?? {}) || {};
    const { error: updateErr } = await supabase
      .from("agent_instances")
      .update({
        routing: { ...currentRouting, ...newRouting },
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("tenant_id", tenantId);

    if (updateErr) {
      console.error("Error updating agent:", updateErr.message);
      process.exit(1);
    }
    console.log("\n✓ Updated existing agent:", existing.display_name, `(${existing.id})`);
    console.log("  public_key:", existing.public_key);
    console.log("  tieredChat: true, level2AgentId:", level2AgentId);
    return;
  }

  // 4. Create new agent for Customer Support Specialist
  const { data: created, error: insertErr } = await supabase
    .from("agent_instances")
    .insert({
      tenant_id: tenantId,
      tier: "simple",
      provider: "telnyx",
      display_name: "Customer Support Specialist",
      description: "Platform agent for Telnyx Customer Support Specialist assistant (escalation enabled).",
      status: "active",
      external_ref: CUSTOMER_SUPPORT_ASSISTANT_ID,
      channels_enabled: { webchat: true, sms: false, voice: false },
      routing: newRouting,
      knowledge_profile: {},
      model_profile: {},
      voice_profile: {},
      speech_profile: {},
      metadata: {},
    })
    .select("id, public_key, display_name")
    .single();

  if (insertErr) {
    console.error("Error creating agent:", insertErr.message);
    process.exit(1);
  }

  console.log("\n✓ Created platform agent:", created.display_name, `(${created.id})`);
  console.log("  public_key:", created.public_key);
  console.log("  external_ref:", CUSTOMER_SUPPORT_ASSISTANT_ID);
  console.log("  tieredChat: true, level2AgentId:", level2AgentId);
  console.log("\nYou can now use the proxy with assistant_id or publicKey for escalation smoke tests.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
