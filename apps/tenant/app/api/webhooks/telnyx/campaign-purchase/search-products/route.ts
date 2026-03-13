import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/core/database/admin-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Abacus Predictions API for product search.
 * Requires env: ABACUS_DEPLOYMENT_TOKEN, ABACUS_DEPLOYMENT_ID.
 * For add_to_selection to work, the Abacus deployment should return a top-level or nested
 * `products` array with objects containing at least variantId (or variant_id).
 */
const ABACUS_GET_CHAT_RESPONSE_URL = "https://apps.abacus.ai/api/getChatResponse";
const PRODUCT_SEARCH_TIMEOUT_MS = 12000;

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      tool: "search_products",
      description:
        "Telnyx AI assistant webhook tool. Use POST with { query } to search the product catalog. Returns products with variantId for use with add_to_selection.",
    },
    { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-telnyx-call-control-id",
    },
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function getHeadersSnapshot(request: NextRequest): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of request.headers.entries()) {
    const lower = key.toLowerCase();
    if (lower === "authorization" || lower === "cookie" || lower === "set-cookie") {
      out[key] = "[redacted]";
      continue;
    }
    out[key] = value;
  }
  return out;
}

function extractQuery(body: Record<string, unknown>): string | null {
  const candidates = [
    body.query,
    body.message,
    body.search,
    body.product_query,
    body.productQuery,
    body.text,
    body.input,
  ];

  // Also check nested arguments (Telnyx tool invocation envelope)
  const nested = asRecord(body.arguments);
  candidates.push(
    nested.query,
    nested.message,
    nested.search,
    nested.product_query,
    nested.productQuery,
    nested.text,
    nested.input,
  );

  const data = asRecord(body.data);
  const payload = asRecord(data.payload);
  const payloadArgs = asRecord(payload.arguments);
  candidates.push(
    data.query, data.message,
    payload.query, payload.message,
    payloadArgs.query, payloadArgs.message,
  );

  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

function extractCallControlId(request: NextRequest): string | null {
  const fromHeader = request.headers.get("x-telnyx-call-control-id");
  if (typeof fromHeader === "string" && fromHeader.trim()) return fromHeader.trim();
  return null;
}

function asConversationId(payload: unknown): string | null {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const nested = asRecord(data.payload);
  const candidate =
    nested.conversation_id ??
    data.conversation_id ??
    root.conversation_id;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
}

async function findConversationIdByCallControlId(
  callControlId: string
): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await (admin.from("ai_agent_events") as any)
      .select("payload,received_at,event_type")
      .eq("provider", "telnyx")
      .eq("external_id", callControlId)
      .in("event_type", ["call.conversation.created", "call.conversation.ended"])
      .order("received_at", { ascending: false })
      .limit(10);

    if (error || !Array.isArray(data)) {
      console.warn("[CampaignPurchase:search-products] conversationLookupQueryFailed", {
        hasError: Boolean(error),
        callControlId,
      });
      return null;
    }

    console.info("[CampaignPurchase:search-products] conversationLookupRows", {
      callControlId,
      rowCount: data.length,
      eventTypes: data
        .map((row) => row?.event_type)
        .filter((v): v is string => typeof v === "string")
        .slice(0, 10),
    });

    for (const row of data) {
      const id = asConversationId(row?.payload);
      if (id) return id;
    }
    console.info("[CampaignPurchase:search-products] conversationLookupNoConversationId", {
      callControlId,
    });
    return null;
  } catch {
    console.warn("[CampaignPurchase:search-products] conversationLookupException", {
      callControlId,
    });
    return null;
  }
}

async function findQueryFromConversationMessages(
  conversationId: string
): Promise<string | null> {
  const apiKey = process.env.TELNYX_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[CampaignPurchase:search-products] conversationMessageLookupSkipped", {
      reason: "missing_telnyx_api_key",
      conversationId,
    });
    return null;
  }

  try {
    const res = await fetch(
      `https://api.telnyx.com/v2/ai/conversations/${encodeURIComponent(conversationId)}/messages?sort=desc&page[size]=50`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.ok) return null;

    const json = (await res.json()) as Record<string, unknown>;
    const messages = Array.isArray(json.data) ? json.data : [];
    console.info("[CampaignPurchase:search-products] conversationMessagesFetched", {
      conversationId,
      count: messages.length,
    });

    for (const msg of messages) {
      const message = asRecord(msg);
      const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
      for (const rawToolCall of toolCalls) {
        const toolCall = asRecord(rawToolCall);
        const fn = asRecord(toolCall.function);
        if (fn.name !== "search_products") continue;
        if (typeof fn.arguments !== "string" || !fn.arguments.trim()) continue;
        try {
          const args = JSON.parse(fn.arguments) as Record<string, unknown>;
          const q = typeof args.query === "string" ? args.query.trim() : "";
          if (q) return q;
        } catch {
          continue;
        }
      }
    }

    console.info("[CampaignPurchase:search-products] conversationMessagesNoToolArgs", {
      conversationId,
    });
    return null;
  } catch {
    console.warn("[CampaignPurchase:search-products] conversationMessageLookupException", {
      conversationId,
    });
    return null;
  }
}

