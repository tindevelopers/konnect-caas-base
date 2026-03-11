#!/usr/bin/env tsx
/**
 * Debug helper: inspect Supabase telephony_events for a specific outbound campaign call.
 *
 * Usage (repo root):
 *   pnpm exec tsx apps/tenant/scripts/debug-outbound-call-events.ts --recipientId <campaign_recipient_uuid>
 *
 * This prints ONLY non-sensitive metadata (event types + timestamps + id tails).
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { createClient } from "@supabase/supabase-js";

// Load env: tenant .env.local first, then root .env.local
const tenantEnv = path.join(__dirname, "../.env.local");
const rootEnv = path.join(__dirname, "../../../.env.local");
if (fs.existsSync(tenantEnv)) dotenv.config({ path: tenantEnv });
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv, override: false });

function arg(name: string): string | null {
  const idx = process.argv.findIndex((a) => a === `--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1]!;
  return null;
}

const recipientId = arg("recipientId");
if (!recipientId) {
  console.error("Missing --recipientId");
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function tail(s: unknown, n: number) {
  const str = typeof s === "string" ? s : s == null ? "" : String(s);
  return str.length > n ? str.slice(-n) : str;
}

async function main() {
  const { data: r, error: rErr } = await (supabase.from("campaign_recipients") as any)
    .select("id, tenant_id, campaign_id, status, call_control_id, created_at, updated_at")
    .eq("id", recipientId)
    .maybeSingle();

  if (rErr) throw rErr;
  if (!r) {
    console.error("No campaign_recipient found for id:", recipientId);
    process.exit(1);
  }

  const callControlId = (r.call_control_id as string | null) ?? null;
  console.log("Recipient:", r.id);
  console.log("Tenant:", r.tenant_id);
  console.log("Campaign:", r.campaign_id);
  console.log("Status:", r.status);
  console.log("CallControlId tail:", tail(callControlId, 8));
  console.log("");

  if (!callControlId) {
    console.error("No call_control_id set on recipient (call may not have dialed).");
    process.exit(1);
  }

  const sinceIso = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data: events, error: eErr } = await (supabase.from("telephony_events") as any)
    .select("received_at, event_type, external_id, payload")
    .eq("tenant_id", r.tenant_id)
    .gte("received_at", sinceIso)
    .order("received_at", { ascending: true })
    .limit(500);

  if (eErr) throw eErr;
  const list = Array.isArray(events) ? events : [];

  // Filter client-side by call_control_id appearing in payload or external_id.
  const filtered = list.filter((ev: any) => {
    const ext = typeof ev.external_id === "string" ? ev.external_id : "";
    if (ext === callControlId) return true;
    try {
      const s = JSON.stringify(ev.payload ?? {});
      return s.includes(callControlId);
    } catch {
      return false;
    }
  });

  console.log(`Matched telephony_events (last 30m): ${filtered.length}`);
  const counts = new Map<string, number>();
  for (const ev of filtered) {
    const t = String(ev.event_type || "unknown");
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  console.log("Counts by event_type:");
  for (const [k, v] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`- ${k}: ${v}`);
  }
  console.log("");

  console.log("Timeline (created_at, event_type, external_id tail):");
  for (const ev of filtered) {
    console.log(`- ${ev.received_at}  ${String(ev.event_type)}  ${tail(ev.external_id, 8)}`);
  }
  console.log("");

  const answeredLike = filtered.filter((ev) => {
    const norm = String(ev.event_type || "").toLowerCase().replaceAll("_", ".");
    return norm === "call.answered" || norm === "call.conversation.started";
  });
  console.log("Answered-equivalent events:", answeredLike.map((e) => String(e.event_type)).join(", ") || "(none)");
}

main().catch((e) => {
  if (e && typeof e === "object") {
    try {
      console.error("Debug script failed:", JSON.stringify(e, null, 2));
      process.exit(1);
    } catch {
      // fallthrough
    }
  }
  console.error("Debug script failed:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});

