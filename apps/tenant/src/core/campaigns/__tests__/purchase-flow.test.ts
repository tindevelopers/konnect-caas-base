import { describe, expect, it, vi, beforeEach } from "vitest";

const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });
const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

vi.mock("@/core/database/admin-client", () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

import {
  buildDraftOrderPayload,
  getPurchaseState,
  addSelectedProduct,
  triggerDraftOrderAndSaveResult,
  postDraftOrderToWebhook,
  type SelectedProduct,
} from "../purchase-flow";
import { getCampaignAutomationSettings } from "../automation-settings";

describe("purchase-flow", () => {
  describe("buildDraftOrderPayload", () => {
    it("maps selectedProducts to lineItems with variantId and quantity", () => {
      const selected: SelectedProduct[] = [
        {
          productTitle: "Andis Clipper 1",
          productUrl: "https://example.com/andis-1",
          variantId: "gid://shopify/ProductVariant/123",
          quantity: 1,
        },
        {
          productTitle: "Andis Clipper 2",
          variantId: "gid://shopify/ProductVariant/456",
          quantity: 2,
        },
      ];
      const result = buildDraftOrderPayload(selected);
      expect(result).toEqual({
        lineItems: [
          { variantId: "gid://shopify/ProductVariant/123", quantity: 1 },
          { variantId: "gid://shopify/ProductVariant/456", quantity: 2 },
        ],
      });
    });

    it("enforces minimum quantity of 1", () => {
      const selected: SelectedProduct[] = [
        { productTitle: "X", variantId: "gid://shopify/ProductVariant/1", quantity: 0 },
      ];
      const result = buildDraftOrderPayload(selected);
      expect(result.lineItems[0].quantity).toBe(1);
    });

    it("floors fractional quantities", () => {
      const selected: SelectedProduct[] = [
        { productTitle: "X", variantId: "gid://shopify/ProductVariant/1", quantity: 2.7 },
      ];
      const result = buildDraftOrderPayload(selected);
      expect(result.lineItems[0].quantity).toBe(2);
    });
  });

  describe("getPurchaseState", () => {
    it("returns empty state for null/undefined result", () => {
      expect(getPurchaseState(null)).toEqual({ selectedProducts: [] });
      expect(getPurchaseState(undefined)).toEqual({ selectedProducts: [] });
    });

    it("returns empty state when purchase is not an object", () => {
      expect(getPurchaseState({ purchase: [] })).toEqual({ selectedProducts: [] });
      expect(getPurchaseState({ purchase: "x" })).toEqual({ selectedProducts: [] });
    });

    it("parses selectedProducts with valid variantId and quantity", () => {
      const result = {
        purchase: {
          selectedProducts: [
            {
              productTitle: "Andis Clipper",
              productUrl: "https://example.com/andis",
              variantId: "gid://shopify/ProductVariant/123",
              quantity: 1,
            },
          ],
        },
      };
      const state = getPurchaseState(result);
      expect(state.selectedProducts).toHaveLength(1);
      expect(state.selectedProducts![0]).toMatchObject({
        productTitle: "Andis Clipper",
        productUrl: "https://example.com/andis",
        variantId: "gid://shopify/ProductVariant/123",
        quantity: 1,
      });
    });

    it("parses lineItemsSent, checkoutConfirmed, checkoutConfirmedAt, invoiceUrl", () => {
      const result = {
        purchase: {
          selectedProducts: [
            { productTitle: "X", variantId: "gid://shopify/ProductVariant/1", quantity: 1 },
          ],
          lineItemsSent: [{ variantId: "gid://shopify/ProductVariant/1", quantity: 1 }],
          checkoutConfirmed: true,
          checkoutConfirmedAt: "2025-03-11T12:00:00.000Z",
          invoiceUrl: "https://checkout.example.com/inv/abc",
        },
      };
      const state = getPurchaseState(result);
      expect(state.lineItemsSent).toEqual([{ variantId: "gid://shopify/ProductVariant/1", quantity: 1 }]);
      expect(state.checkoutConfirmed).toBe(true);
      expect(state.checkoutConfirmedAt).toBe("2025-03-11T12:00:00.000Z");
      expect(state.invoiceUrl).toBe("https://checkout.example.com/inv/abc");
    });

    it("filters out invalid selectedProducts (missing variantId or quantity)", () => {
      const result = {
        purchase: {
          selectedProducts: [
            { productTitle: "Valid", variantId: "gid://shopify/ProductVariant/1", quantity: 1 },
            { productTitle: "No variantId", quantity: 1 },
            { productTitle: "No quantity", variantId: "gid://shopify/ProductVariant/2" },
          ],
        },
      };
      const state = getPurchaseState(result);
      expect(state.selectedProducts).toHaveLength(1);
      expect(state.selectedProducts![0].variantId).toBe("gid://shopify/ProductVariant/1");
    });
  });

  describe("addSelectedProduct", () => {
    beforeEach(() => {
      mockUpdate.mockClear();
      mockEq.mockClear();
    });

    it("appends product to existing selectedProducts and persists merged result", async () => {
      const currentResult = {
        purchase: {
          selectedProducts: [
            { productTitle: "First", variantId: "gid://shopify/ProductVariant/1", quantity: 1 },
          ],
        },
      };
      const newProduct: SelectedProduct = {
        productTitle: "Second",
        variantId: "gid://shopify/ProductVariant/2",
        quantity: 2,
      };
      const nextState = await addSelectedProduct("recipient-1", currentResult, newProduct);
      expect(nextState.selectedProducts).toHaveLength(2);
      expect(nextState.selectedProducts![0].variantId).toBe("gid://shopify/ProductVariant/1");
      expect(nextState.selectedProducts![1].variantId).toBe("gid://shopify/ProductVariant/2");
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      const updatePayload = mockUpdate.mock.calls[0][0];
      expect(updatePayload.result).toBeDefined();
      expect(updatePayload.result.purchase.selectedProducts).toHaveLength(2);
      expect(updatePayload.result.purchase.selectedProducts[1]).toMatchObject({
        variantId: "gid://shopify/ProductVariant/2",
        quantity: 2,
      });
    });

    it("stores structure compatible with getPurchaseState and create-draft-order", async () => {
      const currentResult: Record<string, unknown> = {};
      const product: SelectedProduct = {
        productTitle: "Andis Clipper",
        variantId: "gid://shopify/ProductVariant/123",
        quantity: 1,
      };
      await addSelectedProduct("r1", currentResult, product);
      const updatePayload = mockUpdate.mock.calls[0][0];
      const stored = updatePayload.result as Record<string, unknown>;
      const purchase = stored.purchase as Record<string, unknown>;
      expect(Array.isArray(purchase.selectedProducts)).toBe(true);
      expect(purchase.selectedProducts).toHaveLength(1);
      expect((purchase.selectedProducts as Record<string, unknown>[])[0]).toMatchObject({
        variantId: "gid://shopify/ProductVariant/123",
        quantity: 1,
      });
      const roundTrip = getPurchaseState(stored);
      expect(roundTrip.selectedProducts).toHaveLength(1);
      expect(roundTrip.selectedProducts![0].variantId).toBe("gid://shopify/ProductVariant/123");
    });
  });

  describe("postDraftOrderToWebhook", () => {
    it("returns success with invoiceUrl when webhook returns JSON with invoiceUrl", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ invoiceUrl: "https://checkout.example.com/inv" })),
      });
      vi.stubGlobal("fetch", fetchMock);
      const result = await postDraftOrderToWebhook("https://webhook.example.com", {
        lineItems: [{ variantId: "gid://shopify/ProductVariant/1", quantity: 1 }],
      });
      expect(result).toEqual({ success: true, invoiceUrl: "https://checkout.example.com/inv" });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://webhook.example.com",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lineItems: [{ variantId: "gid://shopify/ProductVariant/1", quantity: 1 }],
            items: [{ variantId: "gid://shopify/ProductVariant/1", quantity: 1 }],
            line_items: [{ variantId: "gid://shopify/ProductVariant/1", quantity: 1 }],
          }),
        })
      );
      vi.unstubAllGlobals();
    });

    it("accepts invoice_url (snake_case) in webhook response", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ invoice_url: "https://checkout.example.com/snake" })),
      });
      vi.stubGlobal("fetch", fetchMock);
      const result = await postDraftOrderToWebhook("https://w.example.com", { lineItems: [] });
      expect(result).toEqual({ success: true, invoiceUrl: "https://checkout.example.com/snake" });
      vi.unstubAllGlobals();
    });

    it("returns failure when webhook response has no invoiceUrl", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({})),
      });
      vi.stubGlobal("fetch", fetchMock);
      const result = await postDraftOrderToWebhook("https://w.example.com", {
        lineItems: [{ variantId: "gid://shopify/ProductVariant/1", quantity: 1 }],
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("invoiceUrl");
      vi.unstubAllGlobals();
    });
  });

  describe("triggerDraftOrderAndSaveResult", () => {
    beforeEach(() => {
      mockUpdate.mockClear();
      mockEq.mockClear();
    });

    it("POSTs lineItems to webhook and persists invoiceUrl, lineItemsSent, checkoutConfirmed", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ invoiceUrl: "https://checkout.example.com/inv/xyz" })),
      });
      vi.stubGlobal("fetch", fetchMock);
      const currentResult = {
        purchase: {
          selectedProducts: [
            { productTitle: "X", variantId: "gid://shopify/ProductVariant/1", quantity: 1 },
          ],
        },
      };
      const out = await triggerDraftOrderAndSaveResult(
        "recipient-1",
        currentResult,
        "https://railway.example.com/draft",
        { checkoutConfirmed: true, checkoutConfirmedAt: "2025-03-11T12:00:00.000Z" }
      );
      expect(out.ok).toBe(true);
      if (out.ok) {
        expect(out.invoiceUrl).toBe("https://checkout.example.com/inv/xyz");
      }
      expect(fetchMock).toHaveBeenCalledWith(
        "https://railway.example.com/draft",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            lineItems: [{ variantId: "gid://shopify/ProductVariant/1", quantity: 1 }],
            items: [{ variantId: "gid://shopify/ProductVariant/1", quantity: 1 }],
            line_items: [{ variantId: "gid://shopify/ProductVariant/1", quantity: 1 }],
          }),
        })
      );
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      const updatePayload = mockUpdate.mock.calls[0][0];
      expect(updatePayload.result.purchase.invoiceUrl).toBe("https://checkout.example.com/inv/xyz");
      expect(updatePayload.result.purchase.lineItemsSent).toEqual([
        { variantId: "gid://shopify/ProductVariant/1", quantity: 1 },
      ]);
      expect(updatePayload.result.purchase.checkoutConfirmed).toBe(true);
      expect(updatePayload.result.purchase.checkoutConfirmedAt).toBe("2025-03-11T12:00:00.000Z");
      vi.unstubAllGlobals();
    });

    it("returns ok: false when webhook fails", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("Server Error"),
      });
      vi.stubGlobal("fetch", fetchMock);
      const currentResult = {
        purchase: {
          selectedProducts: [{ productTitle: "X", variantId: "gid://shopify/ProductVariant/1", quantity: 1 }],
        },
      };
      const out = await triggerDraftOrderAndSaveResult("r1", currentResult, "https://w.example.com");
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.message).toContain("couldn't create");
      expect(mockUpdate).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it("returns ok: false when selectedProducts is empty", async () => {
      const out = await triggerDraftOrderAndSaveResult(
        "r1",
        { purchase: { selectedProducts: [] } },
        "https://w.example.com"
      );
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.message).toContain("No products");
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });
});

