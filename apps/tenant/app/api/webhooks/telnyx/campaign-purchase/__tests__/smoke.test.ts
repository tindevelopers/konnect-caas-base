/**
 * End-to-end smoke tests for the campaign purchase flow (Phase 1 + Phase 2).
 * Runs all validation scenarios with mocks; no real DB or webhook required.
 *
 * TEST 1 — Phase 1 only: add-to-selection and verify persistence path
 * TEST 2 — Confirmation missing: create-draft-order without customerConfirmed → webhook NOT triggered
 * TEST 3 — Happy path: create-draft-order with customerConfirmed=true → webhook triggered, invoiceUrl returned
 * TEST 4 — Duplicate prevention: second create-draft-order returns existing invoiceUrl, no second webhook
 * TEST 5 — Missing gates: enableProductPurchaseFlow false → order creation blocked
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/src/core/campaigns/purchase-flow", () => ({
  getRecipientAndCampaignByCallControlId: vi.fn(),
  addSelectedProduct: vi.fn(),
  getPurchaseState: vi.fn(),
  getCampaignAutomationSettings: vi.fn(),
  triggerDraftOrderAndSaveResult: vi.fn(),
}));

import {
  getRecipientAndCampaignByCallControlId,
  addSelectedProduct,
  getPurchaseState,
  getCampaignAutomationSettings,
  triggerDraftOrderAndSaveResult,
} from "@/src/core/campaigns/purchase-flow";
import { POST as addToSelectionPost } from "../add-to-selection/route";
import { POST as createDraftOrderPost } from "../create-draft-order/route";

const CALL_CONTROL_ID = "smoke-call-ctrl-123";

function jsonResponse<T>(res: Response): Promise<T> {
  return res.json();
}

async function addToSelection(body: Record<string, unknown>, header?: string) {
  const req = new NextRequest("http://localhost/api/webhooks/telnyx/campaign-purchase/add-to-selection", {
    method: "POST",
    headers: header ? { "x-telnyx-call-control-id": header, "Content-Type": "application/json" } : { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return addToSelectionPost(req);
}

async function createDraftOrder(body: Record<string, unknown>, header?: string) {
  const req = new NextRequest("http://localhost/api/webhooks/telnyx/campaign-purchase/create-draft-order", {
    method: "POST",
    headers: header ? { "x-telnyx-call-control-id": header, "Content-Type": "application/json" } : { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return createDraftOrderPost(req);
}

describe("Campaign purchase flow smoke tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("TEST 1 — Phase 1 only: add-to-selection persists product and returns selectedCount", async () => {
    vi.mocked(getRecipientAndCampaignByCallControlId).mockResolvedValue({
      recipientId: "r1",
      campaignId: "c1",
      tenantId: "t1",
      result: {},
      campaignSettings: {},
    });
    vi.mocked(getCampaignAutomationSettings).mockReturnValue({
      enableProductPurchaseFlow: true,
      webhookUrl: "https://webhook.example.com",
    });
    vi.mocked(addSelectedProduct).mockResolvedValue({
      selectedProducts: [
        { productTitle: "Andis Clipper", variantId: "gid://shopify/ProductVariant/123", quantity: 1 },
      ],
    });

    const res = await addToSelection(
      { call_control_id: CALL_CONTROL_ID, productTitle: "Andis Clipper", variantId: "gid://shopify/ProductVariant/123", quantity: 1 },
      CALL_CONTROL_ID
    );
    expect(res.status).toBe(200);
    const data = await jsonResponse<{ content: string; selectedCount: number }>(res);
    expect(data.selectedCount).toBe(1);
    expect(addSelectedProduct).toHaveBeenCalledWith(
      "r1",
      expect.any(Object),
      expect.objectContaining({ variantId: "gid://shopify/ProductVariant/123", quantity: 1 })
    );
    expect(triggerDraftOrderAndSaveResult).not.toHaveBeenCalled();
  });

  it("TEST 2 — create-draft-order without customerConfirmed does NOT trigger webhook", async () => {
    vi.mocked(getRecipientAndCampaignByCallControlId).mockResolvedValue({
      recipientId: "r1",
      campaignId: "c1",
      tenantId: "t1",
      result: { purchase: { selectedProducts: [{ variantId: "gid://shopify/ProductVariant/1", quantity: 1 }] } },
      campaignSettings: {},
    });
    vi.mocked(getCampaignAutomationSettings).mockReturnValue({
      enableProductPurchaseFlow: true,
      webhookUrl: "https://webhook.example.com",
    });
    vi.mocked(getPurchaseState).mockReturnValue({
      selectedProducts: [{ productTitle: "X", variantId: "gid://shopify/ProductVariant/1", quantity: 1 }],
      invoiceUrl: undefined,
    });

    const res = await createDraftOrder({ call_control_id: CALL_CONTROL_ID }, CALL_CONTROL_ID);
    expect(res.status).toBe(200);
    const data = await jsonResponse<{ error: string }>(res);
    expect(data.error).toBe("needs_final_confirmation");
    expect(triggerDraftOrderAndSaveResult).not.toHaveBeenCalled();
  });

  it("TEST 3 — Happy path: create-draft-order with customerConfirmed=true triggers webhook and returns invoiceUrl", async () => {
    vi.mocked(getRecipientAndCampaignByCallControlId).mockResolvedValue({
      recipientId: "r1",
      campaignId: "c1",
      tenantId: "t1",
      result: { purchase: { selectedProducts: [{ variantId: "gid://shopify/ProductVariant/1", quantity: 1 }] } },
      campaignSettings: {},
    });
    vi.mocked(getCampaignAutomationSettings).mockReturnValue({
      enableProductPurchaseFlow: true,
      webhookUrl: "https://webhook.example.com",
    });
    vi.mocked(getPurchaseState).mockReturnValue({
      selectedProducts: [{ productTitle: "X", variantId: "gid://shopify/ProductVariant/1", quantity: 1 }],
      invoiceUrl: undefined,
    });
    vi.mocked(triggerDraftOrderAndSaveResult).mockResolvedValue({
      ok: true,
      message: "I've sent the checkout link to your email.",
      invoiceUrl: "https://checkout.example.com/inv/abc",
    });

    const res = await createDraftOrder(
      { call_control_id: CALL_CONTROL_ID, customerConfirmed: true },
      CALL_CONTROL_ID
    );
    expect(res.status).toBe(200);
    const data = await jsonResponse<{ invoiceUrl: string; content: string }>(res);
    expect(data.invoiceUrl).toBe("https://checkout.example.com/inv/abc");
    expect(triggerDraftOrderAndSaveResult).toHaveBeenCalledWith(
      "r1",
      expect.any(Object),
      "https://webhook.example.com",
      expect.objectContaining({ checkoutConfirmed: true, checkoutConfirmedAt: expect.any(String) })
    );
  });

  it("TEST 4 — Duplicate prevention: second create-draft-order returns existing invoiceUrl without calling webhook", async () => {
    const existingInvoiceUrl = "https://checkout.example.com/inv/existing";
    vi.mocked(getRecipientAndCampaignByCallControlId).mockResolvedValue({
      recipientId: "r1",
      campaignId: "c1",
      tenantId: "t1",
      result: {
        purchase: {
          selectedProducts: [{ variantId: "gid://shopify/ProductVariant/1", quantity: 1 }],
          invoiceUrl: existingInvoiceUrl,
        },
      },
      campaignSettings: {},
    });
    vi.mocked(getCampaignAutomationSettings).mockReturnValue({
      enableProductPurchaseFlow: true,
      webhookUrl: "https://webhook.example.com",
    });
    vi.mocked(getPurchaseState).mockReturnValue({
      selectedProducts: [{ productTitle: "X", variantId: "gid://shopify/ProductVariant/1", quantity: 1 }],
      invoiceUrl: existingInvoiceUrl,
    });

    const res = await createDraftOrder(
      { call_control_id: CALL_CONTROL_ID, customerConfirmed: true },
      CALL_CONTROL_ID
    );
    expect(res.status).toBe(200);
    const data = await jsonResponse<{ invoiceUrl: string; error: string }>(res);
    expect(data.invoiceUrl).toBe(existingInvoiceUrl);
    expect(data.error).toBe("invoice_already_exists");
    expect(triggerDraftOrderAndSaveResult).not.toHaveBeenCalled();
  });

  it("TEST 5 — Missing gates: enableProductPurchaseFlow false blocks add-to-selection and create-draft-order", async () => {
    vi.mocked(getRecipientAndCampaignByCallControlId).mockResolvedValue({
      recipientId: "r1",
      campaignId: "c1",
      tenantId: "t1",
      result: {},
      campaignSettings: {},
    });
    vi.mocked(getCampaignAutomationSettings).mockReturnValue({
      enableProductPurchaseFlow: false,
      webhookUrl: "",
    });

    const addRes = await addToSelection(
      { call_control_id: CALL_CONTROL_ID, variantId: "gid://shopify/ProductVariant/1", quantity: 1 },
      CALL_CONTROL_ID
    );
    expect(addRes.status).toBe(403);
    const addData = await jsonResponse<{ error: string }>(addRes);
    expect(addData.error).toBe("purchase_flow_disabled");
    expect(addSelectedProduct).not.toHaveBeenCalled();

    vi.mocked(getCampaignAutomationSettings).mockReturnValue({
      enableProductPurchaseFlow: false,
      webhookUrl: "https://example.com",
    });
    const createRes = await createDraftOrder({ call_control_id: CALL_CONTROL_ID }, CALL_CONTROL_ID);
    expect(createRes.status).toBe(403);
    const createData = await jsonResponse<{ error: string }>(createRes);
    expect(createData.error).toBe("purchase_flow_disabled");
    expect(triggerDraftOrderAndSaveResult).not.toHaveBeenCalled();
  });
});
