/**
 * Smoke test: Abacus catalog → providerRaw → extractProductRecommendations() → assistant-proxy response
 *
 * Run:
 *   npx tsx scripts/test-abacus-catalog-pipeline.ts
 *
 * Env:
 *   BASE_URL=http://localhost:3010                (default)
 *   PROXY_PUBLIC_KEY=...                          (recommended; adds ?publicKey=)
 *   PROXY_ASSISTANT_ID=...                        (alternative to publicKey; sent in JSON)
 *   MESSAGE="I want to buy dog shampoo"           (optional)
 *
 * Optional (only if your assistant-proxy requires Telnyx ED25519 signature headers):
 *   TELNYX_WEBHOOK_ED25519_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
 *   TELNYX_WEBHOOK_TIMESTAMP_SKEW_SECONDS=0       (optional)
 */

import { randomUUID } from "crypto";

function env(name: string): string | undefined {
  const v = process.env[name];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function resolveBaseUrl(): string {
  const raw = env("BASE_URL") ?? env("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3010";
  return raw.replace(/\/$/, "");
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch (e) {
    return `[unserializable: ${e instanceof Error ? e.message : String(e)}]`;
  }
}

function extractVariantIdLikeFields(obj: unknown): string[] {
  if (!obj || typeof obj !== "object") return [];
  const rec = obj as Record<string, unknown>;
  const keys = ["variantId", "variant_id", "variant_gid", "variantGid", "shopifyVariantId", "productVariantId"];
  const out: string[] = [];
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "string" && v.trim()) out.push(`${k}=${v.trim()}`);
  }
  return out;
}

function extractRecommendations(payload: any): any[] {
  if (!payload || typeof payload !== "object") return [];
  const direct = payload.product_recommendations;
  if (Array.isArray(direct)) return direct;
  const nested = payload.data?.product_recommendations;
  if (Array.isArray(nested)) return nested;
  return [];
}

function needsSigning(): boolean {
  return Boolean(env("TELNYX_WEBHOOK_ED25519_PRIVATE_KEY"));
}

function signEd25519(args: { rawBody: string; timestamp: string; privateKeyPem: string }): string {
  // Telnyx signature is computed over `${timestamp}|${payload}` and Base64-encoded.
  const { sign } = require("crypto") as typeof import("crypto");
  const message = Buffer.from(`${args.timestamp}|${args.rawBody}`, "utf8");
  const sig = sign(null, message, args.privateKeyPem);
  return Buffer.from(sig).toString("base64");
}

async function main() {
  const baseUrl = resolveBaseUrl();
  const proxyPath = "/api/webhooks/telnyx/assistant-proxy";
  const publicKey = env("PROXY_PUBLIC_KEY") ?? env("TELNYX_PROXY_PUBLIC_KEY") ?? env("AGENT_PUBLIC_KEY");
  const assistantId = env("PROXY_ASSISTANT_ID") ?? env("TELNYX_PROXY_ASSISTANT_ID");
  const message = env("MESSAGE") ?? "I want to buy dog shampoo";

  if (!publicKey && !assistantId) {
    console.warn(
      [
        "Missing PROXY_PUBLIC_KEY (recommended) or PROXY_ASSISTANT_ID.",
        "assistant-proxy requires either ?publicKey=... or assistant_id in the payload.",
        "",
        "Examples:",
        "  PROXY_PUBLIC_KEY=pk_... npx tsx scripts/test-abacus-catalog-pipeline.ts",
        "  PROXY_ASSISTANT_ID=assistant-... npx tsx scripts/test-abacus-catalog-pipeline.ts",
      ].join("\n")
    );
    process.exit(1);
  }

  const url = new URL(baseUrl + proxyPath);
  if (publicKey) url.searchParams.set("publicKey", publicKey);

  const requestPayload: Record<string, unknown> = {
    ...(assistantId ? { assistant_id: assistantId } : {}),
    message,
    // Help the proxy keep state if it wants to store it.
    conversation_id: randomUUID(),
  };
  const rawBody = JSON.stringify(requestPayload);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (needsSigning()) {
    const skew = Number(env("TELNYX_WEBHOOK_TIMESTAMP_SKEW_SECONDS") ?? "0") || 0;
    const timestamp = String(Math.floor(Date.now() / 1000) + skew);
    const privateKeyPem = env("TELNYX_WEBHOOK_ED25519_PRIVATE_KEY")!;
    const signature = signEd25519({ rawBody, timestamp, privateKeyPem });
    headers["telnyx-timestamp"] = timestamp;
    headers["telnyx-signature-ed25519"] = signature;
  }

  console.log("[test-abacus-catalog-pipeline] POST", url.toString());
  console.log("[test-abacus-catalog-pipeline] request payload:", safeJson(requestPayload));

  const res = await fetch(url.toString(), { method: "POST", headers, body: rawBody });
  const text = await res.text();

  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  console.log("[test-abacus-catalog-pipeline] status:", res.status);
  console.log("[test-abacus-catalog-pipeline] response json:", json ? safeJson(json) : text);

  const recs = extractRecommendations(json);
  const hasRecs = recs.length > 0;

  if (!hasRecs) {
    console.warn(
      "Proxy response did not contain product_recommendations. Check Abacus retrieval."
    );
    process.exit(0);
  }

  console.log("\nDetected product recommendations:");
  for (const r of recs) {
    const title = typeof r?.title === "string" ? r.title : "(no title)";
    const variantId =
      typeof r?.variantId === "string"
        ? r.variantId
        : typeof r?.variant_id === "string"
          ? r.variant_id
          : typeof r?.variant_gid === "string"
            ? r.variant_gid
            : undefined;
    console.log(`- ${title}`);
    console.log(`  variantId: ${variantId ?? "(missing)"}`);
    if (typeof r?.price === "number" || typeof r?.price === "string") console.log(`  price: ${String(r.price)}`);
    if (typeof r?.availability === "string") console.log(`  availability: ${r.availability}`);
    const rawFields = extractVariantIdLikeFields(r);
    if (rawFields.length > 0) console.log(`  variantId-like fields: ${rawFields.join(", ")}`);
  }

  const anyMissing = recs.some((r) => !extractVariantIdLikeFields(r).length && !r?.variantId);
  console.log(
    "\nvariantId fields present:",
    recs.some((r) => typeof r?.variantId === "string" && r.variantId.trim()) ? "yes" : "no"
  );
  if (anyMissing) {
    console.warn("Warning: at least one recommendation is missing variantId-like fields.");
  }
}

main().catch((e) => {
  console.error("[test-abacus-catalog-pipeline] error:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});

