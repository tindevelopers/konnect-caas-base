# Campaign Purchase Flow — Full End-to-End Validation Report

**Date:** 2025-03-11  
**Scope:** Phase 1 (product selection) and Phase 2 (confirmation + draft order creation) smoke test and validation.

---

## 1. Executive Summary

| Area | Status | Notes |
|------|--------|--------|
| Phase 1 — Product selection | ✅ Validated | add-to-selection route resolves call_control_id, persists selectedProducts, supports multiple products |
| Phase 2 — Confirmation + draft order | ✅ Validated | create-draft-order enforces customerConfirmed, gates, duplicate guard |
| Webhook trigger | ✅ Validated | triggerDraftOrderAndSaveResult POSTs correct payload, parses invoiceUrl / invoice_url |
| State persistence | ✅ Validated | invoiceUrl, lineItemsSent, checkoutConfirmed, checkoutConfirmedAt persisted |
| Duplicate prevention | ✅ Validated | Second call returns existing invoiceUrl without re-calling webhook |
| Automated smoke tests | ✅ Added | TEST 1–5 in `apps/tenant/app/api/webhooks/telnyx/campaign-purchase/__tests__/smoke.test.ts` |

---

## 2. Step-by-Step Execution Trace

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1 — Product discovery & selection                                                  │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Luna helps customer discover products (existing assistant behavior).                  │
│ 2. Customer selects product → Luna invokes add_to_selection tool.                         │
│ 3. POST /api/webhooks/telnyx/campaign-purchase/add-to-selection                         │
│    • call_control_id from header (x-telnyx-call-control-id) or body (call_control_id,   │
│      callControlId, conversation_id, conversationId)                                    │
│    • parseProduct(body) → { variantId, quantity, productTitle?, ... }                    │
│    • getRecipientAndCampaignByCallControlId(callControlId) → recipient + campaign        │
│    • getCampaignAutomationSettings(campaignSettings) → enableProductPurchaseFlow check  │
│    • addSelectedProduct(recipientId, result, product)                                    │
│      → getPurchaseState(result) → list = selectedProducts ?? []                           │
│      → nextList = [...list, product]  (append, no overwrite)                             │
│      → DB: campaign_recipients.result = { ...result, purchase: { ...state, selectedProducts: nextList } }
│ 4. Response: 200, { content, selectedCount }. No webhook called.                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2 — Final confirmation + draft order                                               │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ 5. Luna summarizes selection, asks: "Would you like me to send the checkout link by email?" │
│ 6. Customer confirms → Luna invokes create_draft_order with customerConfirmed: true.    │
│ 7. POST /api/webhooks/telnyx/campaign-purchase/create-draft-order                       │
│    • call_control_id (same resolution as Phase 1)                                        │
│    • getRecipientAndCampaignByCallControlId → ctx                                         │
│    • Gates: enableProductPurchaseFlow && webhookUrl → 403 if missing                     │
│    • Duplicate guard: if state.invoiceUrl && !forceCreate → 200, existing invoiceUrl    │
│    • Confirmation gate: customerConfirmed === true (strict) → else 200, needs_final_confirmation │
│    • selectedProducts.length > 0 → else 400 no_products                                  │
│    • triggerDraftOrderAndSaveResult(recipientId, result, webhookUrl, options)            │
│ 8. triggerDraftOrderAndSaveResult:                                                       │
│    • getPurchaseState(currentResult) → selectedProducts                                   │
│    • buildDraftOrderPayload(selectedProducts) → { lineItems: [{ variantId, quantity }] }│
│    • postDraftOrderToWebhook(webhookUrl, payload) → fetch(POST, JSON body)              │
│    • Parse response: invoiceUrl or invoice_url → success + invoiceUrl                   │
│    • Persist: result.purchase = { ...state, lineItemsSent, checkoutConfirmed,           │
│               checkoutConfirmedAt, invoiceUrl }                                           │
│ 9. Response: 200, { content, invoiceUrl }. Railway creates draft order; invoiceUrl     │
│    stored in campaign_recipients.result.purchase.invoiceUrl.                            │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Phase 1 Validation (Product Selection)

| Check | Result | Evidence |
|-------|--------|----------|
| add-to-selection receives call_control_id | ✅ | Header `x-telnyx-call-control-id` or body `call_control_id` / `callControlId` / `conversation_id` / `conversationId`; 400 if missing |
| Resolves campaign_recipient | ✅ | `getRecipientAndCampaignByCallControlId(callControlId)`; 404 if not found |
| Updates purchase.selectedProducts | ✅ | `addSelectedProduct` merges `nextList = [...list, product]` and writes `result.purchase.selectedProducts` |
| selectedProducts persists in DB | ✅ | `admin.from("campaign_recipients").update({ result: { ...currentResult, purchase: nextPurchase } }).eq("id", recipientId)` |
| Multiple products without overwrite | ✅ | Append-only: `nextList = [...list, product]`; second request loads updated result from DB |
| Stored structure matches create-draft-order expectation | ✅ | `getPurchaseState()` reads `result.purchase.selectedProducts`; valid entries require `variantId` (string) and `quantity` (number) |
| quantity default | ✅ | `parseProduct`: quantity defaults to 1 if invalid; `addSelectedProduct` uses existing list item quantity |
| Missing variantId rejected | ✅ | `parseProduct` returns null → 400 invalid_product |
| enableProductPurchaseFlow gate | ✅ | add-to-selection returns 403 purchase_flow_disabled if false |

