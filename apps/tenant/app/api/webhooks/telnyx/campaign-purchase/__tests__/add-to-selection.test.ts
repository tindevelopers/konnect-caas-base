import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/src/core/campaigns/purchase-flow", () => ({
  getRecipientAndCampaignByCallControlId: vi.fn(),
  addSelectedProduct: vi.fn(),
  getCampaignAutomationSettings: vi.fn(),
}));

import {
  getRecipientAndCampaignByCallControlId,
  addSelectedProduct,
  getCampaignAutomationSettings,
} from "@/src/core/campaigns/purchase-flow";
import { POST } from "../add-to-selection/route";

function jsonResponse<T>(res: Response): Promise<T> {
  return res.json();
}

describe("add-to-selection route", () => {
  const mockCallControlId = "call-ctrl-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function post(body: Record<string, unknown>, header?: string) {
    const req = new Request("http://localhost/api/webhooks/telnyx/campaign-purchase/add-to-selection", {
      method: "POST",
      headers: header ? { "x-telnyx-call-control-id": header } : {},
      body: JSON.stringify(body),
    });
    return POST(req as any);
  }

  it("returns 400 when call_control_id is missing", async () => {
    const res = await post({ variantId: "gid://shopify/ProductVariant/1", quantity: 1 });
    expect(res.status).toBe(400);
    const data = await jsonResponse<{ error: string }>(res);
    expect(data.error).toBe("missing_call_control_id");
  });

  it("returns 400 when variantId is missing", async () => {
    const res = await post({ call_control_id: mockCallControlId, quantity: 1 });
    expect(res.status).toBe(400);
    const data = await jsonResponse<{ error: string }>(res);
    expect(data.error).toBe("invalid_product");
  });

  it("returns 404 when not a campaign call", async () => {
    vi.mocked(getRecipientAndCampaignByCallControlId).mockResolvedValue(null);

    const res = await post({
      call_control_id: mockCallControlId,
      variantId: "gid://shopify/ProductVariant/123",
      quantity: 1,
    });
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
      webhookUrl: "",
    });

    const res = await post({
      call_control_id: mockCallControlId,
      variantId: "gid://shopify/ProductVariant/123",
      quantity: 1,
    });
    expect(res.status).toBe(403);
    const data = await jsonResponse<{ error: string }>(res);
    expect(data.error).toBe("purchase_flow_disabled");
  });

  it("calls addSelectedProduct and returns 200 with selectedCount on success", async () => {
    vi.mocked(getRecipientAndCampaignByCallControlId).mockResolvedValue({
      recipientId: "r1",
      campaignId: "c1",
      tenantId: "t1",
      result: {},
      campaignSettings: { enableProductPurchaseFlow: true },
    });
    vi.mocked(getCampaignAutomationSettings).mockReturnValue({
      enableProductPurchaseFlow: true,
      webhookUrl: "https://example.com",
    });
    vi.mocked(addSelectedProduct).mockResolvedValue({
      selectedProducts: [
        {
          productTitle: "Andis Clipper",
          variantId: "gid://shopify/ProductVariant/123",
          quantity: 1,
        },
      ],
    });

    const res = await post({
      call_control_id: mockCallControlId,
      productTitle: "Andis Clipper",
      variantId: "gid://shopify/ProductVariant/123",
      quantity: 1,
    });
    expect(res.status).toBe(200);
    const data = await jsonResponse<{ content: string; selectedCount: number }>(res);
    expect(data.selectedCount).toBe(1);
    expect(addSelectedProduct).toHaveBeenCalledWith(
      "r1",
      expect.any(Object),
      expect.objectContaining({
        productTitle: "Andis Clipper",
        variantId: "gid://shopify/ProductVariant/123",
        quantity: 1,
      })
    );
  });

  it("uses x-telnyx-call-control-id header when body has no call_control_id", async () => {
    vi.mocked(getRecipientAndCampaignByCallControlId).mockResolvedValue({
      recipientId: "r1",
      campaignId: "c1",
      tenantId: "t1",
      result: {},
      campaignSettings: {},
    });
    vi.mocked(getCampaignAutomationSettings).mockReturnValue({
      enableProductPurchaseFlow: true,
      webhookUrl: "https://example.com",
    });
    vi.mocked(addSelectedProduct).mockResolvedValue({
      selectedProducts: [{ productTitle: "X", variantId: "gid://shopify/ProductVariant/1", quantity: 1 }],
    });

    const req = new Request("http://localhost/api/webhooks/telnyx/campaign-purchase/add-to-selection", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-telnyx-call-control-id": "header-call-123" },
      body: JSON.stringify({ variantId: "gid://shopify/ProductVariant/1", quantity: 1 }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    expect(getRecipientAndCampaignByCallControlId).toHaveBeenCalled();
    expect(addSelectedProduct).toHaveBeenCalledWith(
      "r1",
      expect.any(Object),
      expect.objectContaining({ variantId: "gid://shopify/ProductVariant/1", quantity: 1 })
    );
  });

  it("when result already has selectedProducts, addSelectedProduct is called with that result (multiple products)", async () => {
    const existingResult = {
      purchase: {
        selectedProducts: [
          { productTitle: "First", variantId: "gid://shopify/ProductVariant/1", quantity: 1 },
        ],
      },
    };
    vi.mocked(getRecipientAndCampaignByCallControlId).mockResolvedValue({
      recipientId: "r1",
      campaignId: "c1",
      tenantId: "t1",
      result: existingResult,
      campaignSettings: {},
    });
    vi.mocked(getCampaignAutomationSettings).mockReturnValue({
      enableProductPurchaseFlow: true,
      webhookUrl: "https://example.com",
    });
    vi.mocked(addSelectedProduct).mockResolvedValue({
      selectedProducts: [
        { productTitle: "First", variantId: "gid://shopify/ProductVariant/1", quantity: 1 },
        { productTitle: "Second", variantId: "gid://shopify/ProductVariant/2", quantity: 2 },
      ],
    });

    const res = await post({
      call_control_id: mockCallControlId,
      productTitle: "Second",
      variantId: "gid://shopify/ProductVariant/2",
      quantity: 2,
    });
    expect(res.status).toBe(200);
    const data = await jsonResponse<{ selectedCount: number }>(res);
    expect(data.selectedCount).toBe(2);
    expect(addSelectedProduct).toHaveBeenCalledWith(
      "r1",
      existingResult,
      expect.objectContaining({
        productTitle: "Second",
        variantId: "gid://shopify/ProductVariant/2",
        quantity: 2,
      })
    );
  });
});
