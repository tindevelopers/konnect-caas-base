import { NextResponse, type NextRequest } from "next/server";
import {
  getRecipientAndCampaignByCallControlId,
  getPurchaseState,
  getCampaignAutomationSettings,
  triggerDraftOrderAndSaveResult,
} from "@/src/core/campaigns/purchase-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseStrictBoolean(value: unknown): boolean {
  return value === true || value === "true";
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
 * Telnyx AI assistant tool: create_draft_order / send_checkout_email
 * Call this ONLY after the customer has explicitly confirmed they want the checkout link sent (e.g. "Yes, send it").
 * Triggers the campaign webhook with selected products and stores the returned invoiceUrl.
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
      { content: "Call context is missing. I can't create the checkout without an active call.", error: "missing_call_control_id" },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  const ctx = await getRecipientAndCampaignByCallControlId(callControlId);
  if (!ctx) {
    return NextResponse.json(
      { content: "This call isn't linked to a campaign. I can't create a checkout.", error: "not_campaign_call" },
      { status: 404, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  const automation = getCampaignAutomationSettings(ctx.campaignSettings);
  if (!automation.enableProductPurchaseFlow || !automation.webhookUrl?.trim()) {
    return NextResponse.json(
      { content: "This campaign doesn't support sending a checkout link by email.", error: "purchase_flow_disabled" },
      { status: 403, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  const confirmedRaw = body.customerConfirmed ?? body.customer_confirmed ?? body.confirmed;
  const customerConfirmed = parseStrictBoolean(confirmedRaw);
  const forceRaw = body.force ?? body.forceCreate ?? body.force_create;
  const forceCreate = parseStrictBoolean(forceRaw);

  const state = getPurchaseState(ctx.result);
  if (state.invoiceUrl && !forceCreate) {
    return NextResponse.json(
      {
        content: "I've already generated your checkout link. Would you like me to resend it?",
        result: "I've already generated your checkout link. Would you like me to resend it?",
        invoiceUrl: state.invoiceUrl,
        error: "invoice_already_exists",
      },
      { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  if (!customerConfirmed) {
    return NextResponse.json(
      {
        content: "Are you happy with those products? I can send the checkout link to your email.",
        error: "needs_final_confirmation",
      },
      { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  if (!state.selectedProducts?.length) {
    return NextResponse.json(
      {
        content:
          "You don't have any products in your selection yet. Tell me what you'd like, and once we have your items I can send you the checkout link by email.",
        error: "no_products",
      },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  const customerEmail = typeof body.customerEmail === "string" ? body.customerEmail : typeof body.customer_email === "string" ? body.customer_email : undefined;
  const confirmedAt = new Date().toISOString();

  try {
    const result = await triggerDraftOrderAndSaveResult(
      ctx.recipientId,
      ctx.result,
      automation.webhookUrl,
      {
        customerEmail: customerEmail ? customerEmail.trim() : undefined,
        checkoutConfirmed: true,
        checkoutConfirmedAt: confirmedAt,
      }
    );
    if (!result.ok) {
      return NextResponse.json(
        { content: result.message, error: "draft_order_failed" },
        { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }
    return NextResponse.json(
      {
        content: result.message,
        result: result.message,
        invoiceUrl: result.invoiceUrl,
      },
      { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[CampaignPurchase:create-draft-order]", msg);
    return NextResponse.json(
      { content: "Something went wrong creating your checkout link. Please try again in a moment.", error: msg },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