**Potential breakpoints checked:** variantId required, quantity validated (1–100), JSON merge preserves other result keys, DB update uses admin client (RLS bypass for server).

---

## 4. Phase 2 Validation (Confirmation + Draft Order)

| Check | Result | Evidence |
|-------|--------|----------|
| create-draft-order reachable and executed | ✅ | Route POST handler; tests call route and assert status + body |
| customerConfirmed gate | ✅ | `parseStrictBoolean(confirmedRaw)` — only `true` or `"true"`; else 200 + error `needs_final_confirmation` |
| Missing customerConfirmed → webhook NOT triggered | ✅ | Early return with `needs_final_confirmation`; `triggerDraftOrderAndSaveResult` not called |
| customerConfirmed === true → route proceeds | ✅ | After duplicate guard, calls `triggerDraftOrderAndSaveResult` |
| enableProductPurchaseFlow enforced | ✅ | 403 purchase_flow_disabled if false |
| webhookUrl enforced | ✅ | 403 if empty/missing |
| selectedProducts.length enforced | ✅ | 400 no_products if empty; triggerDraftOrderAndSaveResult also returns ok: false if list empty |

---

## 5. Webhook Trigger Validation

| Check | Result | Evidence |
|-------|--------|----------|
| Payload sent | ✅ | `{ lineItems: [ { variantId, quantity } ] }`; optional `customerEmail` in body |
| webhookUrl from campaign settings | ✅ | `automation.webhookUrl` from `getCampaignAutomationSettings(ctx.campaignSettings)` |
| HTTP request | ✅ | `fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })` |
| Response parsing | ✅ | JSON parsed; `invoiceUrl` or `invoice_url` extracted; non-JSON or missing invoiceUrl → success: false |

---

## 6. Draft Order Creation (Railway)

- **Owned by Railway/custom function:** This codebase does not implement the Railway endpoint. The app only POSTs to `campaign.settings.webhookUrl`.
- **Contract:** Railway must return JSON with `invoiceUrl` or `invoice_url` on success; app persists it and returns it in the API response.
- **Validation:** Use the mock webhook in `verify-purchase-flow.ts` (MOCK_WEBHOOK_PORT) or point webhookUrl to a stub to confirm the app sends the correct payload and persists the returned URL.

---

## 7. State Persistence Validation

| Field | Persisted | Location |
|-------|-----------|----------|
| campaign_recipients.result.purchase.invoiceUrl | ✅ | triggerDraftOrderAndSaveResult → nextPurchase.invoiceUrl → update result |
| checkoutConfirmed | ✅ | options.checkoutConfirmed ?? state.checkoutConfirmed |
| checkoutConfirmedAt | ✅ | options.checkoutConfirmedAt ?? state.checkoutConfirmedAt |
| lineItemsSent | ✅ | payload.lineItems (same as sent to webhook) |

---

## 8. Duplicate Order Protection

| Scenario | Result |
|---------|--------|
| create-draft-order called again, invoiceUrl already set, force not set | 200, body includes existing invoiceUrl, error: invoice_already_exists; triggerDraftOrderAndSaveResult not called |
| force: true (or forceCreate: true) with existing invoiceUrl | Duplicate guard bypassed; triggerDraftOrderAndSaveResult called (new draft order attempt) |

---

## 9. Call Flow / Assistant Integration

- **Premature hangup:** Not controlled by this app; Telnyx/Luna behavior.
- **Tool invocation failure:** Routes return 4xx/5xx with `content` and `error`; Luna can use these for retries or messaging.
- **Malformed tool response:** Routes return JSON with `content` (and optionally `error`, `invoiceUrl`, `selectedCount`). Contract documented in CAMPAIGN_PURCHASE_FLOW.md.
- **Assistant not invoking create-draft-order:** Prompt/instructions must tell Luna to call create_draft_order only after explicit customer confirmation; backend cannot force the assistant to call the tool.

---

## 10. Race Conditions and Failure Points

