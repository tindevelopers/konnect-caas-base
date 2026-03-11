import { describe, expect, it, vi } from "vitest";

vi.mock("@/core/database/admin-client", () => ({
  createAdminClient: vi.fn(),
}));

import {
  buildDraftOrderPayload,
  getPurchaseState,
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