describe("automation-settings", () => {
  describe("getCampaignAutomationSettings", () => {
    it("returns enableProductPurchaseFlow false and empty webhookUrl for undefined", () => {
      const settings = getCampaignAutomationSettings(undefined);
      expect(settings.enableProductPurchaseFlow).toBe(false);
      expect(settings.webhookUrl).toBe("");
    });

    it("returns enableProductPurchaseFlow true only when explicitly true", () => {
      expect(getCampaignAutomationSettings({ enableProductPurchaseFlow: true }).enableProductPurchaseFlow).toBe(true);
      expect(getCampaignAutomationSettings({ enableProductPurchaseFlow: false }).enableProductPurchaseFlow).toBe(false);
      expect(getCampaignAutomationSettings({ enableProductPurchaseFlow: "true" }).enableProductPurchaseFlow).toBe(false);
    });

    it("reads webhookUrl and falls back to railwayWebhookUrl", () => {
      expect(getCampaignAutomationSettings({ webhookUrl: "https://example.com" }).webhookUrl).toBe("https://example.com");
      expect(getCampaignAutomationSettings({ railwayWebhookUrl: "https://railway.example.com" }).webhookUrl).toBe(
        "https://railway.example.com"
      );
      expect(
        getCampaignAutomationSettings({ webhookUrl: "https://a.com", railwayWebhookUrl: "https://b.com" }).webhookUrl
      ).toBe("https://a.com");
    });
  });
});
