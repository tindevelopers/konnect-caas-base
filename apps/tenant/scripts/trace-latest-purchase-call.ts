#!/usr/bin/env tsx
/**
 * Trace the latest outbound campaign call that used (or attempted) the purchase flow.
 *
 * Usage (repo root):
 *   pnpm exec tsx apps/tenant/scripts/trace-latest-purchase-call.ts
 *
 * Optional:
 *   HOURS=6 pnpm exec tsx apps/tenant/scripts/trace-latest-purchase-call.ts
 *
 * Output is intentionally non-sensitive (no phone numbers, no emails, no tokens).
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
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const HOURS = Number(process.env.HOURS || "3") || 3;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function tail(s: unknown, n: number) {
  const str = typeof s === "string" ? s : s == null ? "" : String(s);
  return str.length > n ? str.slice(-n) : str;
}

function safeUrlHost(url: unknown): string | null {
  if (typeof url !== "string" || !url.trim()) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

type PurchaseState = {
  selectedProducts?: unknown[];
  checkoutConfirmed?: boolean;
  checkoutConfirmedAt?: string;
  invoiceUrl?: string;
  lineItemsSent?: unknown[];
};

function extractPurchase(result: any): PurchaseState {
  const purchase = result && typeof result === "object" ? (result as any).purchase : null;
  if (!purchase || typeof purchase !== "object") return {};
  return {
    selectedProducts: Array.isArray(purchase.selectedProducts) ? purchase.selectedProducts : undefined,
    checkoutConfirmed: purchase.checkoutConfirmed === true ? true : undefined,
    checkoutConfirmedAt: typeof purchase.checkoutConfirmedAt === "string" ? purchase.checkoutConfirmedAt : undefined,
    invoiceUrl: typeof purchase.invoiceUrl === "string" ? purchase.invoiceUrl : undefined,
    lineItemsSent: Array.isArray(purchase.lineItemsSent) ? purchase.lineItemsSent : undefined,
  };
}

function looksLikePurchaseCandidate(r: any) {
  const p = extractPurchase(r?.result);
  return Boolean(
    (Array.isArray(p.selectedProducts) && p.selectedProducts.length > 0) ||
      p.checkoutConfirmed ||
      p.invoiceUrl ||
      (Array.isArray(p.lineItemsSent) && p.lineItemsSent.length > 0)
  );
}

function extractHangupCauseFromTelnyxPayload(payload: any): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as any).data;
  const inner = data && typeof data === "object" ? (data as any).payload : null;
  const cause = inner?.hangup_cause ?? data?.hangup_cause ?? (payload as any).hangup_cause;
  return typeof cause === "string" && cause.trim() ? cause : null;
}

function extractToolNameFromAiEvent(payload: any): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as any).data ?? (payload as any).metadata?.event ?? payload;
  const p = data?.payload ?? data;
  const possible =
    p?.tool_name ?? p?.toolName ?? p?.name ?? p?.function_name ?? p?.functionName ?? p?.tool?.name;
  return typeof possible === "string" && possible.trim() ? possible : null;
}

async function main() {
  const sinceIso = new Date(Date.now() - HOURS * 60 * 60 * 1000).toISOString();

  const { data: recipients, error: rErr } = await (supabase.from("campaign_recipients") as any)
    .select("id, tenant_id, campaign_id, status, call_control_id, updated_at, result")
    .gte("updated_at", sinceIso)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (rErr) throw rErr;
  const list = Array.isArray(recipients) ? recipients : [];
  const candidates = list.filter(looksLikePurchaseCandidate);

  if (candidates.length === 0) {
    const withResult = list.filter((r: any) => r?.result && typeof r.result === "object").length;
    const withPurchaseKey = list.filter((r: any) => {
      try {
        return r?.result && typeof r.result === "object" && "purchase" in (r.result as any);
      } catch {
        return false;
      }
    }).length;
    const withCallControlId = list.filter((r: any) => typeof r?.call_control_id === "string" && r.call_control_id.trim()).length;
    console.log(`No purchase-flow candidates found in last ${HOURS}h.`);
    console.log(`Scanned campaign_recipients rows: ${list.length}`);
    console.log(`- with call_control_id: ${withCallControlId}`);
    console.log(`- with result object: ${withResult}`);
    console.log(`- with result.purchase key: ${withPurchaseKey}`);
    console.log("");
    console.log("Sample rows (most recent 10):");
    for (const r of list.slice(0, 10) as any[]) {
      const keys =
        r?.result && typeof r.result === "object" && r.result
          ? Object.keys(r.result as any).slice(0, 8)
          : [];
      console.log(
        `- id=${r.id} updated_at=${r.updated_at} status=${r.status} callTail=${tail(r.call_control_id, 8) || "(none)"} resultKeys=[${keys.join(",")}]`
      );
    }

    const tenantId = list[0]?.tenant_id as string | undefined;
    if (tenantId) {
      const { count: tCount } = await (supabase.from("telephony_events") as any)
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .gte("received_at", sinceIso);
      const { count: aCount } = await (supabase.from("ai_agent_events") as any)
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .gte("received_at", sinceIso);
      console.log("");
      console.log(`Event volume for tenant ${tenantId} since ${sinceIso}:`);
      console.log(`- telephony_events: ${tCount ?? 0}`);
      console.log(`- ai_agent_events: ${aCount ?? 0}`);
    }
    return;
  }

  const picked = candidates[0] as any;
  const purchase = extractPurchase(picked.result);

  // Campaign settings (for breakpoint: purchase_flow_disabled)
  let campaignSettings: any = {};
  try {
    const { data: camp } = await (supabase.from("campaigns") as any)
      .select("settings")
      .eq("id", picked.campaign_id)
      .maybeSingle();
    campaignSettings = (camp?.settings ?? {}) as Record<string, unknown>;
  } catch {
    // ignore
  }
  const enablePurchase = campaignSettings?.enableProductPurchaseFlow === true;
  const webhookUrl = typeof campaignSettings?.webhookUrl === "string" && campaignSettings.webhookUrl.trim();

  console.log(`Picked candidate (most recent, last ${HOURS}h):`);
  console.log(`- recipientId: ${picked.id}`);
  console.log(`- tenantId: ${picked.tenant_id}`);
  console.log(`- campaignId: ${picked.campaign_id}`);
  console.log(`- status: ${picked.status}`);
  console.log(`- updated_at: ${picked.updated_at}`);
  console.log(`- callControlId tail: ${tail(picked.call_control_id, 8) || "(none)"}`);
  console.log(`- selectedProductsCount: ${Array.isArray(purchase.selectedProducts) ? purchase.selectedProducts.length : 0}`);
  console.log(`- checkoutConfirmed: ${purchase.checkoutConfirmed ? "true" : "false"}`);
  console.log(`- invoiceHost: ${safeUrlHost(purchase.invoiceUrl) || "(none)"}`);
  console.log(`- campaign enableProductPurchaseFlow: ${enablePurchase}`);
  console.log(`- campaign webhookUrl set: ${webhookUrl ? "yes" : "no"}`);
  console.log("");

  const callControlId = typeof picked.call_control_id === "string" ? picked.call_control_id : "";
  if (!callControlId) {
    console.log("No call_control_id on recipient; cannot correlate events.");
    return;
  }

  // telephony_events timeline
  const { data: telEvents, error: tErr } = await (supabase.from("telephony_events") as any)
    .select("received_at, event_type, external_id, payload")
    .eq("tenant_id", picked.tenant_id)
    .gte("received_at", sinceIso)
    .order("received_at", { ascending: true })
    .limit(800);

  if (tErr) throw tErr;
  const telList = Array.isArray(telEvents) ? telEvents : [];
  const telMatched = telList.filter((ev: any) => {
    if (ev?.external_id === callControlId) return true;
    try {
      return JSON.stringify(ev?.payload ?? {}).includes(callControlId);
    } catch {
      return false;
    }
  });

  console.log(`telephony_events matched: ${telMatched.length}`);
  const hangups = telMatched.filter((ev: any) => {
    const norm = String(ev?.event_type || "").toLowerCase().replaceAll("_", ".");
    return norm === "call.hangup" || norm === "call.completed";
  });
  const lastHangup = hangups.length ? hangups[hangups.length - 1] : null;
  const hangupCause = lastHangup ? extractHangupCauseFromTelnyxPayload(lastHangup.payload) : null;
  console.log(`- last hangup cause: ${hangupCause || "(none found)"}`);
  console.log("");
  console.log("telephony_events timeline (received_at, event_type):");
  for (const ev of telMatched) {
    console.log(`- ${ev.received_at}  ${String(ev.event_type)}`);
  }
  console.log("");

  // ai_agent_events (tool invocations / assistant events)
  const { data: aiEvents, error: aErr } = await (supabase.from("ai_agent_events") as any)
    .select("received_at, event_type, external_id, payload")
    .eq("tenant_id", picked.tenant_id)
    .gte("received_at", sinceIso)
    .order("received_at", { ascending: true })
    .limit(800);

  if (aErr) throw aErr;
  const aiList = Array.isArray(aiEvents) ? aiEvents : [];
  const aiMatched = aiList.filter((ev: any) => {
    if (!ev) return false;
    try {
      const s = JSON.stringify(ev.payload ?? {});
      return s.includes(callControlId);
    } catch {
      return false;
    }
  });

  const toolCounts = new Map<string, number>();
  for (const ev of aiMatched) {
    const toolName = extractToolNameFromAiEvent((ev as any).payload);
    if (toolName) toolCounts.set(toolName, (toolCounts.get(toolName) ?? 0) + 1);
  }

  console.log(`ai_agent_events matched: ${aiMatched.length}`);
  if (toolCounts.size) {
    console.log("Tool names seen in ai_agent_events payloads:");
    for (const [k, v] of [...toolCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      console.log(`- ${k}: ${v}`);
    }
  } else {
    console.log("No tool names detected in matched ai_agent_events payloads.");
  }
  console.log("");

  const toolKeywordHits = aiMatched.filter((ev: any) => {
    const s = (() => {
      try {
        return JSON.stringify(ev?.payload ?? {});
      } catch {
        return "";
      }
    })();
    return (
      s.includes("create_draft_order") ||
      s.includes("create-draft-order") ||
      s.includes("add_to_selection") ||
      s.includes("add-to-selection") ||
      s.includes("/campaign-purchase/create-draft-order") ||
      s.includes("/campaign-purchase/add-to-selection")
    );
  });
  console.log(`ai_agent_events containing purchase tool keywords: ${toolKeywordHits.length}`);
  console.log("ai_agent_events timeline (received_at, event_type, toolName?):");
  for (const ev of aiMatched) {
    const toolName = extractToolNameFromAiEvent((ev as any).payload);
    console.log(`- ${ev.received_at}  ${String(ev.event_type)}${toolName ? `  tool=${toolName}` : ""}`);
  }
  console.log("");

  // Re-read recipient result to confirm persisted invoiceUrl (authoritative)
  const { data: r2, error: r2Err } = await (supabase.from("campaign_recipients") as any)
    .select("id, result, updated_at")
    .eq("id", picked.id)
    .maybeSingle();
  if (r2Err) throw r2Err;
  const p2 = extractPurchase(r2?.result);
  console.log("Recipient purchase state (current):");
  console.log(`- selectedProductsCount: ${Array.isArray(p2.selectedProducts) ? p2.selectedProducts.length : 0}`);
  console.log(`- checkoutConfirmed: ${p2.checkoutConfirmed ? "true" : "false"}`);
  console.log(`- checkoutConfirmedAt: ${p2.checkoutConfirmedAt || "(none)"}`);
  console.log(`- invoiceHost: ${safeUrlHost(p2.invoiceUrl) || "(none)"}`);
  console.log(`- invoiceUrl persisted: ${p2.invoiceUrl ? "yes" : "no"}`);
  console.log(`- updated_at: ${r2?.updated_at || "(unknown)"}`);
  console.log("");

  // Suggest breakpoint for "why was email not sent?"
  const breakpoints: string[] = [];
  if (!enablePurchase || !webhookUrl)
    breakpoints.push("Phase 0/7: Campaign purchase flow disabled or webhookUrl missing (create-draft-order returns 403 purchase_flow_disabled)");
  if (!callControlId) breakpoints.push("Phase 1.11: call_control_id not stored (executor or DB)");
  else if (!Array.isArray(p2.selectedProducts) || p2.selectedProducts.length === 0)
    breakpoints.push("Phase 4/5: No selectedProducts (Luna add-to-selection not called or not persisted)");
  else if (!p2.checkoutConfirmed)
    breakpoints.push("Phase 6: checkoutConfirmed false (customer did not confirm; create-draft-order returned needs_final_confirmation)");
  else if (!p2.invoiceUrl)
    breakpoints.push("Phase 8: invoiceUrl not persisted (webhook not called, failed, or did not return invoiceUrl; check [CampaignPurchase:webhook] logs)");
  else breakpoints.push("invoiceUrl present: email is sent by external webhook; if customer did not receive it, check that service's logs and email config.");

  console.log("Suggested breakpoint (why email might not have been sent):");
  for (const b of breakpoints) console.log(`- ${b}`);
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("Trace failed:", msg);
  process.exit(1);
});

