#!/usr/bin/env tsx
/**
 * Ensure a Telnyx assistant has the two campaign purchase webhook tools:
 * - add_to_selection
 * - create_draft_order
 *
 * Usage (repo root):
 *   BASE_URL=https://your-app.example.com pnpm exec tsx apps/tenant/scripts/telnyx-ensure-campaign-purchase-tools.ts --assistantId assistant-xxx
 *
 * Notes:
 * - BASE_URL must be publicly reachable by Telnyx (not localhost).
 * - Non-sensitive output only (prints tool names + URL hosts).
 */
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

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

const assistantId = (arg("assistantId") || "").trim();
if (!assistantId) {
  console.error("Missing --assistantId");
  process.exit(1);
}

const TELNYX_API_KEY = (process.env.TELNYX_API_KEY || "").trim();
if (!TELNYX_API_KEY) {
  console.error("Missing TELNYX_API_KEY in env");
  process.exit(1);
}

const BASE_URL_RAW =
  (process.env.BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim();
if (!BASE_URL_RAW) {
  console.error("Missing BASE_URL (or NEXT_PUBLIC_SITE_URL) in env");
  process.exit(1);
}

const BASE_URL = BASE_URL_RAW.replace(/\/$/, "");
let baseOrigin = "";
try {
  baseOrigin = new URL(BASE_URL).origin;
} catch {
  console.error("BASE_URL must be a valid absolute URL, e.g. https://app.example.com");
  process.exit(1);
}

function safeHost(url: unknown): string | null {
  if (typeof url !== "string" || !url.trim()) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

async function telnyxJson(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...(init ?? {}),
    headers: {
      Authorization: `Bearer ${TELNYX_API_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  return { ok: res.ok, status: res.status, text, parsed };
}

function toolKey(t: any) {
  const name =
    typeof t?.name === "string"
      ? t.name
      : typeof t?.webhook?.name === "string"
        ? t.webhook.name
        : "";
  const type = typeof t?.type === "string" ? t.type : "";
  return `${type}:${name}`;
}

function toolName(t: any): string {
  const direct = typeof t?.name === "string" ? t.name : "";
  const webhook = typeof t?.webhook?.name === "string" ? t.webhook.name : "";
  return (direct || webhook || "").trim();
}

function toolDescription(t: any): string {
  const direct = typeof t?.description === "string" ? t.description : "";
  const webhook = typeof t?.webhook?.description === "string" ? t.webhook.description : "";
  return (direct || webhook || "").trim();
}

function toolUrl(t: any): string {
  const direct = typeof t?.url === "string" ? t.url : "";
  const webhook = typeof t?.webhook?.url === "string" ? t.webhook.url : "";
  return (direct || webhook || "").trim();
}

function toolMethod(t: any): string {
  const direct = typeof t?.method === "string" ? t.method : "";
  const webhook = typeof t?.webhook?.method === "string" ? t.webhook.method : "";
  return (direct || webhook || "").trim();
}

function toolParameters(t: any): any {
  if (t && typeof t === "object") {
    if ("parameters" in t) return (t as any).parameters;
    if (t.webhook && typeof t.webhook === "object" && "parameters" in t.webhook) {
      return (t.webhook as any).parameters;
    }
  }
  return undefined;
}

function normalizeJson(value: any): any {
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (value && typeof value === "object") {
    const sorted = Object.keys(value)
      .sort()
      .reduce<Record<string, any>>((acc, key) => {
        acc[key] = normalizeJson(value[key]);
        return acc;
      }, {});
    return sorted;
  }
  return value;
}

function jsonEqual(a: any, b: any): boolean {
  return JSON.stringify(normalizeJson(a)) === JSON.stringify(normalizeJson(b));
}

async function main() {
  const getRes = await telnyxJson(`https://api.telnyx.com/v2/ai/assistants/${encodeURIComponent(assistantId)}`);
  if (!getRes.ok) {
    console.error("Failed to fetch assistant:", getRes.status, getRes.text.slice(0, 240));
    process.exit(1);
  }
  const assistant =
    getRes.parsed && typeof getRes.parsed === "object" && "data" in getRes.parsed
      ? (getRes.parsed as any).data
      : getRes.parsed;

  const existingTools: any[] = Array.isArray(assistant?.tools) ? assistant.tools : [];

  const searchProductsUrl = `${baseOrigin}/api/webhooks/telnyx/campaign-purchase/search-products`;
  const addToSelectionUrl = `${baseOrigin}/api/webhooks/telnyx/campaign-purchase/add-to-selection`;
  const createDraftOrderUrl = `${baseOrigin}/api/webhooks/telnyx/campaign-purchase/create-draft-order`;
  const searchProductsDescription =
    "Tool usage rules: when the customer asks about products, you MUST call search_products. The tool requires JSON like {\"query\":\"<product name or search phrase>\"}. You must always extract the product phrase from the customer's request. Examples: customer says 'I want a cordless dog clipper' -> call with {\"query\":\"cordless dog clipper\"}; customer says 'Do you have dog shampoo?' -> call with {\"query\":\"dog shampoo\"}. Never call search_products without a query argument. The response includes products with variantId values that you must use when calling add_to_selection.";
  const addToSelectionDescription =
    "Use when customer selects a product. You MUST first call search_products to get the variantId, then pass it here. Send JSON like {\"variantId\":\"gid://shopify/ProductVariant/1234567890\",\"quantity\":1}. Required: variantId as Shopify ProductVariant GID (from search_products response) and quantity >= 1. NEVER call this without a real variantId from search_products. Include call_control_id only if you have the real value from context; never send placeholder strings.";
  const createDraftOrderDescription =
    "Use only after explicit customer confirmation to send checkout link. Send JSON like {\"customerConfirmed\":true,\"customerEmail\":\"buyer@example.com\"}. Required: customerConfirmed=true. Include call_control_id only if you have the real value from context; never send placeholder strings. Optional: customerEmail.";

  const desired = [
    {
      type: "webhook",
      webhook: {
        name: "search_products",
        description: searchProductsDescription,
        url: searchProductsUrl,
        method: "POST",
        parameters: {
          type: "object",
          required: ["query"],
          properties: {
            query: {
              type: "string",
              description:
                "Product search query, e.g. 'dog shampoo' or 'Andis clipper'",
            },
          },
        },
      },
    },
    {
      type: "webhook",
      webhook: {
        name: "add_to_selection",
        description: addToSelectionDescription,
        url: addToSelectionUrl,
        method: "POST",
        parameters: {
          type: "object",
          required: ["variantId", "quantity"],
          properties: {
            variantId: {
              type: "string",
              description:
                "Shopify Product Variant GID from search_products response, in format gid://shopify/ProductVariant/<id>",
            },
            quantity: {
              type: "integer",
              minimum: 1,
              description: "Quantity of product to add",
            },
            call_control_id: {
              type: "string",
              description: "Telnyx call control ID",
            },
          },
        },
      },
    },
    {
      type: "webhook",
      webhook: {
        name: "create_draft_order",
        description: createDraftOrderDescription,
        url: createDraftOrderUrl,
        method: "POST",
        parameters: {
          type: "object",
          required: ["customerConfirmed"],
          properties: {
            customerConfirmed: {
              type: "boolean",
            },
            customerEmail: {
              type: "string",
            },
            call_control_id: {
              type: "string",
            },
          },
        },
      },
    },
  ];

  const managedToolNames = ["search_products", "add_to_selection", "create_draft_order"];

  // Telnyx may return built-in tools (e.g. hangup) without name/description; those often
  // fail schema validation when included in an update payload. Keep only well-formed tools.
  const otherTools = existingTools.filter((t) => {
    const type = typeof t?.type === "string" ? t.type : "";
    const name = toolName(t);
    const description = toolDescription(t);
    if (!name.trim() || !description.trim()) return false;
    if (type === "hangup") return false;
    if (managedToolNames.includes(name)) return false;
    return true;
  });
  const nextTools = [...otherTools, ...desired];

  const existingSearch = existingTools.find((t) => String(t?.type || "") === "webhook" && toolName(t) === "search_products");
  const existingAdd = existingTools.find((t) => String(t?.type || "") === "webhook" && toolName(t) === "add_to_selection");
  const existingCreate = existingTools.find((t) => String(t?.type || "") === "webhook" && toolName(t) === "create_draft_order");

  const needsSearch =
    !existingSearch ||
    toolUrl(existingSearch) !== searchProductsUrl ||
    toolMethod(existingSearch).toUpperCase() !== "POST" ||
    toolDescription(existingSearch) !== searchProductsDescription ||
    !jsonEqual(toolParameters(existingSearch), desired[0]?.webhook?.parameters);
  const needsAdd =
    !existingAdd ||
    toolUrl(existingAdd) !== addToSelectionUrl ||
    toolMethod(existingAdd).toUpperCase() !== "POST" ||
    toolDescription(existingAdd) !== addToSelectionDescription ||
    !jsonEqual(toolParameters(existingAdd), desired[1]?.webhook?.parameters);
  const needsCreate =
    !existingCreate ||
    toolUrl(existingCreate) !== createDraftOrderUrl ||
    toolMethod(existingCreate).toUpperCase() !== "POST" ||
    toolDescription(existingCreate) !== createDraftOrderDescription ||
    !jsonEqual(toolParameters(existingCreate), desired[2]?.webhook?.parameters);
  const changed = needsSearch || needsAdd || needsCreate;

  console.log("Assistant:", assistantId);
  console.log("BASE_URL host:", safeHost(baseOrigin) || "(unknown)");
  console.log("Before tools:", existingTools.length);
  console.log("After tools:", nextTools.length);
  console.log("Will update:", changed ? "yes" : "no");
  if (needsSearch) {
    console.log("- search_products:", existingSearch ? `updating host=${safeHost(toolUrl(existingSearch)) || "(none)"}` : "missing");
  }
  if (needsAdd) {
    console.log("- add_to_selection:", existingAdd ? `updating host=${safeHost(toolUrl(existingAdd)) || "(none)"}` : "missing");
  }
  if (needsCreate) {
    console.log("- create_draft_order:", existingCreate ? `updating host=${safeHost(toolUrl(existingCreate)) || "(none)"}` : "missing");
  }
  console.log("");

  if (!changed) {
    console.log("No changes needed.");
    return;
  }

  const updateRes = await telnyxJson(`https://api.telnyx.com/v2/ai/assistants/${encodeURIComponent(assistantId)}`, {
    method: "POST",
    body: JSON.stringify({ tools: nextTools }),
  });
  if (!updateRes.ok) {
    console.error("Failed to update assistant:", updateRes.status, updateRes.text.slice(0, 300));
    process.exit(1);
  }

  const updated =
    updateRes.parsed && typeof updateRes.parsed === "object" && "data" in updateRes.parsed
      ? (updateRes.parsed as any).data
      : updateRes.parsed;
  const tools: any[] = Array.isArray(updated?.tools) ? updated.tools : [];

  console.log("Updated assistant tools:");
  for (const t of tools) {
    const name = toolName(t) || "(unnamed)";
    const type = typeof t?.type === "string" ? t.type : "(type?)";
    const host = safeHost(t?.url) || safeHost(t?.webhook?.url);
    console.log(`- ${name} [${type}] host=${host || "(none)"}`);
  }
}

main().catch((e) => {
  console.error("Ensure tools failed:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});

