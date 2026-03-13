#!/usr/bin/env tsx
/**
 * Debug a campaign's Telnyx configuration:
 * - campaign assistant_id
 * - Telnyx assistant tools list (names + URL hosts)
 * - call control application webhook_event_url host
 *
 * Usage (repo root):
 *   pnpm exec tsx apps/tenant/scripts/telnyx-campaign-config-debug.ts --campaignId <uuid>
 *
 * Prints non-sensitive information only.
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

const campaignId = arg("campaignId");
if (!campaignId) {
  console.error("Missing --campaignId");
  process.exit(1);
}

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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function safeHost(url: unknown): string | null {
  if (typeof url !== "string" || !url.trim()) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

async function telnyxGet(url: string) {
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${TELNYX_API_KEY}`, "Content-Type": "application/json" },
  });
  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  return { status: res.status, ok: res.ok, parsed, text };
}

async function main() {
  const { data: campaign, error } = await (supabase.from("campaigns") as any)
    .select("id, tenant_id, assistant_id, settings")
    .eq("id", campaignId)
    .maybeSingle();
  if (error) throw error;
  if (!campaign) {
    console.error("No campaign found for id:", campaignId);
    process.exit(1);
  }

  const settings =
    typeof campaign.settings === "string"
      ? (() => {
          try {
            return JSON.parse(campaign.settings) as Record<string, unknown>;
          } catch {
            return {};
          }
        })()
      : ((campaign.settings as Record<string, unknown> | null) ?? {});

  const assistantId = String(campaign.assistant_id || "").trim();
  const connectionId =
    (typeof (settings as any).connection_id === "string" ? String((settings as any).connection_id) : "") ||
    (process.env.TELNYX_CONNECTION_ID || "");

  const enableProductPurchaseFlow = (settings as any)?.enableProductPurchaseFlow === true;
  const webhookUrl =
    typeof (settings as any)?.webhookUrl === "string"
      ? String((settings as any).webhookUrl)
      : typeof (settings as any)?.railwayWebhookUrl === "string"
        ? String((settings as any).railwayWebhookUrl)
        : "";

  console.log("Campaign:", campaign.id);
  console.log("Tenant:", campaign.tenant_id);
  console.log("AssistantId:", assistantId || "(missing)");
  console.log("enableProductPurchaseFlow:", enableProductPurchaseFlow ? "true" : "false");
  console.log("campaign.settings.webhookUrl host:", safeHost(webhookUrl) || "(none)");
  console.log("connection_id:", connectionId ? `${connectionId.slice(0, 6)}…${connectionId.slice(-4)}` : "(missing)");
  console.log("");

  if (assistantId) {
    const aRes = await telnyxGet(`https://api.telnyx.com/v2/ai/assistants/${encodeURIComponent(assistantId)}`);
    if (!aRes.ok) {
      console.log("Telnyx assistant fetch failed:", aRes.status, aRes.text.slice(0, 220));
    } else {
      const aObj = aRes.parsed && typeof aRes.parsed === "object" && "data" in aRes.parsed ? (aRes.parsed as any).data : aRes.parsed;
      const tools: any[] = Array.isArray(aObj?.tools) ? aObj.tools : [];
      const enabled: any[] = Array.isArray(aObj?.enabled_features) ? aObj.enabled_features : [];
      console.log("Telnyx assistant enabled_features:", enabled.map(String).join(", ") || "(none)");
      console.log(`Telnyx assistant tools: ${tools.length}`);
      for (const t of tools) {
        const name =
          typeof t?.name === "string"
            ? t.name
            : typeof t?.webhook?.name === "string"
              ? t.webhook.name
              : typeof t?.hangup?.name === "string"
                ? t.hangup.name
                : "(unnamed)";
        const type = typeof t?.type === "string" ? t.type : "(type?)";
        const host = safeHost(t?.url) || safeHost(t?.webhook?.url);
        console.log(`- ${name} [${type}] host=${host || "(none)"}`);
      }
      console.log("");
    }
  }

  if (connectionId) {
    const cRes = await telnyxGet(`https://api.telnyx.com/v2/call_control_applications/${encodeURIComponent(connectionId.trim())}`);
    if (!cRes.ok) {
      console.log("Telnyx call control app fetch failed:", cRes.status, cRes.text.slice(0, 220));
    } else {
      const cObj = cRes.parsed && typeof cRes.parsed === "object" && "data" in cRes.parsed ? (cRes.parsed as any).data : cRes.parsed;
      const webhookUrl = (cObj as any)?.webhook_event_url;
      const failoverUrl = (cObj as any)?.webhook_event_failover_url;
      console.log("Call control app webhook host:", safeHost(webhookUrl) || "(none)");
      console.log("Call control app failover host:", safeHost(failoverUrl) || "(none)");
    }
  }
}

main().catch((e) => {
  console.error("Campaign config debug failed:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});

