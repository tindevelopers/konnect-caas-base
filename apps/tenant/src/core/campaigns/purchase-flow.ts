/**
 * Two-stage campaign purchase flow: product selection (state) then final confirmation → webhook.
 * Selected products are stored in campaign_recipients.result; draft order is triggered only after confirmation.
 */

import { createAdminClient } from "@/core/database/admin-client";
import { getCampaignAutomationSettings } from "./automation-settings";

export type SelectedProduct = {
  productTitle: string;
  productUrl?: string;
  variantId: string;
  quantity: number;
  variantTitle?: string;
  sku?: string;
  price?: number;
};

export type CampaignPurchaseState = {
  selectedProducts?: SelectedProduct[];
  invoiceUrl?: string;
};

const RESULT_KEY = "purchase" as const;

function getPurchaseState(result: Record<string, unknown> | null | undefined): CampaignPurchaseState {
  const purchase = result?.[RESULT_KEY];
  if (!purchase || typeof purchase !== "object" || Array.isArray(purchase)) {
    return { selectedProducts: [] };
  }
  const obj = purchase as Record<string, unknown>;
  const selectedProducts = Array.isArray(obj.selectedProducts) ? obj.selectedProducts : [];
  const valid: SelectedProduct[] = selectedProducts
    .filter(
      (p): p is Record<string, unknown> =>
        p != null &&
        typeof p === "object" &&
        typeof (p as Record<string, unknown>).variantId === "string" &&
        typeof (p as Record<string, unknown>).quantity === "number"
    )
    .map((p) => ({
      productTitle: typeof p.productTitle === "string" ? p.productTitle : "",
      productUrl: typeof p.productUrl === "string" ? p.productUrl : undefined,
      variantId: String(p.variantId),
      quantity: Number(p.quantity) || 1,
      variantTitle: typeof p.variantTitle === "string" ? p.variantTitle : undefined,
      sku: typeof p.sku === "string" ? p.sku : undefined,
      price: typeof p.price === "number" ? p.price : undefined,
    }));
  return {
    selectedProducts: valid,
    invoiceUrl: typeof obj.invoiceUrl === "string" ? obj.invoiceUrl : undefined,
  };
}

export type RecipientWithCampaign = {
  recipientId: string;
  campaignId: string;
  tenantId: string;
  result: Record<string, unknown>;
  campaignSettings: Record<string, unknown>;
};

/**
 * Resolve campaign recipient and campaign settings by call_control_id (voice call).
 */
export async function getRecipientAndCampaignByCallControlId(
  callControlId: string
): Promise<RecipientWithCampaign | null> {
  if (!callControlId?.trim()) return null;
  const admin = createAdminClient();
  const { data: recipient } = await (admin.from("campaign_recipients") as any)
    .select("id, campaign_id, tenant_id, result")
    .eq("call_control_id", callControlId.trim())
    .limit(1)
    .maybeSingle();
  if (!recipient) return null;
  const { data: campaign } = await (admin.from("campaigns") as any)
    .select("settings")
    .eq("id", recipient.campaign_id)
    .limit(1)
    .maybeSingle();
  if (!campaign) return null;
  const settings = (campaign.settings ?? {}) as Record<string, unknown>;
  const result = (recipient.result ?? {}) as Record<string, unknown>;
  return {
    recipientId: recipient.id,
    campaignId: recipient.campaign_id,
    tenantId: recipient.tenant_id,
    result,
    campaignSettings: settings,
  };
}

/**
 * Append a selected product to the recipient's purchase state. Does not trigger webhook.
 */
export async function addSelectedProduct(
  recipientId: string,
  currentResult: Record<string, unknown>,
  product: SelectedProduct
): Promise<CampaignPurchaseState> {
  const state = getPurchaseState(currentResult);
  const list = state.selectedProducts ?? [];
  const nextList = [...list, product];
  const nextPurchase: CampaignPurchaseState = {
    ...state,
    selectedProducts: nextList,
  };
  const admin = createAdminClient();
  await (admin.from("campaign_recipients") as any)
    .update({
      result: { ...currentResult, [RESULT_KEY]: nextPurchase },
      updated_at: new Date().toISOString(),
    })
    .eq("id", recipientId);
  return nextPurchase;
}

/**
 * Build Railway payload from selectedProducts (lineItems only).
 */
export function buildDraftOrderPayload(selectedProducts: SelectedProduct[]): {
  lineItems: Array<{ variantId: string; quantity: number }>;
} {
  const lineItems = selectedProducts.map((p) => ({
    variantId: p.variantId,
    quantity: Math.max(1, Math.floor(p.quantity) || 1),
  }));
  return { lineItems };
}

/**
 * POST to campaign webhook URL and return { success, invoiceUrl?, error? }.
 */
export async function postDraftOrderToWebhook(
  webhookUrl: string,
  payload: { lineItems: Array<{ variantId: string; quantity: number }> },
  options?: { customerEmail?: string }
): Promise<{ success: true; invoiceUrl: string } | { success: false; error: string }> {
  const body = options?.customerEmail
    ? { ...payload, customerEmail: options.customerEmail }
    : payload;
  try {
    const res = await fetch(webhookUrl.trim(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      return { success: false, error: `Webhook returned ${res.status}: ${text.slice(0, 200)}` };
    }
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { success: false, error: "Webhook response was not JSON" };
    }
    const invoiceUrl =
      typeof data.invoiceUrl === "string"
        ? data.invoiceUrl
        : typeof (data as { invoice_url?: string }).invoice_url === "string"
          ? (data as { invoice_url: string }).invoice_url
          : "";
    if (!invoiceUrl) {
      return { success: false, error: "Webhook response did not include invoiceUrl" };
    }
    return { success: true, invoiceUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Run the draft-order flow: build payload, POST to webhook, update recipient result with invoiceUrl.
 * Call only after customer has confirmed. Returns message for Luna to speak.
 */
export async function triggerDraftOrderAndSaveResult(
  recipientId: string,
  currentResult: Record<string, unknown>,
  webhookUrl: string,
  options?: { customerEmail?: string }
): Promise<{ ok: true; message: string; invoiceUrl: string } | { ok: false; message: string }> {
  const state = getPurchaseState(currentResult);
  const list = state.selectedProducts ?? [];
  if (list.length === 0) {
    return { ok: false, message: "No products in your selection. Add products first, then I can send the checkout link." };
  }
  const payload = buildDraftOrderPayload(list);
  const postResult = await postDraftOrderToWebhook(webhookUrl, payload, options);
  if (!postResult.success) {
    return { ok: false, message: `Sorry, I couldn't create the checkout link right now. Please try again later. (${postResult.error})` };
  }
  const admin = createAdminClient();
  const nextPurchase: CampaignPurchaseState = {
    ...state,
    invoiceUrl: postResult.invoiceUrl,
  };
  await (admin.from("campaign_recipients") as any)
    .update({
      result: { ...currentResult, [RESULT_KEY]: nextPurchase },
      updated_at: new Date().toISOString(),
    })
    .eq("id", recipientId);
  return {
    ok: true,
    message: "I've sent the checkout link to your email. You can complete the purchase there.",
    invoiceUrl: postResult.invoiceUrl,
  };
}

export { getPurchaseState, getCampaignAutomationSettings };
