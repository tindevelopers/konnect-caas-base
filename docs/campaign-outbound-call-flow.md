# Campaign Outbound Call Flow — Step-by-Step with Breakpoints

This document describes the full end-to-end flow of an outbound campaign voice call, including the two-stage purchase flow. Use it to identify breakpoints when debugging.

---

## Phase 0: Prerequisites (Before Any Call)

| # | Check | Where | Breakpoint if missing |
|---|-------|-------|------------------------|
| 0.1 | Campaign has `status: running`, `campaign_type: voice` | `campaigns` table | No calls processed |
| 0.2 | Campaign has `assistant_id` (Telnyx AI assistant) | `campaigns` table | Executor skips with error |
| 0.3 | Campaign has `from_number` (Telnyx number) | `campaigns` table | Executor skips with error |
| 0.4 | Campaign has `settings.connection_id` (Call Control App ID) | `campaigns.settings` | Executor skips with error |
| 0.5 | Telnyx API key available (tenant integration or `TELNYX_API_KEY`) | Integration config / env | Executor skips with error |
| 0.6 | Call Control App `webhook_event_url` points to your app | Telnyx portal → Call Control → Applications | Webhooks never reach your app; no assistant start |
| 0.7 | AI Assistant has `add_to_selection` and `create_draft_order` webhook tools | Telnyx portal → AI Assistants → Tools | Luna cannot invoke purchase flow; may only have `hangup` |
| 0.8 | (If purchase flow) Campaign has `enableProductPurchaseFlow: true` and `webhookUrl` | `campaigns.settings` | create-draft-order returns 403 |

---

## Phase 1: Campaign Executor (Dial Out)

**File:** `apps/tenant/app/actions/campaigns/executor.ts`  
**Function:** `processCampaignVoiceBatch()`  
**Trigger:** Cron job or "Process now" button

| Step | What happens | Breakpoint |
|------|--------------|------------|
| 1.1 | Query `campaigns` where `status=running`, `campaign_type=voice` | No campaigns → no work |
| 1.2 | Check calling window (timezone, start/end, days) | Outside window → skip (unless `bypassCallingWindow`) |
| 1.3 | Resolve `connection_id` from `campaign.settings` or `TELNYX_CONNECTION_ID` | Missing → error, skip campaign |
| 1.4 | Resolve Telnyx API key (tenant integration or env) | Missing → error, skip campaign |
| 1.5 | Query `campaign_recipients` where `status=scheduled`, `scheduled_at <= now`, limit by `max_concurrent_calls` | No recipients → skip |
| 1.6 | For each recipient: update `status=in_progress`, `attempts+1` | — |
| 1.7 | **POST** Telnyx `/calls` with `connection_id`, `from`, `to` | Telnyx error → recipient marked `failed` |
| 1.8 | Extract `call_control_id` from response | Missing → throw, recipient `failed` |
| 1.9 | Build `client_state` (base64 JSON): `{ t: "tinadmin_outbound_assistant", a: assistant_id, tid: tenant_id, g: greeting?, cg?, pf?, rw? }` | — |
| 1.10 | **PUT** Telnyx `/calls/{call_control_id}/actions/client_state_update` | Optional; failure only logged |
| 1.11 | Update `campaign_recipients` with `call_control_id` | **Critical:** links call to recipient for later lookup |
| 1.12 | Insert `campaign_events` with `event_type: call.initiated` | — |

**Breakpoint 1:** If `call_control_id` is not persisted on `campaign_recipients`, the purchase tools cannot resolve the recipient later.

---

## Phase 2: Telnyx Sends Call Events to Your App

**File:** `apps/tenant/app/api/webhooks/telnyx/call-events/route.ts`  
**Route:** `POST /api/webhooks/telnyx/call-events`  
**Trigger:** Telnyx sends webhooks for call lifecycle events (answered, hangup, etc.)

| Step | What happens | Breakpoint |
|------|--------------|------------|
| 2.1 | Telnyx POSTs to your **Call Control App** `webhook_event_url` | Wrong URL → webhooks never arrive |
| 2.2 | Verify webhook signature (ED25519 or HMAC) | Invalid → 401, request rejected |
| 2.3 | Parse JSON payload, resolve `tenantId` (header, query, payload, or from `campaign_recipients` by `call_control_id`) | Missing tenant → 400 |
| 2.4 | Insert into `telephony_events` | DB error → 500 |
| 2.5 | If event is `conversation` or `assistant`-related, insert into `ai_agent_events` | — |
| 2.6 | Call `updateCampaignRecipientFromCallEvent()` — updates `campaign_recipients.status` on answered/hangup | — |
| 2.7 | Call `handleOutboundCallAnsweredAssistant(payload)` when event is `call.answered` or `call.conversation.started` | — |
| 2.8 | Return `{ status: "ok" }` | — |

