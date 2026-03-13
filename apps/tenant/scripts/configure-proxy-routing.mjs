#!/usr/bin/env node
/**
 * Configure tiered routing for the proxy-brain entry agent.
 * Sets tieredChat=true and level2AgentId to a strategic escalation agent.
 *
 * Usage: node scripts/configure-proxy-routing.mjs [publicKey]
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const args = process.argv.slice(2);
const PUBLIC_KEY =
  args.find((a) => !a.startsWith("--")) ||
  process.env.PROXY_PUBLIC_KEY ||
  "agent_e6cf6d0bc48849519de708bd8e15970e";

async function loadSupabase() {
  const envPath = resolve(process.cwd(), ".env.local");
  const env = readFileSync(envPath, "utf8");
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL="?([^"\n]+)/)?.[1]?.replace(/"?\s*$/, "");
  const key = env.match(/SUPABASE_SERVICE_ROLE_KEY="?([^"\n]+)/)?.[1]?.replace(/"?\s*$/, "");
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  return createClient(url, key);
}

async function main() {
  const supabase = await loadSupabase();

  // 1. Find entry agent by public_key
  const { data: entryRow, error: entryErr } = await supabase
    .from("agent_instances")
    .select("id, tenant_id, display_name, provider, routing")
    .eq("public_key", PUBLIC_KEY)
    .maybeSingle();

  if (entryErr) {
    console.error("Error fetching entry agent:", entryErr.message);
    process.exit(1);
  }
  if (!entryRow) {
    console.error(`No agent found with public_key=${PUBLIC_KEY}`);
    process.exit(1);
  }

  const entryId = entryRow.id;
  const tenantId = entryRow.tenant_id;
  const currentRouting = (entryRow.routing ?? {}) || {};

  console.log("Entry agent:", entryRow.display_name, `(${entryId})`);

  // 2. Find escalation agent for L2 (prefer Abacus, then strategic advanced, then Customer Support Specialist)
  const { data: agents } = await supabase
    .from("agent_instances")
    .select("id, display_name, provider, tier, status")
    .eq("tenant_id", tenantId)
    .neq("id", entryId);

  const activeAgents = (agents ?? []).filter((a) => a.status !== "archived" && a.status !== "paused");
  const lower = (v) => String(v ?? "").toLowerCase();
  const abacusAgent =
    activeAgents.find((a) => a.provider === "abacus") ??
    activeAgents.find((a) => a.provider === "advanced" && lower(a.display_name).includes("strategic")) ??
    activeAgents.find((a) => lower(a.display_name).includes("customer support specialist"));
  const level2AgentId = abacusAgent?.id ?? null;

  if (!level2AgentId) {
    console.error(
      "No suitable L2 escalation agent found. Create an Abacus (or strategic advanced) agent in Agent Manager first, then re-run."
    );
    process.exit(1);
  }

  console.log(
    "L2 escalation agent:",
    abacusAgent.display_name,
    `(${level2AgentId})`,
    `[${abacusAgent.provider}]`
  );

  // 3. Update routing
  const newRouting = {
    ...currentRouting,
    tieredChat: true,
    level2AgentId,
    level1AgentId: undefined,
    level3AgentId: undefined,
  };

  const { error: updateErr } = await supabase
    .from("agent_instances")
    .update({ routing: newRouting })
    .eq("id", entryId)
    .eq("tenant_id", tenantId);

  if (updateErr) {
    console.error("Error updating agent:", updateErr.message);
    process.exit(1);
  }

  console.log("\n✓ Routing updated:");
  console.log("  tieredChat: true");
  console.log("  level2AgentId:", level2AgentId);
  console.log("\nProxy webhook should now work. Test with:");
  console.log(
    `  curl -X POST "https://konnect-caas-base.vercel.app/api/webhooks/telnyx/assistant-proxy?publicKey=${PUBLIC_KEY}" \\`
  );
  console.log('    -H "Content-Type: application/json" \\');
  console.log('    -d \'{"message":"What are your business hours?"}\'');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
