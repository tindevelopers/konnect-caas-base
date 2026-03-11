#!/usr/bin/env tsx
/**
 * Scan recent outbound campaign recipients and use Telnyx APIs to detect
 * whether the AI conversation likely invoked purchase tools.
 *
 * Usage (repo root):
 *   HOURS=6 LIMIT=25 pnpm exec tsx apps/tenant/scripts/find-purchase-tool-calls.ts
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TELNYX_API_KEY = (process.env.TELNYX_API_KEY || "").trim();
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}
if (!TELNYX_API_KEY) {
  console.error("Missing TELNYX_API_KEY in env");
  process.exit(1);
}

const HOURS = Number(process.env.HOURS || "6") || 6;
const LIMIT = Number(process.env.LIMIT || "25") || 25;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function tail(s: unknown, n: number) {
  const str = typeof s === "string" ? s : s == null ? "" : String(s);
  return str.length > n ? str.slice(-n) : str;
}

async function telnyxGetJson(url: string): Promise<{ ok: true; data: any } | { ok: false; status: number }> {
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${TELNYX_API_KEY}`, "Content-Type": "application/json" },
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status };
  try {
    const parsed = JSON.parse(text);
    const data = parsed && typeof parsed === "object" && "data" in parsed ? (parsed as any).data : parsed;
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0 };
  }
}

function keywordHitsFromObj(obj: any) {
  const s = (() => {
    try {
      return JSON.stringify(obj);
    } catch {
      return "";
    }
  })();
  return {
    addToSelection: s.includes("add_to_selection") || s.includes("add-to-selection"),
    createDraftOrder: s.includes("create_draft_order") || s.includes("create-draft-order"),
    invoiceUrl: s.includes("invoiceUrl") || s.includes("invoice_url"),
    errorish: s.toLowerCase().includes("error"),
  };
}

async function main() {
  const sinceIso = new Date(Date.now() - HOURS * 60 * 60 * 1000).toISOString();
  const { data: recs, error } = await (supabase.from("campaign_recipients") as any)
    .select("id, tenant_id, campaign_id, status, call_control_id, updated_at")
    .gte("updated_at", sinceIso)
    .not("call_control_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(LIMIT);

  if (error) throw error;
  const list = Array.isArray(recs) ? recs : [];
  if (!list.length) {
    console.log(`No recipients with call_control_id in last ${HOURS}h.`);
    return;
  }

  console.log(`Scanning ${list.length} recipients (last ${HOURS}h)...`);
  for (const r of list as any[]) {
    const callControlId = String(r.call_control_id || "");
    const callRes = await telnyxGetJson(`https://api.telnyx.com/v2/calls/${encodeURIComponent(callControlId)}`);
    const callObj = callRes.ok ? callRes.data : null;
    const duration = callObj && typeof callObj.call_duration === "number" ? callObj.call_duration : null;

    // Find matching conversation via list filter (best-effort).
    const listRes = await telnyxGetJson(
      `https://api.telnyx.com/v2/ai/conversations?filter[call_control_id]=${encodeURIComponent(callControlId)}&page[size]=5`
    );
    let convoObj: any = null;
    let convoId: string | null = null;
    if (listRes.ok && Array.isArray(listRes.data) && listRes.data.length) {
      convoObj = listRes.data[0];
      convoId = typeof convoObj?.id === "string" ? convoObj.id : null;
    }
    // Fetch conversation details if we got an id.
    if (convoId) {
      const convoRes = await telnyxGetJson(`https://api.telnyx.com/v2/ai/conversations/${encodeURIComponent(convoId)}`);
      if (convoRes.ok) convoObj = convoRes.data;
    }

    const hits = keywordHitsFromObj(convoObj);
    const hasAny = hits.addToSelection || hits.createDraftOrder || hits.invoiceUrl;

    console.log(
      [
        `- updated_at=${r.updated_at}`,
        `recipient=${tail(r.id, 8)}`,
        `campaign=${tail(r.campaign_id, 8)}`,
        `callTail=${tail(callControlId, 8)}`,
        `dur=${duration ?? "?"}s`,
        `hits=${JSON.stringify(hits)}`,
      ].join(" ")
    );

    if (hasAny) {
      console.log("  ^^^ candidate with purchase-tool keywords detected");
    }
  }
}

main().catch((e) => {
  console.error("Scan failed:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});

