# Campaign Purchase Flow — Implementation Audit

**Date:** 2025-03-11  
**Scope:** End-to-end verification of the Groom'D campaign purchase-confirmation flow.

---

## 1. Implementation Audit Summary

### Overall verdict: **Fully wired and functional**

The two-stage purchase flow is correctly implemented across the stack. All gates, confirmation logic, duplicate protection, and state persistence are in place and aligned with the documented contract.

---

## 2. Flow Trace: Product Selection → Draft Order Webhook

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Luna suggests products (existing behavior)                               │
│ 2. Customer selects product → Luna calls add_to_selection tool             │
│ 3. POST /api/webhooks/telnyx/campaign-purchase/add-to-selection              │
│    → addSelectedProduct() → campaign_recipients.result.purchase.selectedProducts │
│ 4. Luna asks: "Would you like me to send you the checkout link by email?"    │
│ 5. Customer says "Yes" → Luna calls create_draft_order with customerConfirmed: true │
│ 6. POST /api/webhooks/telnyx/campaign-purchase/create-draft-order            │
│    → gates checked → triggerDraftOrderAndSaveResult()                       │
│    → buildDraftOrderPayload() → postDraftOrderToWebhook()                    │
│    → campaign_recipients.result.purchase updated with invoiceUrl, lineItemsSent │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Static Verification Results

### 3.1 add-to-selection

| Check | Status | Location |
|-------|--------|----------|
| Persists to `campaign_recipients.result.purchase.selectedProducts` | OK | `addSelectedProduct()` in purchase-flow.ts |
| Requires `call_control_id` | OK | Returns 400 if missing |
| Parses product (variantId, quantity, productTitle, etc.) | OK | `parseProduct()` in route |
| Gates on `enableProductPurchaseFlow` | OK | Returns 403 if disabled |
| Returns 404 if not campaign call | OK | `getRecipientAndCampaignByCallControlId` |
| Does NOT trigger webhook | OK | No webhook call in add-to-selection |

### 3.2 create-draft-order

| Check | Status | Location |
|-------|--------|----------|
| Reads stored selection state | OK | `getPurchaseState(ctx.result)` |
| Enforces `customerConfirmed` | OK | `parseStrictBoolean(confirmedRaw)` — only `true` or `"true"` |
| Blocks webhook when confirmation missing/false | OK | Returns 200 with `needs_final_confirmation` before any webhook |
| Returns `needs_final_confirmation` when absent | OK | Line 99 |
| Blocks if `enableProductPurchaseFlow` false | OK | Line 70–74, 403 |
| Blocks if `webhookUrl` missing | OK | Same gate, 403 |
| Blocks if `selectedProducts` empty | OK | Line 105–113, 400 `no_products` |
| Duplicate protection: returns existing `invoiceUrl` | OK | Line 83–93, before confirmation check |
| `force` / `forceCreate` bypass | OK | `parseStrictBoolean(forceRaw)` |

### 3.3 purchase-flow.ts persistence

| Field | Status | Location |
|-------|--------|----------|
| `invoiceUrl` | OK | `triggerDraftOrderAndSaveResult` line 230 |
| `checkoutConfirmed` | OK | Line 226 |
| `checkoutConfirmedAt` | OK | Line 227 |
| `lineItemsSent` | OK | Line 229 |

### 3.4 Webhook payload shape

```json
{
  "lineItems": [
    { "variantId": "gid://shopify/ProductVariant/123", "quantity": 1 },
    { "variantId": "gid://shopify/ProductVariant/456", "quantity": 1 }
  ]
}
```

- Built from `selectedProducts` via `buildDraftOrderPayload()` — OK
- `customerEmail` included if provided — OK

### 3.5 Luna prompt / tool contract alignment

- **Docs** (`CAMPAIGN_PURCHASE_FLOW.md`): Assistant instructions specify two-stage flow, `customerConfirmed: true`, and tool URLs.
- **Backend contract**: Routes expect `customerConfirmed`, `customer_confirmed`, or `confirmed`; strict boolean coercion.
- **Alignment**: Yes. Luna must be configured in Telnyx with the documented tool URLs and instructions. The backend enforces the contract regardless of prompt quality.

---

## 4. Gaps / Edge Cases

| Item | Severity | Notes |
|------|----------|-------|
| Webhook URL format | Low | `postDraftOrderToWebhook` does not prepend `https://` if missing; caller must provide full URL. Campaign UI validates URL when enabled. |
| `force` with empty selection | N/A | Duplicate guard runs first; if `invoiceUrl` exists, `force` would bypass and attempt new order — but `selectedProducts` could have been cleared. Current behavior: would still use whatever is in state; if empty, `triggerDraftOrderAndSaveResult` returns error. Acceptable. |

---

## 5. Files Touched (Implementation)

- `apps/tenant/app/api/webhooks/telnyx/campaign-purchase/add-to-selection/route.ts`
- `apps/tenant/app/api/webhooks/telnyx/campaign-purchase/create-draft-order/route.ts`
- `apps/tenant/src/core/campaigns/purchase-flow.ts`
- `apps/tenant/src/core/campaigns/automation-settings.ts`
- `apps/tenant/docs/CAMPAIGN_PURCHASE_FLOW.md`

---

## 6. How to Run Verification

### Automated tests
```bash
# From repo root - run all campaign purchase flow tests:
pnpm exec vitest run apps/tenant

# Or run specific test files:
pnpm exec vitest run apps/tenant/src/core/campaigns/__tests__/purchase-flow.test.ts
pnpm exec vitest run apps/tenant/app/api/webhooks/telnyx/campaign-purchase/__tests__/
```

### Local manual harness
```bash
# 1. Start dev server: pnpm dev:tenant (or pnpm dev:3000)
# 2. Ensure a campaign_recipients row exists with call_control_id
# 3. Run:
CALL_CONTROL_ID=<your-call-control-id> BASE_URL=http://localhost:3020 pnpm exec tsx apps/tenant/scripts/verify-purchase-flow.ts
```

Optional: with mock webhook (script starts a mock server; campaign webhook must point to it):
```bash
CALL_CONTROL_ID=<id> BASE_URL=http://localhost:3020 MOCK_WEBHOOK_PORT=9999 pnpm exec tsx apps/tenant/scripts/verify-purchase-flow.ts
```

See `apps/tenant/scripts/verify-purchase-flow.ts` for full usage.