type ProductSearchProduct = {
  name?: string;
  title?: string;
  variantId?: string;
  variant_id?: string;
  price?: number | string;
  url?: string;
  image?: string;
  description?: string;
  sku?: string;
  availability?: string | boolean;
  [key: string]: unknown;
};

function normalizeProduct(raw: ProductSearchProduct) {
  const variantId = raw.variantId ?? raw.variant_id ?? "";
  const name = raw.name ?? raw.title ?? "";
  return {
    name,
    variantId,
    price: raw.price ?? null,
    url: raw.url ?? null,
    sku: raw.sku ?? null,
    availability: raw.availability ?? null,
    description: raw.description ?? null,
  };
}

/** Abacus getChatResponse can return content in several shapes. */
function extractAbacusContent(payload: Record<string, unknown>): string {
  const choices = payload.choices as Array<{ message?: { content?: string | null } }> | undefined;
  if (Array.isArray(choices) && choices[0]?.message?.content != null) {
    const c = choices[0].message.content;
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  const c = payload.content ?? payload.response ?? payload.message;
  if (typeof c === "string" && c.trim()) return c.trim();
  return "";
}

/** Extract products array from Abacus response (top-level or nested). */
function extractAbacusProducts(payload: Record<string, unknown>): unknown[] {
  if (Array.isArray(payload.products)) return payload.products;
  const data = asRecord(payload.data);
  if (Array.isArray(data.products)) return data.products;
  const result = asRecord(payload.result);
  if (Array.isArray(result.products)) return result.products;
  return [];
}

export async function POST(request: NextRequest) {
  const runId = `search-products-${Date.now()}`;
  const headersSnapshot = getHeadersSnapshot(request);
  const rawText = await request.text().catch(() => "");
  let rawBody: unknown = null;
  if (rawText) {
    try {
      rawBody = JSON.parse(rawText) as unknown;
    } catch {
      rawBody = null;
    }
  }
  console.info("[CampaignPurchase:search-products] requestHeaders", headersSnapshot);
  console.info("[CampaignPurchase:search-products] rawBody", rawBody);
  console.info("[CampaignPurchase:search-products] requestMeta", {
    urlPath: request.nextUrl.pathname,
    urlQuery: request.nextUrl.search,
    contentLength: request.headers.get("content-length"),
    contentType: request.headers.get("content-type"),
  });
  // #region agent log
  fetch("http://127.0.0.1:7737/ingest/b427048e-2887-4159-bcae-6153d02c1fa9",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"ffbe86"},body:JSON.stringify({sessionId:"ffbe86",runId,hypothesisId:"H1",location:"search-products/route.ts:post-entry",message:"incoming webhook payload shape",data:{contentLength:request.headers.get("content-length") ?? null,contentType:request.headers.get("content-type") ?? null,hasRawText:rawText.length > 0,rawTextLength:rawText.length,rawBodyType:rawBody === null ? "null" : Array.isArray(rawBody) ? "array" : typeof rawBody,urlPath:request.nextUrl.pathname,urlQuery:request.nextUrl.search},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  const body = asRecord(rawBody)?.arguments || asRecord(rawBody)?.args || rawBody || {};
  const bodyRecord = asRecord(body);
  let query = extractQuery(bodyRecord);
  console.info("[CampaignPurchase:search-products] parsedQuery", query);
  // #region agent log
  fetch("http://127.0.0.1:7737/ingest/b427048e-2887-4159-bcae-6153d02c1fa9",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"ffbe86"},body:JSON.stringify({sessionId:"ffbe86",runId,hypothesisId:"H2",location:"search-products/route.ts:query-parse",message:"query extraction result",data:{queryPresent:typeof query === "string" && query.length > 0,queryLength:typeof query === "string" ? query.length : 0,bodyKeys:Object.keys(bodyRecord).slice(0,20)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  if (!query) {
    const callControlId = extractCallControlId(request);
    const conversationId = callControlId
      ? await findConversationIdByCallControlId(callControlId)
      : null;
    const recoveredQuery = conversationId
      ? await findQueryFromConversationMessages(conversationId)
      : null;
    console.info("[CampaignPurchase:search-products] fallbackAttempt", {
      callControlId,
      conversationId,
      recoveredQueryPresent: Boolean(recoveredQuery),
    });

    // #region agent log
    fetch("http://127.0.0.1:7737/ingest/b427048e-2887-4159-bcae-6153d02c1fa9",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"ffbe86"},body:JSON.stringify({sessionId:"ffbe86",runId,hypothesisId:"H6",location:"search-products/route.ts:conversation-fallback",message:"attempted query recovery from conversation",data:{callControlIdPresent:!!callControlId,conversationIdPresent:!!conversationId,recoveredQueryPresent:!!recoveredQuery,recoveredQueryLength:recoveredQuery?.length ?? 0},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    if (recoveredQuery) {
      query = recoveredQuery;
      console.info("[CampaignPurchase:search-products] recoveredQueryFromConversation", {
        callControlId,
        conversationId,
        recoveredQuery,
      });
    }
  }

  if (!query) {
    console.warn("[CampaignPurchase:search-products] 400: missing query", {
      bodyKeys: Object.keys(bodyRecord).slice(0, 20),
      rawTextPreview: rawText.slice(0, 200),
    });
    // #region agent log
    fetch("http://127.0.0.1:7737/ingest/b427048e-2887-4159-bcae-6153d02c1fa9",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"ffbe86"},body:JSON.stringify({sessionId:"ffbe86",runId,hypothesisId:"H3",location:"search-products/route.ts:missing-query-branch",message:"missing query branch taken",data:{rawTextPreview:rawText.slice(0,120),acceptHeader:request.headers.get("accept") ?? null,userAgent:request.headers.get("user-agent") ?? null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return NextResponse.json(
      {
        content:
          "Please call search_products again with JSON like {\"query\":\"cordless dog clipper\"}.",
        products: [],
      },
      { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  const deploymentToken = process.env.ABACUS_DEPLOYMENT_TOKEN?.trim();
  const deploymentId = process.env.ABACUS_DEPLOYMENT_ID?.trim();
  if (!deploymentToken || !deploymentId) {
    console.warn("[CampaignPurchase:search-products] Abacus not configured", {
      hasToken: Boolean(deploymentToken),
      hasDeploymentId: Boolean(deploymentId),
    });
    return NextResponse.json(
      {
        content: "I'm having trouble searching the catalog right now.",
        products: [],
      },
      { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  const abacusUrl = `${ABACUS_GET_CHAT_RESPONSE_URL}?${new URLSearchParams({
    deploymentToken,
    deploymentId,
  }).toString()}`;

  console.info("[CampaignPurchase:search-products] Searching", { query });
  // #region agent log
  fetch("http://127.0.0.1:7737/ingest/b427048e-2887-4159-bcae-6153d02c1fa9",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"ffbe86"},body:JSON.stringify({sessionId:"ffbe86",runId,hypothesisId:"H4",location:"search-products/route.ts:before-upstream",message:"about to call Abacus getChatResponse",data:{queryLength:query.length,queryPreview:query.slice(0,40)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PRODUCT_SEARCH_TIMEOUT_MS);

    const searchRes = await fetch(abacusUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ is_user: true, text: query }],
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!searchRes.ok) {
      const errText = await searchRes.text().catch(() => "");
      console.error("[CampaignPurchase:search-products] Abacus API error", {
        status: searchRes.status,
        body: errText.slice(0, 300),
      });
      return NextResponse.json(
        {
          content: "I'm having trouble searching the catalog right now.",
          products: [],
        },
        { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const searchData = (await searchRes.json()) as Record<string, unknown>;
    const rawProducts = extractAbacusProducts(searchData);
    const products = rawProducts
      .filter((p): p is ProductSearchProduct => !!p && typeof p === "object")
      .map(normalizeProduct)
      .slice(0, 10);

    const abacusContent = extractAbacusContent(searchData);

    console.info("[CampaignPurchase:search-products] Results", {
      query,
      totalRaw: rawProducts.length,
      returned: products.length,
      hasVariantIds: products.filter((p) => !!p.variantId).length,
    });
    // #region agent log
    fetch("http://127.0.0.1:7737/ingest/b427048e-2887-4159-bcae-6153d02c1fa9",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"ffbe86"},body:JSON.stringify({sessionId:"ffbe86",runId,hypothesisId:"H5",location:"search-products/route.ts:upstream-results",message:"Abacus results normalized",data:{rawProducts:rawProducts.length,returnedProducts:products.length,variantIdCount:products.filter((p)=>!!p.variantId).length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    if (products.length === 0) {
      const clarification =
        abacusContent ||
        "No products matched your search. Could you be more specific about what you're looking for?";

      return NextResponse.json(
        {
          content: clarification,
          products: [],
        },
        { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const productList = products
      .map((p, i) => {
        const parts = [`${i + 1}. ${p.name}`];
        if (p.price != null) parts.push(`Price: ${p.price}`);
        if (p.variantId) parts.push(`variantId: ${p.variantId}`);
        return parts.join(" — ");
      })
      .join("\n");

    const content =
      abacusContent ||
      `Here are the products I found:\n${productList}\n\nWhen the customer selects a product, call add_to_selection with the exact variantId and quantity.`;

    return NextResponse.json(
      {
        content,
        products,
      },
      { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = (err as Error)?.name === "AbortError" || msg.includes("abort");
    console.error("[CampaignPurchase:search-products]", isTimeout ? "Timeout" : msg);
    return NextResponse.json(
      {
        content: "I'm having trouble searching the catalog right now.",
        products: [],
      },
      { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
