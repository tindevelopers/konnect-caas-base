# Groom'D Campaign — End-to-End Debug Audit: Why Checkout Email Was Not Sent

Production-debug style report for the most recent outbound call flow, focused on Phase 2 (draft order + checkout email).

---

## A. Exact End-to-End Call Chain (File Names and Function Names)

| Phase | File | Route / Function | Trigger |
|-------|------|------------------|--------|
| **0** | — | — | Campaign `status=running`, `enableProductPurchaseFlow: true`, `webhookUrl` set in `campaigns.settings` |
| **1** | `apps/tenant/app/actions/campaigns/executor.ts` | `processCampaignVoiceBatch()` | Cron or "Process now" |
| 1.1 | same | — | Selects `campaign_recipients` with `status=scheduled`, updates `status=in_progress`, `attempts+1` |
| 1.2 | same | — | `transport.request("/calls", { connection_id, from, to })` → get `call_control_id` |
| 1.3 | same | — | Build `client_state` (base64): `{ t, a, tid, g, cg, pf, rw }`; `PUT /calls/{id}/actions/client_state_update` |
| 1.4 | same | — | `campaign_recipients` UPDATE: `call_control_id` (critical for later lookup) |
| **2** | `apps/tenant/app/api/webhooks/telnyx/call-events/route.ts` | `POST` handler | Telnyx sends `call.answered` / `call.conversation.started` |
| 2.1 | same | `updateCampaignRecipientFromCallEvent()` | Sets `campaign_recipients.status` (e.g. `in_progress`) |
| 2.2 | same | `handleOutboundCallAnsweredAssistant(payload)` | Decodes `client_state`, gets assistant, then `POST /calls/{call_control_id}/actions/ai_assistant_start` |
| **3** | (Telnyx) | AI assistant runs on call | Luna speaks, uses tools |
| **4** | `apps/tenant/app/api/webhooks/telnyx/campaign-purchase/add-to-selection/route.ts` | `POST` | Telnyx invokes `add_to_selection` tool |
| 4.1 | same | `getCallControlId()`, `parseProduct()`, `getRecipientAndCampaignByCallControlId()` | Resolve recipient by `call_control_id` |
| 4.2 | `apps/tenant/src/core/campaigns/purchase-flow.ts` | `addSelectedProduct(recipientId, currentResult, product)` | Append to `result.purchase.selectedProducts`; UPDATE `campaign_recipients` |
| **5** | (Telnyx) | Luna asks for confirmation | Customer says "Yes, send it" |
| **6** | `apps/tenant/app/api/webhooks/telnyx/campaign-purchase/create-draft-order/route.ts` | `POST` | Telnyx invokes `create_draft_order` with `customerConfirmed: true` (and optionally `customerEmail` / `email`) |
| 6.1 | same | `getCallControlId()`, `getRecipientAndCampaignByCallControlId()`, `getCampaignAutomationSettings()` | Resolve recipient, campaign, `webhookUrl` |
| 6.2 | same | Parse `customerConfirmed`, `customerEmail` (body or `ctx.recipientEmail`) | If no email → return 200 `missing_customer_email` |
| 6.3 | `apps/tenant/src/core/campaigns/purchase-flow.ts` | `triggerDraftOrderAndSaveResult(recipientId, result, webhookUrl, { customerEmail, ... })` | Build payload, POST to webhook, persist `invoiceUrl` |
| 6.4 | same | `postDraftOrderToWebhook(webhookUrl, payload, { customerEmail })` | `fetch(webhookUrl, { method: "POST", body: buildWebhookBody(...) })` |
| 6.5 | same | On success: UPDATE `campaign_recipients.result.purchase` with `invoiceUrl`, `lineItemsSent`, `checkoutConfirmed`, `checkoutConfirmedAt` | — |
| **7** | External (e.g. Railway) | Custom function at `campaign.settings.webhookUrl` | Creates draft order and **sends checkout email** (not done by this app) |

**Summary chain:**  
`executor.ts` → Telnyx `/calls` → `call-events/route.ts` → `handleOutboundCallAnsweredAssistant` → `ai_assistant_start` → Luna → **add-to-selection** (`add-to-selection/route.ts` → `purchase-flow.addSelectedProduct`) → **create-draft-order** (`create-draft-order/route.ts` → `purchase-flow.triggerDraftOrderAndSaveResult` → `purchase-flow.postDraftOrderToWebhook`) → External webhook (Railway) → email sent by **external** service.

