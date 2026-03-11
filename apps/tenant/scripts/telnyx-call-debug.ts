#!/usr/bin/env tsx
/**
 * Telnyx-side call debug for an outbound campaign recipient.
 *
 * Usage (repo root):
 *   pnpm exec tsx apps/tenant/scripts/telnyx-call-debug.ts --recipientId <uuid>
 *
 * Prints non-sensitive call metadata (no phone numbers, no tokens).
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

const TELNYX_API_KEY = (process.env.TELNYX_API_KEY || "").trim();
if (!TELNYX_API_KEY) {
  console.error("Missing TELNYX_API_KEY in env (needed to query Telnyx call details)");
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
    .select("id, tenant_id, campaign_id, status, call_control_id, updated_at")
    .eq("id", recipientId)
    .maybeSingle();
  if (rErr) throw rErr;
  if (!r) {
    console.error("No campaign_recipient found for id:", recipientId);
    process.exit(1);
  }
  const callControlId = typeof r.call_control_id === "string" ? r.call_control_id : "";
  if (!callControlId) {
    console.error("Recipient has no call_control_id; nothing to query on Telnyx.");
    process.exit(1);
  }

  console.log("Recipient:", r.id);
  console.log("Tenant:", r.tenant_id);
  console.log("Campaign:", r.campaign_id);
  console.log("Status:", r.status);
  console.log("Updated:", r.updated_at);
  console.log("CallControlId tail:", tail(callControlId, 8));
  console.log("");

  // Attempt to fetch call details from Telnyx API v2; print safe highlights only.
  const res = await fetch(`https://api.telnyx.com/v2/calls/${encodeURIComponent(callControlId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${TELNYX_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("Telnyx API returned non-200:", res.status, text.slice(0, 400));
    process.exit(1);
  }
  let parsed: any = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error("Telnyx API response was not JSON:", text.slice(0, 400));
    process.exit(1);
  }
  const obj: any =
    (parsed && typeof parsed === "object" && "data" in parsed ? (parsed as any).data : parsed) ?? {};

  const safeKeys = [
    "id",
    "call_control_id",
    "call_leg_id",
    "call_session_id",
    "connection_id",
    "state",
    "status",
    "hangup_cause",
    "hangup_source",
    "created_at",
    "started_at",
    "ended_at",
    "completed_at",
    "duration_secs",
    "duration",
    "is_alive",
    "record_type",
    "start_time",
    "end_time",
    "call_duration",
    "conversation_id",
    "ai_conversation_id",
  ] as const;

  const safe: Record<string, unknown> = {};
  for (const k of safeKeys) {
    if (k in obj) safe[k] = obj[k];
  }

  console.log("Telnyx call response keys (top-level):", Object.keys(obj || {}).slice(0, 60).join(", ") || "(none)");
  console.log("Telnyx call safe fields (raw):", JSON.stringify(safe));

  const hangupCause =
    (obj.hangup_cause as string | undefined) ||
    (obj.hangupCause as string | undefined) ||
    (obj.call_hangup_cause as string | undefined) ||
    undefined;
  const callState =
    (obj.state as string | undefined) ||
    (obj.status as string | undefined) ||
    (obj.record_type as string | undefined) ||
    undefined;
  const startedAt =
    (obj.started_at as string | undefined) ||
    (obj.start_time as string | undefined) ||
    (obj.created_at as string | undefined) ||
    undefined;
  const endedAt =
    (obj.ended_at as string | undefined) ||
    (obj.end_time as string | undefined) ||
    (obj.completed_at as string | undefined) ||
    undefined;
  const duration =
    (typeof obj.duration_secs === "number" ? obj.duration_secs : undefined) ??
    (typeof obj.call_duration === "number" ? obj.call_duration : undefined) ??
    (typeof obj.duration === "number" ? obj.duration : undefined);
  const conversationId =
    (obj.conversation_id as string | undefined) ||
    (obj.ai_conversation_id as string | undefined) ||
    (obj.conversationId as string | undefined) ||
    undefined;

  console.log("Telnyx call details (safe subset):");
  console.log("- is_alive:", typeof obj.is_alive === "boolean" ? String(obj.is_alive) : "(unknown)");
  console.log("- state/status:", callState || "(unknown)");
  console.log("- started_at:", startedAt || "(unknown)");
  console.log("- ended_at:", endedAt || "(unknown)");
  console.log("- duration_secs:", typeof duration === "number" ? String(duration) : "(unknown)");
  console.log("- hangup_cause:", hangupCause || "(unknown)");
  console.log("- conversation_id tail:", conversationId ? tail(conversationId, 8) : "(none)");

  // Try to locate an AI conversation record to confirm tool calls (safe summary only; no transcript).
  const convoCandidates = [
    conversationId,
    typeof obj.call_session_id === "string" ? (obj.call_session_id as string) : undefined,
    typeof obj.call_leg_id === "string" ? (obj.call_leg_id as string) : undefined,
  ].filter((x): x is string => typeof x === "string" && x.trim());

  let convoData: any = null;
  let convoIdUsed: string | null = null;
  for (const cid of convoCandidates) {
    const cRes = await fetch(`https://api.telnyx.com/v2/ai/conversations/${encodeURIComponent(cid)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${TELNYX_API_KEY}`, "Content-Type": "application/json" },
    });
    const cText = await cRes.text();
    if (!cRes.ok) continue;
    try {
      const parsed = JSON.parse(cText);
      convoData = parsed && typeof parsed === "object" && "data" in parsed ? (parsed as any).data : parsed;
      convoIdUsed = cid;
      break;
    } catch {
      // ignore
    }
  }

  // If direct lookups failed, attempt to find the conversation via list endpoint.
  if (!convoData) {
    const queryUrls = [
      `https://api.telnyx.com/v2/ai/conversations?filter[call_control_id]=${encodeURIComponent(callControlId)}&page[size]=50`,
      `https://api.telnyx.com/v2/ai/conversations?page[size]=50`,
    ];
    for (const url of queryUrls) {
      const lRes = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${TELNYX_API_KEY}`, "Content-Type": "application/json" },
      });
      const lText = await lRes.text();
      if (!lRes.ok) continue;
      try {
        const parsed = JSON.parse(lText);
        const data = parsed && typeof parsed === "object" ? (parsed as any).data : null;
        const arr: any[] = Array.isArray(data) ? data : [];
        const hit = arr.find((c) => {
          if (!c || typeof c !== "object") return false;
          const cCall = (c as any).call_control_id ?? (c as any).callControlId ?? (c as any).metadata?.call_control_id;
          const cSession = (c as any).call_session_id ?? (c as any).callSessionId ?? (c as any).metadata?.call_session_id;
          const cLeg = (c as any).call_leg_id ?? (c as any).callLegId ?? (c as any).metadata?.call_leg_id;
          return cCall === callControlId || cSession === obj.call_session_id || cLeg === obj.call_leg_id;
        });
        if (hit) {
          convoData = hit;
          convoIdUsed = (hit as any).id || null;
          break;
        }
      } catch {
        // ignore
      }
    }
  }

  if (!convoData) {
    console.log("");
    console.log("No Telnyx AI conversation record found via candidate IDs.");
    return;
  }

  // If we only have a list item, fetch full conversation details by id (safer for keyword search).
  const convoIdFromObj =
    convoData && typeof convoData === "object" && typeof (convoData as any).id === "string"
      ? String((convoData as any).id)
      : null;
  if (convoIdFromObj) {
    const dRes = await fetch(`https://api.telnyx.com/v2/ai/conversations/${encodeURIComponent(convoIdFromObj)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${TELNYX_API_KEY}`, "Content-Type": "application/json" },
    });
    const dText = await dRes.text();
    if (dRes.ok) {
      try {
        const parsed = JSON.parse(dText);
        convoData = parsed && typeof parsed === "object" && "data" in parsed ? (parsed as any).data : parsed;
        convoIdUsed = convoIdFromObj;
      } catch {
        // ignore
      }
    }
  }

  const convoObj: any = convoData ?? {};
  const convoSafe: Record<string, unknown> = {};
  for (const k of ["id", "status", "created_at", "started_at", "ended_at", "total_cost", "total_duration", "call_control_id", "call_session_id"] as const) {
    if (k in convoObj) convoSafe[k] = convoObj[k];
  }
  const convoStr = (() => {
    try {
      return JSON.stringify(convoObj);
    } catch {
      return "";
    }
  })();

  const keywords = {
    hasAddToSelection: convoStr.includes("add_to_selection") || convoStr.includes("add-to-selection"),
    hasCreateDraftOrder: convoStr.includes("create_draft_order") || convoStr.includes("create-draft-order"),
    hasInvoiceUrl: convoStr.includes("invoiceUrl") || convoStr.includes("invoice_url"),
    hasToolError: convoStr.toLowerCase().includes("tool") && convoStr.toLowerCase().includes("error"),
  };

  console.log("");
  console.log("Telnyx AI conversation summary (safe subset):");
  console.log("- lookupIdUsed tail:", convoIdUsed ? tail(convoIdUsed, 8) : "(none)");
  console.log("- safe fields:", JSON.stringify(convoSafe));
  console.log("- keyword hits:", JSON.stringify(keywords));
  console.log("- conversation keys:", Object.keys(convoObj || {}).slice(0, 60).join(", ") || "(none)");
  for (const k of ["messages", "turns", "events", "tool_calls", "toolCalls", "steps"] as const) {
    const v = (convoObj as any)?.[k];
    if (Array.isArray(v)) {
      console.log(`- ${k}.length:`, v.length);
    }
  }

  // Fetch messages to extract tool invocations (do NOT print message text).
  const convoIdForMessages =
    typeof (convoObj as any)?.id === "string" ? String((convoObj as any).id) : convoIdUsed;
  if (!convoIdForMessages) return;

  const mRes = await fetch(`https://api.telnyx.com/v2/ai/conversations/${encodeURIComponent(convoIdForMessages)}/messages?page[size]=200`, {
    method: "GET",
    headers: { Authorization: `Bearer ${TELNYX_API_KEY}`, "Content-Type": "application/json" },
  });
  const mText = await mRes.text();
  if (!mRes.ok) {
    console.log("");
    console.log("Conversation messages endpoint returned non-200:", mRes.status, mText.slice(0, 400));
    return;
  }
  let mParsed: any = null;
  try {
    mParsed = JSON.parse(mText);
  } catch {
    console.log("");
    console.log("Conversation messages response was not JSON.");
    return;
  }
  const messages: any[] = Array.isArray(mParsed?.data) ? mParsed.data : [];
  const toolNameCounts = new Map<string, number>();
  let toolCallsTotal = 0;
  let toolCallInvoiceUrlMention = false;
  let toolCallErrorish = false;
  for (const msg of messages) {
    const toolCalls = Array.isArray(msg?.tool_calls) ? msg.tool_calls : Array.isArray(msg?.toolCalls) ? msg.toolCalls : [];
    if (!Array.isArray(toolCalls) || toolCalls.length === 0) continue;
    toolCallsTotal += toolCalls.length;
    for (const tc of toolCalls) {
      const fn = tc?.function ?? tc?.tool ?? tc;
      const name = typeof fn?.name === "string" ? fn.name : typeof tc?.name === "string" ? tc.name : null;
      if (name) toolNameCounts.set(name, (toolNameCounts.get(name) ?? 0) + 1);
      try {
        const s = JSON.stringify(tc);
        if (s.includes("invoiceUrl") || s.includes("invoice_url")) toolCallInvoiceUrlMention = true;
        if (s.toLowerCase().includes("error")) toolCallErrorish = true;
      } catch {
        // ignore
      }
    }
  }

  console.log("");
  console.log("Tool call summary from conversation messages:");
  console.log("- messages:", messages.length);
  console.log("- toolCallsTotal:", toolCallsTotal);
  console.log("- toolCallInvoiceUrlMention:", toolCallInvoiceUrlMention ? "true" : "false");
  console.log("- toolCallErrorish:", toolCallErrorish ? "true" : "false");
  if (toolNameCounts.size) {
    console.log("- tool names:");
    for (const [k, v] of [...toolNameCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      console.log(`  - ${k}: ${v}`);
    }
  } else {
    console.log("- tool names: (none found)");
  }
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("Telnyx debug failed:", msg);
  process.exit(1);
});

