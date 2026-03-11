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
const FULL = process.env.FULL === "1";

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

async function getConversationIdForCall(callControlId: string): Promise<string | null> {
  const urls = [
    `https://api.telnyx.com/v2/ai/conversations?filter[call_control_id]=${encodeURIComponent(callControlId)}&page[size]=20`,
    `https://api.telnyx.com/v2/ai/conversations?page[size]=50`,
  ];
  for (const url of urls) {
    const res = await telnyxGetJson(url);
    if (!res.ok) continue;
    const arr: any[] = Array.isArray(res.data) ? res.data : [];
    if (!arr.length) continue;
    // Prefer an exact match when possible; else just take first item.
    const hit =
      arr.find((c) => (c as any)?.call_control_id === callControlId || (c as any)?.metadata?.call_control_id === callControlId) ??
      arr.find((c) => {
        try {
          return JSON.stringify(c).includes(callControlId);
        } catch {
          return false;
        }
      }) ??
      null;
    const id = hit?.id ?? arr[0]?.id;
    if (typeof id === "string" && id.trim()) return id;
  }
  return null;
}

async function getToolNameCounts(conversationId: string): Promise<Map<string, number> | null> {
  const res = await fetch(`https://api.telnyx.com/v2/ai/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: "GET",
    headers: { Authorization: `Bearer ${TELNYX_API_KEY}`, "Content-Type": "application/json" },
  });
  const text = await res.text();
  if (!res.ok) return null;
  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const messages: any[] = Array.isArray(parsed?.data) ? parsed.data : [];
  const counts = new Map<string, number>();
  for (const msg of messages) {
    const toolCalls = Array.isArray(msg?.tool_calls) ? msg.tool_calls : [];
    for (const tc of toolCalls) {
      const name = typeof tc?.function?.name === "string" ? tc.function.name : null;
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return counts;
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

    const convoId = await getConversationIdForCall(callControlId);
    const toolCounts = convoId ? await getToolNameCounts(convoId) : null;
    const toolNames = toolCounts ? [...toolCounts.keys()] : [];

    const hasPurchaseTools =
      toolCounts?.has("add_to_selection") ||
      toolCounts?.has("add-to-selection") ||
      toolCounts?.has("create_draft_order") ||
      toolCounts?.has("create-draft-order") ||
      toolCounts?.has("send_checkout_email") ||
      toolCounts?.has("send-checkout-email") ||
      false;

    console.log(
      [
        `- updated_at=${r.updated_at}`,
        `recipient=${tail(r.id, 8)}`,
        FULL ? `recipientId=${r.id}` : null,
        `campaign=${tail(r.campaign_id, 8)}`,
        FULL ? `campaignId=${r.campaign_id}` : null,
        `callTail=${tail(callControlId, 8)}`,
        FULL ? `callControlId=${callControlId}` : null,
        `dur=${duration ?? "?"}s`,
        `convoTail=${convoId ? tail(convoId, 8) : "(none)"}`,
        `tools=${toolNames.length ? toolNames.sort().join(",") : "(none)"}`,
      ].filter(Boolean).join(" ")
    );

    if (hasPurchaseTools) {
      console.log("  ^^^ candidate with purchase-tool keywords detected");
    }
  }
}

main().catch((e) => {
  console.error("Scan failed:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});

