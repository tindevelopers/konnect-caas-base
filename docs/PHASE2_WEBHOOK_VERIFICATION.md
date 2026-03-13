# Phase 2 Campaign Purchase Webhook — Verification Report

This document verifies that Phase 2 of the campaign purchase flow correctly uses the new webhook endpoint and documents how to confirm each step.

**Expected webhook URL:**  
`https://shopify-mcp-retell-integration-staging.up.railway.app/draft-orders-konnect`

---

## 1. Database Verification

**Requirement:**  
- `campaign.settings.webhookUrl` = `https://shopify-mcp-retell-integration-staging.up.railway.app/draft-orders-konnect`  
- `settings.railwayWebhookUrl` should not exist (legacy key removed).

**How to verify:**

Run the read-only script (from repo root, with Supabase env in `.env.local` or environment):

```bash
pnpm exec tsx apps/tenant/scripts/verify-campaign-webhook-config.ts
```

The script prints for each campaign that has a webhook:

- `settings.webhookUrl` and `settings.railwayWebhookUrl` (if present)
- Effective URL used for Phase 2
- Whether it matches the expected URL
- A summary of how many campaigns use the expected URL and whether any still have the legacy key

**Code reference:**  
- URL is read from `campaigns.settings` in `getRecipientAndCampaignByCallControlId()` → `ctx.campaignSettings` (see `purchase-flow.ts`).  
- `getCampaignAutomationSettings()` in `automation-settings.ts` returns `webhookUrl` from `settings.webhookUrl` or, if missing, `settings.railwayWebhookUrl`.

---

## 2. Execution Path Verification

**Requirement:**  
Confirm the flow from `POST /api/webhooks/telnyx/campaign-purchase/create-draft-order` through `fetch(webhookUrl)`.

**Verified code path:**

| Step | File | Line(s) | What happens |
|------|------|--------|----------------|
| 1 | `create-draft-order/route.ts` | 80 | `getRecipientAndCampaignByCallControlId(callControlId)` → loads campaign, `ctx.campaignSettings` |
| 2 | `create-draft-order/route.ts` | 88 | `getCampaignAutomationSettings(ctx.campaignSettings)` → returns `{ enableProductPurchaseFlow, webhookUrl }` |
| 3 | `create-draft-order/route.ts` | 89 | Gate: `automation.enableProductPurchaseFlow && automation.webhookUrl?.trim()` |
| 4 | `create-draft-order/route.ts` | 176–179 | `triggerDraftOrderAndSaveResult(ctx.recipientId, ctx.result, automation.webhookUrl, { customerEmail, checkoutConfirmed, checkoutConfirmedAt })` |
| 5 | `purchase-flow.ts` | 363 | `postDraftOrderToWebhook(webhookUrl, payload, options)` — same `webhookUrl` passed in |
| 6 | `purchase-flow.ts` | 256–260 | `fetch(url, { method: "POST", headers, body: JSON.stringify(body) })` where `url = webhookUrl.trim()` |

So the `webhookUrl` used in `fetch()` is exactly `automation.webhookUrl`, which comes from `campaign.settings.webhookUrl` (or `railwayWebhookUrl`). **If the DB has the new URL, Phase 2 calls the correct endpoint.**

---

## 3. Payload Verification

**Requirement:**  
Payload must include `lineItems` (and optionally `customerEmail`). Headers must include `Content-Type: application/json`, `X-Source-App: tinadmin-telnyx-campaign`, `X-Request-Id`.

**Verified in code:**

- **Payload:** Built in `buildWebhookBody()` in `purchase-flow.ts` (lines 188–221). For the new URL, the path does **not** contain `/functions/shopify_send_draft_invoice`, so `useRetellEnvelope` is false and the body is **flat** only:
  - `lineItems`: array of `{ variantId, quantity }` (Shopify GID format)
  - `items`, `line_items`: same as `lineItems`
  - `variant_ids`, `quantities`: arrays
  - If email is provided: `customerEmail`, `customer_email`, `email`

- **Headers:** Set in `postDraftOrderToWebhook()` (lines 241–244):
  - `Content-Type: application/json`
  - `X-Source-App: tinadmin-telnyx-campaign` (constant `DRAFT_WEBHOOK_SOURCE_VALUE`)
  - `X-Request-Id: draft-{timestamp}-{random}`

So the payload matches the required shape and headers are correct.

**Example body sent to the new webhook:**

```json
{
  "lineItems": [
    { "variantId": "gid://shopify/ProductVariant/...", "quantity": 1 }
  ],
  "items": [...],
  "line_items": [...],
  "variant_ids": ["gid://shopify/ProductVariant/..."],
  "quantities": [1],
  "customerEmail": "customer@example.com",
  "customer_email": "customer@example.com",
  "email": "customer@example.com"
}
```

---

## 4. Runtime Logging

**Requirement:**  
Logs should show `[CampaignPurchase:webhook] Sending POST` with `webhookUrl` equal to the new endpoint.

**Verified in code:**  
In `postDraftOrderToWebhook()` (lines 246–254):

```ts
console.info("[CampaignPurchase:webhook] Sending POST", {
  requestId,
  webhookUrl: url,
  bodyKeys: Object.keys(body),
  useRetellEnvelope,
  lineItemsCount: payload.lineItems?.length ?? 0,
  hasCustomerEmail: Boolean(options?.customerEmail),
});
```

So at runtime, when Phase 2 runs, you will see `webhookUrl: "https://shopify-mcp-retell-integration-staging.up.railway.app/draft-orders-konnect"` in that log line if the campaign is configured with that URL.

