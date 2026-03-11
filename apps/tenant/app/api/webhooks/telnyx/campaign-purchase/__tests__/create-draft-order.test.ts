import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/src/core/campaigns/purchase-flow", () => ({
  getRecipientAndCampaignByCallControlId: vi.fn(),
  getPurchaseState: vi.fn(),
  getCampaignAutomationSettings: vi.fn(),
  triggerDraftOrderAndSaveResult: vi.fn(),
}));

import {
  getRecipientAndCampaignByCallControlId,
  getPurchaseState,
  getCampaignAutomationSettings,
  triggerDraftOrderAndSaveResult,
} from "@/src/core/campaigns/purchase-flow";
import { POST } from "../create-draft-order/route";

function jsonResponse<T>(res: Response): Promise<T> {
  return res.json();
}

describe("create-draft-order route", () => {
  const mockCallControlId = "call-ctrl-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function post(body: Record<string, unknown>, header?: string) {
    const req = new NextRequest("http://localhost/api/webhooks/telnyx/campaign-purchase/create-draft-order", {
      method: "POST",
      headers: header ? { "x-telnyx-call-control-id": header } : {},
      body: JSON.stringify(body),
    });
    return POST(req);
  }

  it("returns 400 when call_control_id is missing", async () => {
    vi.mocked(getRecipientAndCampaignByCallControlId).mockResolvedValue(null);

    const res = await post({});
    expect(res.status).toBe(400);
    const data = await jsonResponse<{ error: string }>(res);
    expect(data.error).toBe("missing_call_control_id");
  });

  it("returns 404 when not a campaign call", async () => {
    vi.mocked(getRecipientAndCampaignByCallControlId).mockResolvedValue(null);

    const res = await post({ call_control_id: mockCallControlId });
    expect(res.status).toBe(404);
    const data = await jsonResponse<{ error: string }>(res);
    expect(data.error).toBe("not_campaign_call");
  });

  it("returns 403 when enableProductPurchaseFlow is false", async () => {
    vi.mocked(getRecipientAndCampaignByCallControlId).mockResolvedValue({
      recipientId: "r1",
      campaignId: "c1",
      tenantId: "t1",
      result: {},
      campaignSettings: {},
    });
    vi.mocked(getCampaignAutomationSettings).mockReturnValue({
      enableProductPurchaseFlow: false,
      webhookUrl: "https://example.com",
    });

    const res = await post({ call_control_id: mockCallControlId });
    expect(res.status).toBe(403);
    const data = await jsonResponse<{ error: string }>(res);
    expect(data.error).toBe("purchase_flow_disabled");
  });

  it("returns 403 when webhookUrl is missing", async () => {
    vi.mocked(getRecipientAndCampaignByCallControlId).mockResolvedValue({
      recipientId: "r1",
      campaignId: "c1",
      tenantId: "t1",
      result: {},
      campaignSettings: {},
    });
    vi.mocked(getCampaignAutomationSettings).mockReturnValue({
      enableProductPurchaseFlow: true,
      webhookUrl: "",
    });

    const res = await post({ call_control_id: mockCallControlId });
    expect(res.status).toBe(403);
    const data = await jsonResponse<{ error: string }>(res);
    expect(data.error).toBe("purchase_flow_disabled");
  });

  it("returns 200 with needs_final_confirmation when customerConfirmed is missing", async () => {
    vi.mocked(getRecipientAndCampaignByCallControlId).mockResolvedValue({
      recipientId: "r1",
      campaignId: "c1",
      tenantId: "t1",
      result: { purchase: { selectedProducts: [{ variantId: "v1", quantity: 1 }] } },
      campaignSettings: { enableProductPurchaseFlow: true, webhookUrl: "https://example.com" },
    });
    vi.mocked(getCampaignAutomationSettings).mockReturnValue({
      enableProductPurchaseFlow: true,
      webhookUrl: "https://example.com",
    });
    vi.mocked(getPurchaseState).mockReturnValue({
      selectedProducts: [{ productTitle: "X", variantId: "v1", quantity: 1 }],
      invoiceUrl: undefined,
    });

    const res = await post({ call_control_id: mockCallControlId });
    expect(res.status).toBe(200);
    const data = await jsonResponse<{ error: string }>(res);
    expect(data.error).toBe("needs_final_confirmation");
    expect(triggerDraftOrderAndSaveResult).not.toHaveBeenCalled();
  });

  it("returns 200 with needs_final_confirmation when customerConfirmed is false", async () => {
    vi.mocked(getRecipientAndCampaignByCallControlId).mockResolvedValue({
      recipientId: "r1",
      campaignId: "c1",
      tenantId: "t1",
      result: { purchase: { selectedProducts: [{ variantId: "v1", quantity: 1 }] } },
      campaignSettings: { enableProductPurchaseFlow: true, webhookUrl: "https://example.com" },
    });
    vi.mocked(getCampaignAutomationSettings).mockReturnValue({
      enableProductPurchaseFlow: true,
      webhookUrl: "https://example.com",
    });
    vi.mocked(getPurchaseState).mockReturnValue({
      selectedProducts: [{ productTitle: "X", variantId: "v1", quantity: 1 }],
      invoiceUrl: undefined,
    });

    const res = await post({ call_control_id: mockCallControlId, customerConfirmed: false });
    expect(res.status).toBe(200);
    const data = await jsonResponse<{ error: string }>(res);
    expect(data.error).toBe("needs_final_confirmation");
    expect(triggerDraftOrderAndSaveResult).not.toHaveBeenCalled();
  });

  it("returns 200 with invoice_already_exists when invoiceUrl exists and force is not set", async () => {
    vi.mocked(getRecipientAndCampaignByCallControlId).mockResolvedValue({
      recipientId: "r1",
      campaignId: "c1",
      tenantId: "t1",
      result: { purchase: { selectedProducts: [], invoiceUrl: "https://checkout.example.com/inv" } },
      campaignSettings: { enableProductPurchaseFlow: true, webhookUrl: "https://example.com" },
    });
    vi.mocked(getCampaignAutomationSettings).mockReturnValue({
      enableProductPurchaseFlow: true,
      webhookUrl: "https://example.com",
    });
    vi.mocked(getPurchaseState).mockReturnValue({
      selectedProducts: [{ productTitle: "X", variantId: "v1", quantity: 1 }],
      invoiceUrl: "https://checkout.example.com/inv",
    });

    const res = await post({ call_control_id: mockCallControlId, customerConfirmed: true });
    expect(res.status).toBe(200);
    const data = await jsonResponse<{ error: string; invoiceUrl: string }>(res);
    expect(data.error).toBe("invoice_already_exists");
    expect(data.invoiceUrl).toBe("https://checkout.example.com/inv");
    expect(triggerDraftOrderAndSaveResult).not.toHaveBeenCalled();
  });

  it("returns 400 when selectedProducts is empty and customerConfirmed is true", async () => {
    vi.mocked(getRecipientAndCampaignByCallControlId).mockResolvedValue({
      recipientId: "r1",
      campaignId: "c1",
      tenantId: "t1",
      result: { purchase: {} },
      campaignSettings: { enableProductPurchaseFlow: true, webhookUrl: "https://example.com" },
    });
    vi.mocked(getCampaignAutomationSettings).mockReturnValue({
      enableProductPurchaseFlow: true,
      webhookUrl: "https://example.com",
    });
    vi.mocked(getPurchaseState).mockReturnValue({
      selectedProducts: [],
      invoiceUrl: undefined,
    });

    const res = await post({ call_control_id: mockCallControlId, customerConfirmed: true });
    expect(res.status).toBe(400);
    const data = await jsonResponse<{ error: string }>(res);
    expect(data.error).toBe("no_products");
    expect(triggerDraftOrderAndSaveResult).not.toHaveBeenCalled();
  });

  it("calls triggerDraftOrderAndSaveResult and returns invoiceUrl when all gates pass", async () => {
    vi.mocked(getRecipientAndCampaignByCallControlId).mockResolvedValue({
      recipientId: "r1",
      campaignId: "c1",
      tenantId: "t1",
      result: { purchase: { selectedProducts: [{ variantId: "v1", quantity: 1 }] } },
      campaignSettings: { enableProductPurchaseFlow: true, webhookUrl: "https://example.com" },
    });
    vi.mocked(getCampaignAutomationSettings).mockReturnValue({
      enableProductPurchaseFlow: true,
      webhookUrl: "https://example.com",
    });
    vi.mocked(getPurchaseState).mockReturnValue({
      selectedProducts: [{ productTitle: "X", variantId: "v1", quantity: 1 }],
      invoiceUrl: undefined,
    });
    vi.mocked(triggerDraftOrderAndSaveResult).mockResolvedValue({
      ok: true,
      message: "I've sent the checkout link to your email.",
      invoiceUrl: "https://checkout.example.com/inv/abc",
    });

    const res = await post({ call_control_id: mockCallControlId, customerConfirmed: true });
    expect(res.status).toBe(200);
    const data = await jsonResponse<{ invoiceUrl: string }>(res);
    expect(data.invoiceUrl).toBe("https://checkout.example.com/inv/abc");
    expect(triggerDraftOrderAndSaveResult).toHaveBeenCalledWith(
      "r1",
      expect.any(Object),
      "https://example.com",
      expect.objectContaining({ checkoutConfirmed: true, checkoutConfirmedAt: expect.any(String) })
    );
  });

  it("accepts customer_confirmed and confirmed as aliases for customerConfirmed", async () => {
    vi.mocked(getRecipientAndCampaignByCallControlId).mockResolvedValue({
      recipientId: "r1",
      campaignId: "c1",
      tenantId: "t1",
      result: { purchase: { selectedProducts: [{ variantId: "v1", quantity: 1 }] } },
      campaignSettings: { enableProductPurchaseFlow: true, webhookUrl: "https://example.com" },
    });
    vi.mocked(getCampaignAutomationSettings).mockReturnValue({
      enableProductPurchaseFlow: true,
      webhookUrl: "https://example.com",
    });
    vi.mocked(getPurchaseState).mockReturnValue({
      selectedProducts: [{ productTitle: "X", variantId: "v1", quantity: 1 }],
      invoiceUrl: undefined,
    });
    vi.mocked(triggerDraftOrderAndSaveResult).mockResolvedValue({
      ok: true,
      message: "Done.",
      invoiceUrl: "https://checkout.example.com/inv",
    });

    const res = await post({ call_control_id: mockCallControlId, customer_confirmed: true });
    expect(res.status).toBe(200);
    expect(triggerDraftOrderAndSaveResult).toHaveBeenCalled();
  });
});