---

## B. Where Selected Products Are Stored

- **Table:** `campaign_recipients`
- **Column:** `result` (JSONB)
- **Path:** `campaign_recipients.result.purchase.selectedProducts`

**Structure:** Array of `{ productTitle?, productUrl?, variantId, quantity, variantTitle?, sku?, price? }`.  
**Written by:** `addSelectedProduct()` in `apps/tenant/src/core/campaigns/purchase-flow.ts`, invoked from `apps/tenant/app/api/webhooks/telnyx/campaign-purchase/add-to-selection/route.ts` (line 141: `addSelectedProduct(ctx.recipientId, ctx.result, product)`).  
**Read by:** `getPurchaseState(ctx.result)` in create-draft-order route and inside `triggerDraftOrderAndSaveResult()`.

Persistence is a single UPDATE that merges `result` with `result.purchase.selectedProducts` (and other purchase fields). No other code in this codebase clears `selectedProducts` between add-to-selection and create-draft-order; if they are missing at Phase 2, either add-to-selection was never called for that call or the recipient row was overwritten elsewhere.

---

## C. Where Customer Email Is Stored and Used

- **Stored (recipient list):** `campaign_recipients.email` (TEXT). Set at import time (CSV/CRM mapping). Not updated by the voice flow when the customer says their email during the call.
- **Not stored from conversation:** The app does **not** persist email collected during the call back to `campaign_recipients.email`. The only way the create-draft-order flow gets email is:
  1. **Tool body:** `customerEmail`, `customer_email`, or `email` in the `create_draft_order` tool request body (Luna must pass what the customer said).
  2. **Fallback:** `campaign_recipients.email` from DB (`getRecipientAndCampaignByCallControlId` returns `recipientEmail: recipient.email`).

**Code:** `apps/tenant/app/api/webhooks/telnyx/campaign-purchase/create-draft-order/route.ts` lines 134–147:

```ts
const bodyEmail = body.customerEmail ?? body.customer_email ?? body.email;
const customerEmail =
  (bodyEmail?.trim() || undefined) ||
  (ctx.recipientEmail?.trim() || undefined);
```

If both are missing, the route returns **HTTP 200** with `error: "missing_customer_email"` and content: *"I can send the checkout link by email, but I don't have an email address on file. What email should I send it to?"* — so the tool “succeeds” from Telnyx’s perspective (200), but no webhook is called and no email is sent.

---

## D. Where the Webhook Is Triggered

- **Module:** `apps/tenant/src/core/campaigns/purchase-flow.ts`
- **Function:** `postDraftOrderToWebhook(webhookUrl, payload, options?)` (called from `triggerDraftOrderAndSaveResult`).
- **URL source:** `campaign.settings.webhookUrl` (or legacy `campaign.settings.railwayWebhookUrl`), read via `getCampaignAutomationSettings(ctx.campaignSettings)` in `create-draft-order/route.ts` → `automation.webhookUrl`.

**Request:**  
- Method: `POST`  
- Headers: `Content-Type: application/json`, `X-Source-App: tinadmin-telnyx-campaign`, `X-Request-Id: draft-{timestamp}-{random}`  
- Body: from `buildWebhookBody()` — includes `lineItems`, `items`, `line_items`, `variant_ids`, `quantities`, and when provided `customerEmail` / `customer_email` / `email`. If the URL path contains `/functions/shopify_send_draft_invoice`, a Retell-style envelope (`name`, `args`, `call.metadata.source`) is also added.

**Success:** Response must be JSON with `invoiceUrl` or `invoice_url` (top-level or under `draftOrder`). On success, `triggerDraftOrderAndSaveResult` updates `campaign_recipients.result.purchase` with `invoiceUrl`, `lineItemsSent`, `checkoutConfirmed`, `checkoutConfirmedAt` and returns `{ ok: true, message: "I've sent the checkout link to your email. You can complete the purchase there.", invoiceUrl }`.

**Failure handling:** Non-OK status, non-JSON body, or missing `invoiceUrl` → `postDraftOrderToWebhook` returns `{ success: false, error }` → `triggerDraftOrderAndSaveResult` returns `{ ok: false, message: "Sorry, I couldn't create..." }` → create-draft-order route returns 200 with that content and `error: "draft_order_failed"`. No `invoiceUrl` is stored.

