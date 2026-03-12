import { NextResponse, type NextRequest } from "next/server";
import {
  getRecipientAndCampaignByCallControlId,
  getPurchaseState,
  getCampaignAutomationSettings,
  triggerDraftOrderAndSaveResult,
} from "@/src/core/campaigns/purchase-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      tool: "create_draft_order",
      description:
        "Telnyx AI assistant webhook tool. Use POST with { customerConfirmed: true } to trigger draft order creation.",
    },
    { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
  );
}

function parseStrictBoolean(value: unknown): boolean {
  if (value === true) return true;
  if (value === 1) return true;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "true" || v === "1" || v === "yes" || v === "y" || v === "confirmed" || v === "confirm";
  }
  return false;
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
  return { ...nested, ...body };
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
  const rawBody = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  console.info("[CampaignPurchase:RAW_REQUEST_BODY]", rawBody);
  const body = rawBody?.arguments || rawBody?.args || rawBody || {};
  console.info("[CampaignPurchase:NORMALIZED_BODY]", body);
  console.info("[CampaignPurchase:CREATE_DRAFT_PAYLOAD]", body);
  const normalizedBody = getToolArgsBody(body);

  const callControlId = getCallControlId(request, normalizedBody);
  console.info("[CampaignPurchase:create-draft-order] Request received", {
    hasCallControlId: Boolean(callControlId),
    bodyKeys: Object.keys(normalizedBody).slice(0, 20),
    rawBodyKeys: Object.keys(body).slice(0, 20),
    hasCallControlIdHeader: Boolean(request.headers.get("x-telnyx-call-control-id")),
    hasNestedArguments:
      Object.keys(asRecord(body.arguments)).length > 0 ||
      Object.keys(asRecord(body.args)).length > 0 ||
      Object.keys(asRecord(asRecord(body.data).arguments)).length > 0 ||
      Object.keys(asRecord(asRecord(asRecord(body.data).payload).arguments)).length > 0,
  });
  // #region agent log
  fetch("http://127.0.0.1:7737/ingest/b427048e-2887-4159-bcae-6153d02c1fa9", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a1db95" },
    body: JSON.stringify({
      sessionId: "a1db95",
      runId: "pre-fix",
      hypothesisId: "H1",
      location: "create-draft-order/route.ts:callControlId-resolved",
      message: "create-draft-order received request",
      data: {
        hasCallControlId: Boolean(callControlId),
        bodyKeys: Object.keys(normalizedBody).slice(0, 15),
        hasCustomerConfirmedKey:
          "customerConfirmed" in normalizedBody ||
          "customer_confirmed" in normalizedBody ||
          "confirmed" in normalizedBody,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  if (!callControlId) {
    // #region agent log
    fetch("http://127.0.0.1:7737/ingest/b427048e-2887-4159-bcae-6153d02c1fa9", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a1db95" },
      body: JSON.stringify({
        sessionId: "a1db95",
        runId: "pre-fix",
        hypothesisId: "H1",
        location: "create-draft-order/route.ts:missing-call-control-id",
        message: "Returning 400 missing_call_control_id",
        data: { error: "missing_call_control_id" },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
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

  const confirmedRaw =
    normalizedBody.customerConfirmed ?? normalizedBody.customer_confirmed ?? normalizedBody.confirmed;
  const customerConfirmed = parseStrictBoolean(confirmedRaw);
  const forceRaw = normalizedBody.force ?? normalizedBody.forceCreate ?? normalizedBody.force_create;
  const forceCreate = parseStrictBoolean(forceRaw);

  const state = getPurchaseState(ctx.result);
  // #region agent log
  fetch("http://127.0.0.1:7737/ingest/b427048e-2887-4159-bcae-6153d02c1fa9", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a1db95" },
    body: JSON.stringify({
      sessionId: "a1db95",
      runId: "pre-fix",
      hypothesisId: "H3",
      location: "create-draft-order/route.ts:purchase-state-read",
      message: "Loaded purchase state before validation",
      data: {
        customerConfirmed,
        forceCreate,
        selectedProductsCount: state.selectedProducts?.length ?? 0,
        hasInvoiceUrl: Boolean(state.invoiceUrl),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
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
    console.warn("[CampaignPurchase:create-draft-order] Returning 400 no_products", {
      callControlId,
      recipientId: ctx.recipientId,
      campaignId: ctx.campaignId,
      customerConfirmed,
      selectedProductsCount: state.selectedProducts?.length ?? 0,
      hasInvoiceUrl: Boolean(state.invoiceUrl),
      bodyKeys: Object.keys(normalizedBody).slice(0, 20),
    });
    // #region agent log
    fetch("http://127.0.0.1:7737/ingest/b427048e-2887-4159-bcae-6153d02c1fa9", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a1db95" },
      body: JSON.stringify({
        sessionId: "a1db95",
        runId: "pre-fix",
        hypothesisId: "H3",
        location: "create-draft-order/route.ts:no-products",
        message: "Returning 400 no_products due to empty selectedProducts",
        data: { error: "no_products", selectedProductsCount: 0, customerConfirmed },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return NextResponse.json(
      {
        content:
          "You don't have any products in your selection yet. Tell me what you'd like, and once we have your items I can send you the checkout link by email.",
        error: "no_products",
      },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  const bodyEmail =
    typeof normalizedBody.customerEmail === "string"
      ? normalizedBody.customerEmail
      : typeof normalizedBody.customer_email === "string"
        ? normalizedBody.customer_email
        : typeof normalizedBody.email === "string"
          ? normalizedBody.email
          : undefined;
  const customerEmail =
    (bodyEmail && bodyEmail.trim() ? bodyEmail.trim() : undefined) ||
    (typeof ctx.recipientEmail === "string" && ctx.recipientEmail.trim()
      ? ctx.recipientEmail.trim()
      : undefined);

  if (!customerEmail) {
    console.warn("[CampaignPurchase:create-draft-order] missing_customer_email", {
      recipientId: ctx.recipientId,
      campaignId: ctx.campaignId,
      callControlId,
    });
    return NextResponse.json(
      {
        content:
          "I can send the checkout link by email, but I don't have an email address on file. What email should I send it to?",
        error: "missing_customer_email",
        success: false,
      },
      { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
  const confirmedAt = new Date().toISOString();

  try {
    console.info("[CampaignPurchase:create-draft-order] Confirmation received", {
      callControlId,
      recipientId: ctx.recipientId,
      campaignId: ctx.campaignId,
      selectedCount: state.selectedProducts?.length ?? 0,
      selectedProducts: (state.selectedProducts ?? []).map((p) => ({
        productTitle: p.productTitle,
        variantId: p.variantId,
        quantity: p.quantity,
        sku: p.sku,
      })),
      hasCustomerEmail: true,
      forceCreate,
    });
    const result = await triggerDraftOrderAndSaveResult(
      ctx.recipientId,
      ctx.result,
      automation.webhookUrl,
      {
        customerEmail,
        checkoutConfirmed: true,
        checkoutConfirmedAt: confirmedAt,
      }
    );
    if (!result.ok) {
      console.warn("[CampaignPurchase:create-draft-order] Draft order failed", {
        recipientId: ctx.recipientId,
        campaignId: ctx.campaignId,
        message: result.message,
      });
      return NextResponse.json(
        { content: result.message, error: "draft_order_failed" },
        { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }
    console.info("[CampaignPurchase:create-draft-order] Success", {
      recipientId: ctx.recipientId,
      campaignId: ctx.campaignId,
      invoiceUrl: result.invoiceUrl,
    });
    return NextResponse.json(
      {
        content: result.message,
        result: result.message,
        invoiceUrl: result.invoiceUrl,
        success: true,
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
