#!/usr/bin/env tsx
/**
 * Check a phone number's status and connection in Telnyx.
 * Usage: pnpm exec tsx apps/tenant/scripts/check-phone-number.ts [number]
 * Example: pnpm exec tsx apps/tenant/scripts/check-phone-number.ts "33920090999"
 *
 * Loads TELNYX_API_KEY from .env.local.
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

const tenantEnv = path.join(__dirname, "../.env.local");
const rootEnv = path.join(__dirname, "../../../.env.local");
if (fs.existsSync(tenantEnv)) dotenv.config({ path: tenantEnv });
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv, override: false });

const TELNYX_API_KEY = process.env.TELNYX_API_KEY || "";
const TELNYX_BASE = "https://api.telnyx.com/v2";

function normalizeQuery(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("33")) return digits;
  if (digits.startsWith("0")) return "33" + digits.slice(1);
  return digits.length <= 9 ? "33" + digits : digits;
}

async function telnyxFetch<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${TELNYX_BASE}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${TELNYX_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = (body as { errors?: Array<{ title?: string; detail?: string }> })?.errors?.[0];
    const detail = msg ? [msg.title, msg.detail].filter(Boolean).join(": ") : res.statusText;
    throw new Error(`Telnyx API ${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

async function main() {
  const raw = process.argv[2] ?? "0392090999";
  const query = normalizeQuery(raw);

  if (!TELNYX_API_KEY?.trim()) {
    console.error("❌ TELNYX_API_KEY is not set. Set it in apps/tenant/.env.local or root .env.local");
    process.exit(1);
  }

  console.log("🔍 Looking up number containing:", query, "\n");

  type PhoneNumberRecord = {
    id: string;
    phone_number: string;
    status?: string;
    connection_id?: string | null;
    connection_name?: string | null;
    messaging_profile_id?: string | null;
    messaging_profile_name?: string | null;
    country_iso_alpha2?: string;
    phone_number_type?: string;
  };

  const list = await telnyxFetch<{ data?: PhoneNumberRecord[] }>(
    `/phone_numbers?filter[phone_number][contains]=${encodeURIComponent(query)}&page[size]=10`
  );
  const numbers = list.data ?? [];

  if (numbers.length === 0) {
    console.log("❌ No owned number found matching", query);
    console.log("   Check that the number is in your Telnyx account (Manage Numbers in Mission Control).");
    process.exit(1);
  }

  for (const n of numbers) {
    console.log("────────────────────────────────────────");
    console.log("Number:     ", n.phone_number);
    console.log("Status:     ", n.status ?? "(not set)");
    console.log("Type:       ", n.phone_number_type ?? "-");
    console.log("Country:    ", n.country_iso_alpha2 ?? "-");
    console.log("Connection: ", n.connection_id || n.connection_name || "(none)");
    console.log("Messaging:  ", n.messaging_profile_id || n.messaging_profile_name || "(none)");
    console.log("ID:         ", n.id);
    console.log("────────────────────────────────────────");

    if (!n.connection_id?.trim()) {
      console.log("\n⚠️  No Connection ID is set. Inbound voice will not reach your app.");
      console.log("   Fix: In your app go to RTC → Numbers → Manage Numbers, select this number,");
      console.log("   set Connection ID to your Call Control connection (webhook URL to this app), then Save.");
    }
    if ((n.status ?? "").toLowerCase() !== "active") {
      console.log("\n⚠️  Status is not 'active'. The number may not be in service until it is active.");
    }
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
