#!/usr/bin/env node
/**
 * Verify agent-related tables exist in the linked Supabase database.
 * Uses the service role to bypass RLS and query information_schema via PostgREST.
 * Fallback: try selecting from each table - if it exists, we get a response.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

const tables = [
  "agent_instances",
  "agent_listing_bindings",
  "agent_provider_connections",
  "agent_promotions",
  "agent_knowledge_sources",
  "agent_usage_events",
  "tenant_ai_assistants",
  "ai_agent_events",
  "chatbot_conversations",
  "chatbot_messages",
  "integration_configs",
  "telnyx_mcp_servers",
];

async function verify() {
  const results = [];
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select("id").limit(1);
      if (error) {
        results.push({ table, ok: false, error: error.message });
      } else {
        results.push({ table, ok: true });
      }
    } catch (err) {
      results.push({ table, ok: false, error: String(err?.message || err) });
    }
  }

  const ok = results.filter((r) => r.ok);
  const fail = results.filter((r) => !r.ok);

  console.log("\nAgent-related tables verification:\n");
  for (const r of ok) {
    console.log("  ✓", r.table);
  }
  if (fail.length) {
    console.log("\nMissing or inaccessible:");
    for (const r of fail) {
      console.log("  ✗", r.table, "-", r.error);
    }
  }
  console.log("\nSummary:", ok.length, "/", tables.length, "tables OK");
  process.exit(fail.length > 0 ? 1 : 0);
}

verify();
