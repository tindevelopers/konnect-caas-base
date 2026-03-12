#!/usr/bin/env tsx
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

function arg(name: string): string | null {
  const idx = process.argv.findIndex((a) => a === `--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1]!;
  return null;
}

const tenantEnv = path.join(__dirname, "../.env.local");
const rootEnv = path.join(__dirname, "../../../.env.local");
if (fs.existsSync(tenantEnv)) dotenv.config({ path: tenantEnv });
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv, override: false });

const TELNYX_API_KEY = (process.env.TELNYX_API_KEY || "").trim();
if (!TELNYX_API_KEY) {
  console.error("Missing TELNYX_API_KEY in env");
  process.exit(1);
}

async function telnyxGetJson(url: string): Promise<any> {
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${TELNYX_API_KEY}`, "Content-Type": "application/json" },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Telnyx ${res.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text);
}

async function main() {
  const callControlId = (arg("callControlId") || "").trim();
  if (!callControlId) {
    console.error("Missing --callControlId");
    process.exit(1);
  }

  const convoList = await telnyxGetJson("https://api.telnyx.com/v2/ai/conversations");
  const all = Array.isArray(convoList?.data) ? convoList.data : [];
  const convo =
    all.find((c: any) => {
      try {
        return JSON.stringify(c ?? {}).includes(callControlId);
      } catch {
        return false;
      }
    }) ?? null;
  if (!convo?.id) {
    console.log("No conversation found for callControlId");
    return;
  }

  let messagesRes: any;
  try {
    messagesRes = await telnyxGetJson(
      `https://api.telnyx.com/v2/ai/conversations/${encodeURIComponent(convo.id)}/messages`
    );
  } catch {
    messagesRes = await telnyxGetJson(
      `https://api.telnyx.com/v2/ai/conversations/${encodeURIComponent(convo.id)}/messages?page[size]=200`
    );
  }
  const messages: any[] = Array.isArray(messagesRes?.data) ? messagesRes.data : [];

  for (const msg of messages) {
    const toolCalls = Array.isArray(msg?.tool_calls) ? msg.tool_calls : Array.isArray(msg?.toolCalls) ? msg.toolCalls : [];
    for (const tc of toolCalls) {
      const fn = tc?.function ?? tc?.tool ?? tc;
      const name = typeof fn?.name === "string" ? fn.name : typeof tc?.name === "string" ? tc.name : "";
      if (!name) continue;
      let args = fn?.arguments ?? tc?.arguments ?? null;
      if (typeof args === "string") {
        try {
          args = JSON.parse(args);
        } catch {
          // leave as-is
        }
      }
      console.log(
        JSON.stringify({
          messageId: msg?.id ?? null,
          role: msg?.role ?? null,
          toolName: name,
          args,
        })
      );
    }
  }
}

main().catch((e) => {
  console.error("inspect-purchase-tool-args failed:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