| Risk | Mitigation |
|------|-------------|
| Two concurrent create-draft-order requests for same recipient | Both could pass duplicate guard if first request has not yet persisted invoiceUrl. Consider idempotency key or DB lock if needed. |
| selectedProducts cleared between add-to-selection and create-draft-order | Unlikely if only these routes mutate result.purchase; other code paths that overwrite result could cause this. |
| Webhook timeout or 5xx | triggerDraftOrderAndSaveResult returns ok: false; route returns 200 with content message and error: draft_order_failed; no invoiceUrl persisted. |
| Railway returns 200 but invalid JSON or missing invoiceUrl | postDraftOrderToWebhook returns success: false; same as above. |

---

## 11. Automated Smoke Tests

All five requested scenarios are covered by unit/smoke tests:

| Test | File | Description |
|------|------|-------------|
| **TEST 1 — Phase 1 only** | smoke.test.ts | add-to-selection with variantId/quantity; assert 200, selectedCount, addSelectedProduct called; triggerDraftOrderAndSaveResult not called |
| **TEST 2 — Confirmation missing** | smoke.test.ts + create-draft-order.test.ts | create-draft-order without customerConfirmed → 200, error needs_final_confirmation; webhook not triggered |
| **TEST 3 — Happy path** | smoke.test.ts + create-draft-order.test.ts | create-draft-order with customerConfirmed: true → triggerDraftOrderAndSaveResult called, invoiceUrl in response |
| **TEST 4 — Duplicate prevention** | smoke.test.ts + create-draft-order.test.ts | Second create-draft-order with existing invoiceUrl → 200, invoice_already_exists, existing invoiceUrl; triggerDraftOrderAndSaveResult not called |
| **TEST 5 — Missing gates** | smoke.test.ts + add-to-selection.test.ts + create-draft-order.test.ts | enableProductPurchaseFlow false → add-to-selection and create-draft-order return 403; webhookUrl empty → create-draft-order 403 |

**Run all campaign-purchase tests (including smoke):**

```bash
# From repo root
pnpm exec vitest run apps/tenant/app/api/webhooks/telnyx/campaign-purchase/__tests__/
pnpm exec vitest run apps/tenant/src/core/campaigns/__tests__/purchase-flow.test.ts
```

**Run manual e2e with real DB + optional mock webhook:**

```bash
CALL_CONTROL_ID=<call_control_id> BASE_URL=http://localhost:3020 pnpm exec tsx apps/tenant/scripts/verify-purchase-flow.ts
# With mock webhook:
CALL_CONTROL_ID=<id> BASE_URL=http://localhost:3020 MOCK_WEBHOOK_PORT=9999 pnpm exec tsx apps/tenant/scripts/verify-purchase-flow.ts
```

---

## 12. Files Reference

| Purpose | Path |
|---------|------|
| Phase 1 route | apps/tenant/app/api/webhooks/telnyx/campaign-purchase/add-to-selection/route.ts |
| Phase 2 route | apps/tenant/app/api/webhooks/telnyx/campaign-purchase/create-draft-order/route.ts |
| Core flow & webhook | apps/tenant/src/core/campaigns/purchase-flow.ts |
| Automation settings | apps/tenant/src/core/campaigns/automation-settings.ts |
| Phase 1 unit tests | apps/tenant/app/api/webhooks/telnyx/campaign-purchase/__tests__/add-to-selection.test.ts |
| Phase 2 unit tests | apps/tenant/app/api/webhooks/telnyx/campaign-purchase/__tests__/create-draft-order.test.ts |
| Smoke tests (TEST 1–5) | apps/tenant/app/api/webhooks/telnyx/campaign-purchase/__tests__/smoke.test.ts |
| Core unit tests | apps/tenant/src/core/campaigns/__tests__/purchase-flow.test.ts |
| Manual verification script | apps/tenant/scripts/verify-purchase-flow.ts |
| Flow documentation | apps/tenant/docs/CAMPAIGN_PURCHASE_FLOW.md |

---

## 13. Conclusion

The campaign purchase workflow is **correctly implemented end-to-end** for the parts owned by this repo:

1. **Customer selects products** → add-to-selection stores them in `campaign_recipients.result.purchase.selectedProducts` (Phase 1).
2. **Customer confirms checkout email** → create-draft-order requires `customerConfirmed: true` (Phase 2 gate).
3. **Draft order created** → triggerDraftOrderAndSaveResult POSTs `{ lineItems }` to `campaign.settings.webhookUrl` (Railway).
4. **invoiceUrl generated** → Parsed from webhook response (`invoiceUrl` or `invoice_url`) and returned to caller.
5. **State persisted** → invoiceUrl, lineItemsSent, checkoutConfirmed, checkoutConfirmedAt written to `campaign_recipients.result.purchase`.

No missing steps or logic bugs were found in the inspected code. Remaining risks are: assistant prompt not invoking tools as intended, Railway endpoint availability/format, and a narrow race if two create-draft-order requests are sent concurrently for the same recipient before the first response is persisted.
