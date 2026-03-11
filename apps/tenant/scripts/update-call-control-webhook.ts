#!/usr/bin/env tsx
/**
 * Update Telnyx Call Control App webhook_event_url for the campaign connection_id.
 *
 * Typical use:
 *   pnpm exec tsx apps/tenant/scripts/update-call-control-webhook.ts \
 *     --tenantId <tenant_uuid> \
 *     --connectionTail 6972 \
 *     --webhookBaseUrl https://<public-host>
 *
 * It will:
 * - Find campaigns for tenant, locate settings.connection_id ending with connectionTail
 * - PATCH /call_control_applications/{connection_id} with webhook_event_url = webhookBaseUrl + /api/webhooks/telnyx/call-events
 *
 * Requires:
 * - TELNYX_API_KEY
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Never prints secrets or phone numbers.
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

const tenantId = arg("tenantId");
const connectionTail = arg("connectionTail") || "6972";
const webhookBaseUrl = (arg("webhookBaseUrl") || "").trim().replace(/\/+$/, "");

if (!tenantId) {
  console.error("Missing --tenantId");
  process.exit(1);
}
if (!webhookBaseUrl) {
  console.error("Missing --webhookBaseUrl (must be public https URL)");
  process.exit(1);
}

const TELNYX_API_KEY = (process.env.TELNYX_API_KEY || "").trim();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!TELNYX_API_KEY) {
  console.error("Missing TELNYX_API_KEY in env");
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function telnyxPatch(pathname: string, body: unknown) {
  const res = await fetch(`https://api.telnyx.com/v2${pathname}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${TELNYX_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as any)?.errors?.[0];
    const detail = msg ? [msg.code && `(${msg.code})`, msg.title, msg.detail].filter(Boolean).join(" ") : res.statusText;
    throw new Error(`Telnyx API ${res.status}: ${detail}`);
  }
  return json as Record<string, unknown>;
}

async function telnyxGet(pathname: string) {
  const res = await fetch(`https://api.telnyx.com/v2${pathname}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${TELNYX_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as any)?.errors?.[0];
    const detail = msg ? [msg.code && `(${msg.code})`, msg.title, msg.detail].filter(Boolean).join(" ") : res.statusText;
    throw new Error(`Telnyx API ${res.status}: ${detail}`);
  }
  return json as Record<string, unknown>;
}

function safeHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

async function main() {
  console.log("Updating Call Control App webhook URL");
  console.log("Tenant:", tenantId);
  console.log("Connection tail:", connectionTail);
  console.log("Webhook base host:", safeHost(webhookBaseUrl) || "(invalid)");
  console.log("");

  const { data: campaigns, error } = await (supabase.from("campaigns") as any)
    .select("id, settings, status, campaign_type, name")
    .eq("tenant_id", tenantId)
    .limit(200);
  if (error) throw error;
  const list = Array.isArray(campaigns) ? campaigns : [];

  let connectionId: string | null = null;
  let campaignId: string | null = null;
  for (const c of list) {
    const settings = (typeof c.settings === "string" ? (() => { try { return JSON.parse(c.settings); } catch { return {}; } })() : c.settings) as Record<string, unknown> | null;
    const cid = typeof (settings as any)?.connection_id === "string" ? String((settings as any).connection_id) : "";
    if (cid && cid.endsWith(connectionTail)) {
      connectionId = cid;
      campaignId = String(c.id);
      break;
    }
  }

  if (!connectionId) {
    console.error("Could not find a campaign connection_id ending with", connectionTail);
    console.error("Tip: ensure the campaign has settings.connection_id set.");
    process.exit(1);
  }

  const webhookEventUrl = `${webhookBaseUrl}/api/webhooks/telnyx/call-events`;
  console.log("Matched campaign:", campaignId);
  console.log("Updating connection_id tail:", connectionId.slice(-8));
  console.log("New webhook host:", safeHost(webhookEventUrl));
  console.log("");

  await telnyxPatch(`/call_control_applications/${encodeURIComponent(connectionId)}`, {
    webhook_event_url: webhookEventUrl,
    active: true,
  });

  const verify = await telnyxGet(`/call_control_applications/${encodeURIComponent(connectionId)}`);
  const data = ((verify as any)?.data ?? verify) as any;
  const finalUrl = typeof data?.webhook_event_url === "string" ? data.webhook_event_url : "";
  console.log("✅ Updated.");
  console.log("Final webhook_event_url host:", safeHost(finalUrl) || "(missing)");
  console.log("Final webhook_event_url:", finalUrl ? finalUrl.slice(0, 120) + (finalUrl.length > 120 ? "..." : "") : "(missing)");
}

main().catch((e) => {
  console.error("Update failed:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});