**How to verify:**  
Run a campaign call that triggers create-draft-order and check server logs for `[CampaignPurchase:webhook] Sending POST` and the `webhookUrl` value.

---

## 5. External Service Check

**Requirement:**  
The Railway endpoint must receive the POST and return `invoiceUrl` with HTTP 200.

**What we cannot verify from code:**  
- Whether the external service actually received the request  
- Whether it returned 200 and `invoiceUrl`

**What the app does:**  
- Sends POST to the configured URL (see above).  
- Expects JSON response with `invoiceUrl` or `invoice_url` (or under `draftOrder.invoiceUrl` / `draftOrder.invoice_url`) — see `purchase-flow.ts` lines 281–293.  
- If status is not ok or `invoiceUrl` is missing, `postDraftOrderToWebhook` returns `{ success: false, error: "..." }` and the route returns a friendly error to the caller.

**How to verify:**  
- Check Railway/service logs for requests to `/draft-orders-konnect`.  
- Ensure the service returns `{ "invoiceUrl": "https://..." }` (or `invoice_url`) with status 200.

---

## 6. Database Result Verification (after webhook response)

**Requirement:**  
After a successful webhook response, the system must persist in `campaign_recipients.result.purchase`:

- `invoiceUrl`  
- `lineItemsSent`  
- `checkoutConfirmed`  
- `checkoutConfirmedAt`

**Verified in code:**  
In `triggerDraftOrderAndSaveResult()` (purchase-flow.ts lines 366–376):

```ts
const nextPurchase: CampaignPurchaseState = {
  ...state,
  checkoutConfirmed: options?.checkoutConfirmed ?? state.checkoutConfirmed,
  checkoutConfirmedAt: options?.checkoutConfirmedAt ?? state.checkoutConfirmedAt,
  lineItemsSent: payload.lineItems,
  invoiceUrl: postResult.invoiceUrl,
};
await (admin.from("campaign_recipients") as any)
  .update({
    result: { ...currentResult, [RESULT_KEY]: nextPurchase },
    updated_at: new Date().toISOString(),
  })
  .eq("id", recipientId);
```

`RESULT_KEY` is `"purchase"`, so the persisted path is `campaign_recipients.result.purchase` with:

- `invoiceUrl`  
- `lineItemsSent`  
- `checkoutConfirmed`  
- `checkoutConfirmedAt`  

So the implementation matches the requirement.

---

## 7. End-to-End Smoke Test

**Requirement:**  
Simulate: add-to-selection → create-draft-order with `customerConfirmed: true` → webhook called, draft order created, `invoiceUrl` returned and saved.

**Existing script:**  
`apps/tenant/scripts/verify-purchase-flow.ts` does this against a running tenant app.

**Steps:**

1. **Prerequisites**
   - Dev server: e.g. `pnpm dev:tenant` (or your tenant URL).
   - A campaign with `enableProductPurchaseFlow: true` and `webhookUrl` set to the new endpoint.
   - A `campaign_recipients` row with `call_control_id` set to a value you’ll use as `CALL_CONTROL_ID`.

2. **Run**
   ```bash
   CALL_CONTROL_ID=<your-call-control-id> BASE_URL=http://localhost:3020 pnpm exec tsx apps/tenant/scripts/verify-purchase-flow.ts
   ```

3. **Optional: mock webhook**  
   To avoid calling the real Railway endpoint, run a mock server and point the campaign’s webhook to it:
   ```bash
   CALL_CONTROL_ID=<id> BASE_URL=http://localhost:3020 MOCK_WEBHOOK_PORT=9999 pnpm exec tsx apps/tenant/scripts/verify-purchase-flow.ts
   ```  
   Then set the campaign’s webhook URL to `http://127.0.0.1:9999` (or the URL the script prints). The mock returns `{ invoiceUrl: "https://checkout.example.com/inv" }`.

4. **What to confirm**
   - Step 1 (add-to-selection): 200, product added.  
   - Step 2 (create-draft-order without confirm): 200, `needs_final_confirmation`.  
   - Step 3 (create-draft-order with `customerConfirmed: true`): 200, `invoiceUrl` in response.  
   - Step 4 (create-draft-order again): 200, `invoice_already_exists`, same `invoiceUrl` (no second webhook).  
   - Server logs: `[CampaignPurchase:webhook] Sending POST` with the correct `webhookUrl`.  
   - DB: `campaign_recipients.result.purchase.invoiceUrl` (and other fields) set for that recipient.

---

## Summary Checklist

| # | Check | How |
|---|--------|-----|
| 1 | New webhook URL configured in DB | Run `verify-campaign-webhook-config.ts`; confirm `webhookUrl` and no `railwayWebhookUrl`. |
| 2 | Phase 2 calls correct endpoint | Code path uses `automation.webhookUrl` → `fetch(webhookUrl)`; DB drives URL. |
| 3 | Payload format correct | Code sends flat body with `lineItems`, `customerEmail`, etc.; headers include `Content-Type`, `X-Source-App`, `X-Request-Id`. |
| 4 | `invoiceUrl` returned and persisted | Code persists `result.purchase.invoiceUrl` (and related fields) after successful webhook response. |
| 5 | Issues / missing steps | No code gaps; runtime and external checks require running the app and/or scripts above. |

**Expected end-to-end result:**  
create-draft-order → triggerDraftOrderAndSaveResult → POST to `https://shopify-mcp-retell-integration-staging.up.railway.app/draft-orders-konnect` → `invoiceUrl` returned → `invoiceUrl` (and related fields) saved to `campaign_recipients.result.purchase`.