---

## E. Whether the Real Flow Sends Email from the App or from Shopify/External

**Email is sent only by the external webhook (e.g. Railway), not by this app.**

This app only:
1. POSTs to `campaign.settings.webhookUrl` with `lineItems` and `customerEmail` (and optional Retell envelope).
2. Expects the external service to create the draft order and send the checkout/invoice email.
3. On 200 + `invoiceUrl`, persists `invoiceUrl` and tells the assistant: *"I've sent the checkout link to your email."*

So if the agent said “email sent,” this app only confirms that the **webhook** returned success and `invoiceUrl`; it does **not** confirm that the external service actually sent an email. The actual email is the responsibility of the service at `webhookUrl` (e.g. Railway custom function / Shopify integration).

---

## F. Most Likely Reason You Did Not Receive the Email

Given the code paths:

1. **Only one place produces “I've sent the checkout link to your email”:**  
   When `triggerDraftOrderAndSaveResult` returns `ok: true`, i.e. the webhook was called and returned a valid `invoiceUrl`. So if the agent literally said that phrase, the path that ran was: create-draft-order had email + products + confirmation → webhook was called → webhook returned 200 + `invoiceUrl` → we stored it and returned that message.

2. **Therefore the most likely causes are:**
   - **External webhook returned success but did not send email:** e.g. staging custom function creates draft orders in smoke tests but production endpoint doesn’t send email, or a branch that skips email in production.
   - **Email sent to wrong address:** `customerEmail` in the webhook payload differed from the address you expected (e.g. from list vs. what you said on the call; or assistant didn’t pass the spoken email in the tool call).
   - **Email delivered but not seen:** spam/junk, wrong inbox, or delay.

3. **Less likely but possible:**
   - **Agent said something that sounded like “email sent” but wasn’t:** e.g. “I can send the checkout link to your email” (from `missing_customer_email` or `needs_final_confirmation`) misheard as “I sent.” In that case the webhook would never have been called and `campaign_recipients.result.purchase.invoiceUrl` would be missing.
   - **Staging vs production URL:** Campaign in DB points to a staging webhook that doesn’t send real email, or to a different env than the one you tested.

---

## G. Precise Checklist: What to Inspect in Vercel Logs and Database

### Database (Supabase)

1. **Latest Groom'D recipient (or campaign by name):**
   - Query `campaign_recipients` joined to `campaigns` where `campaigns.name ILIKE '%Groom%'` (or the exact campaign id), order by `campaign_recipients.updated_at DESC`, limit 1.
2. **For that recipient row:**
   - `call_control_id`: non-null and matching the call you care about.
   - `email`: value used as fallback when the tool doesn’t pass `customerEmail` (might be null if list had no email).
   - `result.purchase.selectedProducts`: array length ≥ 1.
   - `result.purchase.checkoutConfirmed`: `true`.
   - `result.purchase.invoiceUrl`: if present, webhook was called and returned success; email sending is then on the external service.
3. **Campaign settings:**
   - `campaigns.settings.enableProductPurchaseFlow === true`.
   - `campaigns.settings.webhookUrl` (or `railwayWebhookUrl`): exact URL used for Phase 2 (staging vs production).

### Vercel / Server logs

Search for (in order of execution):

| What | Search / identifier |
|------|----------------------|
| Product selection saved | `[CampaignPurchase:add-to-selection] Selection received` — includes `callControlId`, `recipientId`, `campaignId`, `productTitle`, `variantId`, `quantity`. |
| Customer email + confirmation | `[CampaignPurchase:create-draft-order] Confirmation received` — only logged when we **have** customer email and are about to call the webhook; includes `hasCustomerEmail: true`, `selectedCount`, `selectedProducts` (summary). If this never appears for the call, we returned earlier (e.g. `missing_customer_email`, `no_products`, `needs_final_confirmation`). |
| Webhook triggered | `[CampaignPurchase:webhook] Sending POST` — includes `webhookUrl`, `lineItemsCount`, `hasCustomerEmail`, `requestId`. |
| Webhook response | `[CampaignPurchase:webhook] Response` — includes `status`, `bodyPreview`. |
| Webhook non-JSON or no invoiceUrl | `[CampaignPurchase:webhook] Response was not JSON` or `[CampaignPurchase:webhook] Response missing invoiceUrl`. |
| Webhook request failed | `[CampaignPurchase:webhook] Request failed` — includes `error`. |
| Draft order success | `[CampaignPurchase:create-draft-order] Success` — includes `recipientId`, `campaignId`, `invoiceUrl`. |
| Draft order failed | `[CampaignPurchase:create-draft-order] Draft order failed` — includes `message`. |

