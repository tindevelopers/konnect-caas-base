import { NextResponse, type NextRequest } from "next/server";
import {
  getRecipientAndCampaignByCallControlId,
  addSelectedProduct,
  getCampaignAutomationSettings,
  type SelectedProduct,
} from "@/src/core/campaigns/purchase-flow";
import { normalizeShopifyVariantId, isShopifyVariantGid } from "@/src/core/campaigns/shopify-variant-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      tool: "add_to_selection",
      description:
        "Telnyx AI assistant webhook tool. Use POST with product + variantId + quantity to add a product to selection.",
    },
    { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
  );
}

function getCallControlId(request: NextRequest, body: Record<string, unknown>): string | null {
  const header = request.headers.get("x-telnyx-call-control-id")?.trim();
  if (header) return header;
  const data = asRecord(body.data);
  const payload = asRecord(data.payload);
  const bodyArgs = asRecord(body.arguments);
  const dataArgs = asRecord(data.arguments);
  const payloadArgs = asRecord(payload.arguments);
  const fromBody =
    (body.call_control_id as string) ??
    (body.callControlId as string) ??
    (data.call_control_id as string) ??
    (data.callControlId as string) ??
    (payload.call_control_id as string) ??
    (payload.callControlId as string) ??
    (bodyArgs.call_control_id as string) ??
    (bodyArgs.callControlId as string) ??
    (dataArgs.call_control_id as string) ??
    (dataArgs.callControlId as string) ??
    (payloadArgs.call_control_id as string) ??
    (payloadArgs.callControlId as string) ??
    (body.conversation_id as string) ??
    (body.conversationId as string) ??
    (data.conversation_id as string) ??
    (data.conversationId as string) ??
    (payload.conversation_id as string) ??
    (payload.conversationId as string) ??
    (bodyArgs.conversation_id as string) ??
    (bodyArgs.conversationId as string) ??
    (dataArgs.conversation_id as string) ??
    (dataArgs.conversationId as string) ??
    (payloadArgs.conversation_id as string) ??
    (payloadArgs.conversationId as string);
  return typeof fromBody === "string" && fromBody.trim() ? fromBody.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function getToolArgsBody(body: Record<string, unknown>): Record<string, unknown> {
  const data = asRecord(body.data);
  const payload = asRecord(data.payload);
  const nestedCandidates = [
    asRecord(body.arguments),
    asRecord(body.args),
    asRecord(data.arguments),
    asRecord(data.args),
    asRecord(payload.arguments),
    asRecord(payload.args),
  ];
  const nested = nestedCandidates.find((c) => Object.keys(c).length > 0) ?? {};
  // Keep top-level keys authoritative when both exist.
  return { ...nested, ...body };
}

function parseProduct(body: Record<string, unknown>): SelectedProduct | null {
  const variantIdRaw = body.variantId ?? body.variant_id ?? body.variantGid ?? body.variant_gid ?? body.shopifyVariantId;
  const quantity = body.quantity;
  const variantIdStr =
    typeof variantIdRaw === "string"
      ? variantIdRaw.trim()
      : typeof variantIdRaw === "number"
        ? String(variantIdRaw)
        : "";
  if (!variantIdStr) return null;
  const norm = normalizeShopifyVariantId(variantIdStr);
  const normalized = norm.normalized?.trim();
  if (!normalized) return null;
  if (!isShopifyVariantGid(normalized)) return null;
  const q = typeof quantity === "number" ? quantity : typeof quantity === "string" ? parseInt(quantity, 10) : 1;
  if (!Number.isFinite(q) || q < 1) return null;
  return {
    productTitle: typeof body.productTitle === "string" ? body.productTitle : typeof body.product_title === "string" ? body.product_title : "",
    productUrl: typeof body.productUrl === "string" ? body.productUrl : typeof body.product_url === "string" ? body.product_url : undefined,
    variantId: normalized,
    variantIdRaw: variantIdStr,
    variantIdSource: norm.source,
    quantity: Math.min(100, Math.max(1, q)),
    variantTitle: typeof body.variantTitle === "string" ? body.variantTitle : typeof body.variant_title === "string" ? body.variant_title : undefined,
    sku: typeof body.sku === "string" ? body.sku : undefined,
    price: typeof body.price === "number" ? body.price : undefined,
  };
}

function parseProductDebugContext(body: Record<string, unknown>): Record<string, unknown> {
  const variantIdRaw = body.variantId ?? body.variant_id ?? body.variantGid ?? body.variant_gid ?? body.shopifyVariantId;
  const quantity = body.quantity;
  const variantIdStr =
    typeof variantIdRaw === "string"
      ? variantIdRaw.trim()
      : typeof variantIdRaw === "number"
        ? String(variantIdRaw)
        : "";
  const norm = variantIdStr ? normalizeShopifyVariantId(variantIdStr) : null;
  const normalized = norm?.normalized?.trim() ?? "";
  const q = typeof quantity === "number" ? quantity : typeof quantity === "string" ? parseInt(quantity, 10) : 1;
  return {
    bodyKeys: Object.keys(body).slice(0, 20),
    hasVariantIdRaw: Boolean(variantIdRaw),
    variantIdRawType: typeof variantIdRaw,
    variantIdRawPreview: typeof variantIdRaw === "string" ? variantIdRaw.slice(0, 80) : variantIdRaw,
    normalizedVariantId: normalized || null,
    normalizedLooksLikeGid: normalized ? isShopifyVariantGid(normalized) : false,
    quantityType: typeof quantity,
    parsedQuantity: Number.isFinite(q) ? q : null,
  };
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

/**
 * Telnyx AI assistant tool: add_to_selection
 * Call this when the customer selects a product during discovery. Does NOT trigger the purchase webhook.
 * Body parameters: productTitle, productUrl?, variantId, quantity, variantTitle?, sku?, price?
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.json().catch(() => null);
  console.info("[CampaignPurchase:RAW_REQUEST_BODY]", rawBody);
  const body = rawBody?.arguments || rawBody?.args || rawBody || {};
  console.info("[CampaignPurchase:NORMALIZED_BODY]", body);
  console.info("[CampaignPurchase:ADD_SELECTION_PAYLOAD]", body);
  const bodyRecord = asRecord(body);
  const normalizedBody = getToolArgsBody(bodyRecord);

  const callControlId = getCallControlId(request, normalizedBody);
  console.info("[CampaignPurchase:add-to-selection] Request received", {
    hasCallControlId: Boolean(callControlId),
    bodyKeys: Object.keys(normalizedBody).slice(0, 20),
    hasNestedArguments:
      Object.keys(asRecord(bodyRecord.arguments)).length > 0 ||
      Object.keys(asRecord(bodyRecord.args)).length > 0 ||
      Object.keys(asRecord(asRecord(bodyRecord.data).arguments)).length > 0 ||
      Object.keys(asRecord(asRecord(asRecord(bodyRecord.data).payload).arguments)).length > 0,
    hasCallControlIdHeader: Boolean(request.headers.get("x-telnyx-call-control-id")),
    rawBodyKeys: Object.keys(bodyRecord).slice(0, 20),
  });
  // #region agent log
  fetch("http://127.0.0.1:7737/ingest/b427048e-2887-4159-bcae-6153d02c1fa9", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a1db95" },
    body: JSON.stringify({
      sessionId: "a1db95",
      runId: "pre-fix",
      hypothesisId: "H2",
      location: "add-to-selection/route.ts:entry",
      message: "add-to-selection received request",
      data: {
        hasCallControlId: Boolean(callControlId),
        bodyKeys: Object.keys(bodyRecord).slice(0, 15),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  if (!callControlId) {
    console.warn("[CampaignPurchase:add-to-selection] Returning 400 missing_call_control_id", {
      bodyKeys: Object.keys(normalizedBody).slice(0, 20),
    });
    return NextResponse.json(
      { content: "Call context is missing. I can't add products without an active call.", error: "missing_call_control_id" },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  const product = parseProduct(normalizedBody);
  if (!product) {
    console.warn("[CampaignPurchase:add-to-selection] Returning 400 invalid_product", {
      bodyKeys: Object.keys(bodyRecord),
      hasVariantIdRaw: Boolean(bodyRecord.variantId),
      variantIdRawType: typeof bodyRecord.variantId,
    });
    console.warn("[CampaignPurchase:add-to-selection] invalid_product details", parseProductDebugContext(normalizedBody));
    // #region agent log
    fetch("http://127.0.0.1:7737/ingest/b427048e-2887-4159-bcae-6153d02c1fa9", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a1db95" },
      body: JSON.stringify({
        sessionId: "a1db95",
        runId: "pre-fix",
        hypothesisId: "H2",
        location: "add-to-selection/route.ts:invalid-product",
        message: "Returning 400 invalid_product",
        data: {
          error: "invalid_product",
          hasVariantId: Boolean(
            normalizedBody.variantId ??
              normalizedBody.variant_id ??
              normalizedBody.variantGid ??
              normalizedBody.variant_gid ??
              normalizedBody.shopifyVariantId
          ),
          quantityType: typeof normalizedBody.quantity,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return NextResponse.json(
      {
        content:
          "I need a valid Shopify variantId (gid://shopify/ProductVariant/...) and quantity to add a product. Please try again with the exact variant.",
        error: "invalid_product",
      },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  const ctx = await getRecipientAndCampaignByCallControlId(callControlId);
  if (!ctx) {
    console.warn("[CampaignPurchase:add-to-selection] Returning 404 not_campaign_call", { callControlId });
    return NextResponse.json(
      { content: "This call isn't linked to a campaign. I can't track product selection.", error: "not_campaign_call" },
      { status: 404, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  const automation = getCampaignAutomationSettings(ctx.campaignSettings);
  if (!automation.enableProductPurchaseFlow) {
    console.warn("[CampaignPurchase:add-to-selection] Returning 403 purchase_flow_disabled", {
      callControlId,
      campaignId: ctx.campaignId,
    });
    return NextResponse.json(
      { content: "This campaign doesn't support product checkout.", error: "purchase_flow_disabled" },
      { status: 403, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  try {
    console.info("[CampaignPurchase:add-to-selection] Selection received", {
      callControlId,
      recipientId: ctx.recipientId,
      campaignId: ctx.campaignId,
      productTitle: product.productTitle,
      variantId: product.variantId,
      variantIdRaw: product.variantIdRaw,
      variantIdSource: product.variantIdSource,
      quantity: product.quantity,
      sku: product.sku,
    });
    const nextState = await addSelectedProduct(ctx.recipientId, ctx.result, product);
    const count = nextState.selectedProducts?.length ?? 0;
    // #region agent log
    fetch("http://127.0.0.1:7737/ingest/b427048e-2887-4159-bcae-6153d02c1fa9", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a1db95" },
      body: JSON.stringify({
        sessionId: "a1db95",
        runId: "pre-fix",
        hypothesisId: "H4",
        location: "add-to-selection/route.ts:selection-persisted",
        message: "Product persisted to purchase.selectedProducts",
        data: {
          recipientId: ctx.recipientId,
          selectedProductsCount: count,
          variantId: product.variantId,
          quantity: product.quantity,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    const message =
      count <= 1
        ? "Got it, I've added that to your selection."
        : `Done. You have ${count} item${count === 1 ? "" : "s"} in your selection. Would you like to add anything else, or shall I send you the checkout link by email?`;
    return NextResponse.json(
      { content: message, result: message, selectedCount: count },
      { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[CampaignPurchase:add-to-selection]", msg);
    return NextResponse.json(
      { content: "I couldn't add that right now. Please try again.", error: msg },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
