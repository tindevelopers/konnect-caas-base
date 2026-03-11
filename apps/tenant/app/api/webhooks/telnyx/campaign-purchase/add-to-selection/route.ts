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
  const fromBody =
    (body.call_control_id as string) ??
    (body.callControlId as string) ??
    (body.conversation_id as string) ??
    (body.conversationId as string);
  return typeof fromBody === "string" && fromBody.trim() ? fromBody.trim() : null;
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
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { content: "Invalid request body.", error: "invalid_json" },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  const callControlId = getCallControlId(request, body);
  if (!callControlId) {
    return NextResponse.json(
      { content: "Call context is missing. I can't add products without an active call.", error: "missing_call_control_id" },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  const product = parseProduct(body);
  if (!product) {
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
    return NextResponse.json(
      { content: "This call isn't linked to a campaign. I can't track product selection.", error: "not_campaign_call" },
      { status: 404, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  const automation = getCampaignAutomationSettings(ctx.campaignSettings);
  if (!automation.enableProductPurchaseFlow) {
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