**Breakpoint 2:** If the Call Control App `webhook_event_url` does not point to `https://<your-app>/api/webhooks/telnyx/call-events`, none of this runs.

---

## Phase 3: Start AI Assistant on Answer

**File:** `apps/tenant/app/api/webhooks/telnyx/call-events/route.ts`  
**Function:** `handleOutboundCallAnsweredAssistant()`

| Step | What happens | Breakpoint |
|------|--------------|------------|
| 3.1 | Require event type `call.answered` or `call.conversation.started` | Other events → early return |
| 3.2 | Require `direction` outbound (or rely on client_state marker) | Inbound → early return |
| 3.3 | Decode `client_state` (base64 JSON) | Invalid/missing → early return |
| 3.4 | Require `decoded.t === "tinadmin_outbound_assistant"` and `decoded.a`, `decoded.tid` | Wrong/missing → early return |
| 3.5 | Extract `call_control_id` from payload | Missing → early return |
| 3.6 | Get Telnyx transport for `decoded.tid` (tenant) | No API key → throw |
| 3.7 | **GET** Telnyx `/ai/assistants/{decoded.a}` to fetch `instructions` | Fail → use assistant without instructions override |
| 3.8 | Build `startBody`: `{ assistant: { id, instructions? }, greeting? }` | — |
| 3.9 | **POST** Telnyx `/calls/{call_control_id}/actions/ai_assistant_start` | Fail → assistant never starts; call may just ring/hang |
| 3.10 | (On 401 with tenant creds) Retry with `TELNYX_API_KEY` | — |

**Breakpoint 3:** If `ai_assistant_start` fails, the call has no AI assistant. Luna never speaks; the call may hang or end.

---

## Phase 4: Luna Runs — Product Selection (Stage 1)

**Luna (Telnyx AI Assistant)** runs on the call. She uses her **instructions** and **tools** from Telnyx.

| Step | What happens | Breakpoint |
|------|--------------|------------|
| 4.1 | Luna speaks greeting (from `ai_assistant_start` or assistant config) | — |
| 4.2 | Customer discusses/selects products | — |
| 4.3 | Luna decides to call `add_to_selection` tool | **Tool must exist** on assistant; otherwise Luna cannot call it |
| 4.4 | Telnyx **POSTs** to tool URL: `https://<your-app>/api/webhooks/telnyx/campaign-purchase/add-to-selection` | Tool URL must be reachable; Telnyx sends `x-telnyx-call-control-id` or `call_control_id` in body |

**Breakpoint 4:** If the assistant has no `add_to_selection` tool, Luna cannot persist product selections.

---

## Phase 5: add-to-selection Route

**File:** `apps/tenant/app/api/webhooks/telnyx/campaign-purchase/add-to-selection/route.ts`

| Step | What happens | Breakpoint |
|------|--------------|------------|
| 5.1 | Parse JSON body | Invalid → 400 |
| 5.2 | Get `call_control_id` from header `x-telnyx-call-control-id` or body | Missing → 400 |
| 5.3 | Parse product: `variantId`, `quantity` required | Invalid → 400 |
| 5.4 | `getRecipientAndCampaignByCallControlId(call_control_id)` | No row → 404 (call not linked to campaign) |
| 5.5 | Check `enableProductPurchaseFlow` | False → 403 |
| 5.6 | `addSelectedProduct(recipientId, result, product)` → updates `campaign_recipients.result.purchase.selectedProducts` | DB error → 500 |
| 5.7 | Return 200 with message for Luna | — |

**Breakpoint 5:** If `campaign_recipients` has no row with `call_control_id = <id>`, `getRecipientAndCampaignByCallControlId` returns null → 404. This requires Phase 1.11 to have run (executor stored `call_control_id`).

---

## Phase 6: Luna Asks for Confirmation (Stage 2)

| Step | What happens | Breakpoint |
|------|--------------|------------|
| 6.1 | Luna asks: "Would you like me to send you the checkout link by email?" | Instructions must tell her to ask this |
| 6.2 | Customer says "Yes" / "Send it" | — |
| 6.3 | Luna decides to call `create_draft_order` with `customerConfirmed: true` | **Tool must exist**; instructions must say to call only after explicit confirmation |

**Breakpoint 6:** If the assistant has no `create_draft_order` tool, Luna cannot trigger the webhook. She may fall back to `hangup` or other behavior.

---

## Phase 7: create-draft-order Route

**File:** `apps/tenant/app/api/webhooks/telnyx/campaign-purchase/create-draft-order/route.ts`

