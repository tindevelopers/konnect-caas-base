import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRODUCT_SEARCH_URL =
  process.env.PRODUCT_SEARCH_URL || "https://productsearch.mypetjet.com/api/chat";
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

export async function POST(request: NextRequest) {
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

  const body = asRecord(rawBody)?.arguments || asRecord(rawBody)?.args || rawBody || {};
  const bodyRecord = asRecord(body);
  const query = extractQuery(bodyRecord);
  console.info("[CampaignPurchase:search-products] parsedQuery", query);

  if (!query) {
    console.warn("[CampaignPurchase:search-products] 400: missing query", {
      bodyKeys: Object.keys(bodyRecord).slice(0, 20),
      rawTextPreview: rawText.slice(0, 200),
    });
    return NextResponse.json(
      {
        content: "Please provide a product search query.",
        products: [],
      },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  console.info("[CampaignPurchase:search-products] Searching", { query });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PRODUCT_SEARCH_TIMEOUT_MS);

    const searchRes = await fetch(PRODUCT_SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: query,
        conversationHistory: [],
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!searchRes.ok) {
      const errText = await searchRes.text().catch(() => "");
      console.error("[CampaignPurchase:search-products] Upstream error", {
        status: searchRes.status,
        body: errText.slice(0, 300),
      });
      return NextResponse.json(
        {
          content: "Product search is temporarily unavailable. Please try again.",
          error: "upstream_error",
        },
        { status: 502, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const searchData = (await searchRes.json()) as Record<string, unknown>;
    const rawProducts = Array.isArray(searchData.products) ? searchData.products : [];
    const products = rawProducts
      .filter((p): p is ProductSearchProduct => !!p && typeof p === "object")
      .map(normalizeProduct)
      .slice(0, 10);

    console.info("[CampaignPurchase:search-products] Results", {
      query,
      totalRaw: rawProducts.length,
      returned: products.length,
      hasVariantIds: products.filter((p) => !!p.variantId).length,
    });

    if (products.length === 0) {
      const clarification =
        typeof searchData.message === "string" && searchData.message.trim()
          ? searchData.message.trim()
          : typeof searchData.response === "string" && searchData.response.trim()
            ? searchData.response.trim()
            : "No products matched your search. Could you be more specific about what you're looking for?";

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

    const content = `Here are the products I found:\n${productList}\n\nWhen the customer selects a product, call add_to_selection with the exact variantId and quantity.`;

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
        content: isTimeout
          ? "Product search took too long. Please try a simpler query."
          : "I couldn't search products right now. Please try again.",
        error: isTimeout ? "timeout" : msg,
      },
      { status: isTimeout ? 504 : 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