**Scripts:**

- **Trace latest purchase-flow call (any campaign):**  
  `pnpm exec tsx apps/tenant/scripts/trace-latest-purchase-call.ts`  
  Optional: `HOURS=6` (or 24) to look further back. Requires `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Inspect by call_control_id:**  
  `pnpm exec tsx apps/tenant/scripts/inspect-purchase-by-call-control-id.ts --callControlId <id>`  
  Shows `result.purchase` (selectedProducts count, checkoutConfirmed, invoiceUrl).
- **Verify campaign webhook URL:**  
  `pnpm exec tsx apps/tenant/scripts/verify-campaign-webhook-config.ts`  
  Lists campaigns with `webhookUrl` / `railwayWebhookUrl`.

**Interpretation:**

- If `[CampaignPurchase:create-draft-order] Confirmation received` never appears → gate before webhook (no email, no products, or no confirmation).
- If `[CampaignPurchase:webhook] Sending POST` appears but then `Response missing invoiceUrl` or `Request failed` → webhook URL or external service problem.
- If `[CampaignPurchase:create-draft-order] Success` and DB has `invoiceUrl` → this app did its part; investigate the **external** webhook (Railway/Shopify) for whether it actually sent the email and to which address.

---

## H. Minimal Code Fix If the Bug Is in This Repo

The only in-repo bug that could cause “agent said email sent but nothing was sent” **without** the webhook being called is if the assistant treats **HTTP 200** as “success” and says “I sent the email” even when the body says otherwise (e.g. `missing_customer_email`). The app already returns distinct content for each case; the fix would be on the **assistant/tool** side (e.g. Telnyx tool response handling or assistant instructions) so it only says “I’ve sent the checkout link to your email” when the response content or a dedicated success field indicates success, not on 200 alone.

If the goal is to make **missing_customer_email** clearly a non-success for clients:

- In `apps/tenant/app/api/webhooks/telnyx/campaign-purchase/create-draft-order/route.ts`, when returning `missing_customer_email`, you could return **HTTP 200** with a structured body that includes e.g. `success: false` and `error: "missing_customer_email"` so tool handlers can branch on `success === false` and avoid saying “email sent.” The content string already asks for the email; no change to that is required.

**Optional hardening:**

- **Log when email is missing:** Before returning `missing_customer_email`, log once with `console.warn("[CampaignPurchase:create-draft-order] missing_customer_email", { recipientId: ctx.recipientId, campaignId: ctx.campaignId })` so Vercel logs show clearly that Phase 2 was hit but blocked by missing email.
- **Persist email from tool to recipient (optional):** If the assistant sends `customerEmail` in the tool body, you could add an UPDATE to `campaign_recipients.email` when create-draft-order succeeds, so the next time or for reporting the “email we used” is stored. This does not fix “email not sent” but helps debugging and consistency.

**If the bug is in the external webhook (Railway/custom function):**

- This repo cannot fix it. You must ensure the production `webhookUrl` points to the deployment that both creates the draft order and sends the email, and that the payload it receives includes the correct `customerEmail` and `lineItems`. Check that service’s logs and email configuration (from address, provider, and recipient used when sending).

---

## Quick Reference: Key Files

| Purpose | File |
|--------|------|
| Executor (dial + set call_control_id) | `apps/tenant/app/actions/campaigns/executor.ts` |
| Call events + start assistant | `apps/tenant/app/api/webhooks/telnyx/call-events/route.ts` |
| Webhook URL from campaign | `apps/tenant/src/core/campaigns/automation-settings.ts` (`getCampaignAutomationSettings`) |
| Add product to selection | `apps/tenant/app/api/webhooks/telnyx/campaign-purchase/add-to-selection/route.ts` |
| Create draft order + trigger webhook | `apps/tenant/app/api/webhooks/telnyx/campaign-purchase/create-draft-order/route.ts` |
| Purchase state, webhook POST, persist invoiceUrl | `apps/tenant/src/core/campaigns/purchase-flow.ts` |
| Flow + breakpoints | `docs/campaign-outbound-call-flow.md` |