| Step | What happens | Breakpoint |
|------|--------------|------------|
| 7.1 | Parse JSON body, get `call_control_id` | Missing → 400 |
| 7.2 | `getRecipientAndCampaignByCallControlId(call_control_id)` | No row → 404 |
| 7.3 | `getCampaignAutomationSettings(settings)` → require `enableProductPurchaseFlow` and `webhookUrl` | Missing → 403 |
| 7.4 | `getPurchaseState(ctx.result)` → check `invoiceUrl` | Already exists and no `force` → 200 with existing link, no webhook |
| 7.5 | Parse `customerConfirmed` (strict: `true` or `"true"`) | Not true → 200 with "needs_final_confirmation", no webhook |
| 7.6 | Require `selectedProducts.length > 0` | Empty → 400 "no_products" |
| 7.7 | `triggerDraftOrderAndSaveResult(recipientId, result, webhookUrl, options)` | — |

**Breakpoint 7:** Any gate (404, 403, no confirmation, no products) stops the webhook from firing.

---

## Phase 8: triggerDraftOrderAndSaveResult (purchase-flow.ts)

**File:** `apps/tenant/src/core/campaigns/purchase-flow.ts`

| Step | What happens | Breakpoint |
|------|--------------|------------|
| 8.1 | `getPurchaseState(currentResult)` → get `selectedProducts` | Empty → return `{ ok: false }` |
| 8.2 | `buildDraftOrderPayload(selectedProducts)` → `{ lineItems: [{ variantId, quantity }, ...] }` | — |
| 8.3 | **POST** to `campaign.settings.webhookUrl` (Railway) with `{ lineItems, customerEmail? }` | Network error, 4xx/5xx, or non-JSON → `{ success: false }` |
| 8.4 | Parse response; require `invoiceUrl` or `invoice_url` in JSON | Missing → `{ success: false }` |
| 8.5 | Update `campaign_recipients.result.purchase` with `invoiceUrl`, `lineItemsSent`, `checkoutConfirmed`, `checkoutConfirmedAt` | DB error → throw |
| 8.6 | Return `{ ok: true, message, invoiceUrl }` | — |

**Breakpoint 8:** Railway must return 200 with `{ invoiceUrl: "https://..." }`. If it fails or returns wrong shape, no `invoiceUrl` is persisted.

---

## Phase 9: Call Ends

| Step | What happens | Breakpoint |
|------|--------------|------------|
| 9.1 | Luna may call `hangup` tool, or customer hangs up | — |
| 9.2 | Telnyx sends `call.hangup` or `call.completed` to call-events route | — |
| 9.3 | `updateCampaignRecipientFromCallEvent` sets `campaign_recipients.status` (e.g. `completed`) | — |
| 9.4 | `recordAiCallCostFromEvent` records usage/cost | — |

---

## Quick Reference: Breakpoint Checklist

| Breakpoint | Symptom | Verify |
|------------|---------|--------|
| **0.6** | No assistant starts; call ends quickly | Call Control App `webhook_event_url` = `https://<app>/api/webhooks/telnyx/call-events` |
| **0.7** | Luna only has `hangup`; no `add_to_selection` / `create_draft_order` | Telnyx AI Assistant → Tools: add both webhook tools |
| **1.11** | create-draft-order returns 404 "not_campaign_call" | `campaign_recipients.call_control_id` must match Telnyx’s `call_control_id` |
| **3.9** | No Luna; call rings then ends | Check `ai_assistant_start` logs; Telnyx API key; assistant ID |
| **4.3 / 6.3** | Luna never calls purchase tools | Assistant must have tools configured; instructions must say when to call |
| **8.3 / 8.4** | No `invoiceUrl` persisted | Railway webhook must return 200 + `{ invoiceUrl: "..." }` |

---

## Data Flow Summary

```
Campaign Executor
  → POST /calls (Telnyx)
  → PUT client_state_update (Telnyx)
  → UPDATE campaign_recipients SET call_control_id

Telnyx call.answered
  → POST /api/webhooks/telnyx/call-events
  → handleOutboundCallAnsweredAssistant
  → POST /calls/{id}/actions/ai_assistant_start (Telnyx)

Luna: customer selects product
  → Telnyx POSTs add_to_selection tool
  → POST /api/webhooks/telnyx/campaign-purchase/add-to-selection
  → addSelectedProduct → UPDATE campaign_recipients.result.purchase.selectedProducts

Luna: customer confirms
  → Telnyx POSTs create_draft_order tool (customerConfirmed: true)
  → POST /api/webhooks/telnyx/campaign-purchase/create-draft-order
  → triggerDraftOrderAndSaveResult
    → POST campaign.settings.webhookUrl (Railway)
    → UPDATE campaign_recipients.result.purchase.invoiceUrl
```
