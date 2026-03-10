import { NextResponse, type NextRequest } from "next/server";
import {
  getRecipientAndCampaignByCallControlId,
  addSelectedProduct,
  getCampaignAutomationSettings,
  type SelectedProduct,
} from "@/src/core/campaigns/purchase-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const variantId = body.variantId ?? body.variant_id;
  const quantity = body.quantity;
  if (typeof variantId !== "string" || !variantId.trim()) return null;
  const q = typeof quantity === "number" ? quantity : typeof quantity === "string" ? parseInt(quantity, 10) : 1;
  if (!Number.isFinite(q) || q < 1) return null;
  return {
    productTitle: typeof body.productTitle === "string" ? body.productTitle : typeof body.product_title === "string" ? body.product_title : "",
    productUrl: typeof body.productUrl === "string" ? body.productUrl : typeof body.product_url === "string" ? body.product_url : undefined,
    variantId: variantId.trim(),
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
      { content: "I need at least variantId and quantity to add a product.", error: "invalid_product" },
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
