# Outbound Campaign Voice Call Workflow (Groom'D / Campaign Purchase)

This document describes the **end-to-end technical flow** for outbound campaign voice calls in this codebase: how a call is initiated, how the Telnyx AI assistant runs the script, how product search and order creation work, and which systems and endpoints are involved.

---

## 1. System Architecture (High-Level)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              OUTBOUND CAMPAIGN VOICE FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────────────────┘

  CUSTOMER (grooming professional)
       │
       │  Phone call (PSTN)
       ▼
  ┌─────────────────┐
  │ Telnyx Voice     │  ← Connection (Call Control Application) receives call
  │ Platform        │
  └────────┬────────┘
       │
       │  call.answered / call.conversation.started → webhook
       ▼
  ┌─────────────────────────────────────────────────────────────────────────────────────┐
  │ Next.js (Vercel) — apps/tenant                                                       │
  │   POST /api/webhooks/telnyx/call-events                                              │
  │   • Verify signature (ED25519 or HMAC)                                               │
  │   • Store in telephony_events + ai_agent_events                                        │
  │   • Resolve tenant from campaign_recipients (call_control_id)                        │
  │   • On call.answered: decode client_state → ai_assistant_start (Telnyx API)          │
  └─────────────────────────────────────────────────────────────────────────────────────┘
       │
       │  Telnyx starts AI assistant on the call (instructions + optional greeting)
       ▼
  ┌─────────────────┐
  │ Telnyx AI       │  Assistant runs campaign script; can invoke tools (webhooks).
  │ Assistant       │  Tools: search_products, add_to_selection, create_draft_order
  └────────┬────────┘
       │
       ├──► search_products     → POST /api/webhooks/telnyx/campaign-purchase/search-products
       │         │
       │         ▼
       │    Next.js → PRODUCT_SEARCH_URL (e.g. productsearch.mypetjet.com) → products + variantIds
       │         │
       │         └──► Assistant speaks results; customer may say "add that one"
       │
       ├──► add_to_selection    → POST /api/webhooks/telnyx/campaign-purchase/add-to-selection
       │         │
       │         ▼
       │    Next.js → campaign_recipients.result.purchase.selectedProducts (Supabase)
       │         │
       │         └──► Assistant confirms; may ask "ready for checkout link?"
       │
       └──► create_draft_order  → POST /api/webhooks/telnyx/campaign-purchase/create-draft-order
                 │
                 ▼
            Next.js → triggerDraftOrderAndSaveResult()
                 │
                 ▼
            POST to campaign webhook (settings.webhookUrl / railwayWebhookUrl)
                 │
                 ▼
            External service (e.g. Railway / Shopify draft order) → invoice URL
                 │
                 ▼
            campaign_recipients.result.purchase.invoiceUrl saved; assistant tells customer
                 │
                 ▼
  CUSTOMER receives checkout link (e.g. by email) and completes purchase (Shopify)
```

---

## 2. ASCII Flowchart (Simplified)

```
Customer
   │
   ▼
Telnyx Voice (PSTN + Call Control)
   │
   ▼
Webhook: POST /api/webhooks/telnyx/call-events
   │
   ▼
Next.js: store events, start AI assistant (ai_assistant_start)
   │
   ▼
Telnyx AI Assistant (conversation + tools)
   │
   ├── search_products ──► Next.js /api/.../search-products ──► PRODUCT_SEARCH_URL (product search API)
   │
   ├── add_to_selection ──► Next.js /api/.../add-to-selection ──► Supabase (campaign_recipients.result)
   │
   └── create_draft_order ──► Next.js /api/.../create-draft-order ──► Campaign webhook URL ──► Shopify / Railway
```

---

## 3. Step-by-Step Workflow Table

| Step | Event | System/Technology | API Endpoint | Description |
|------|--------|--------------------|--------------|-------------|
| 0 | Campaign batch triggered | Next.js / Vercel Cron or UI | `GET/POST /api/campaigns/process` (cron) or `processCampaignBatchNow()` (UI "Process now") | Cron (e.g. every 2 min) or user triggers processing of due campaign recipients. Auth: `Authorization: Bearer CRON_SECRET`. |
| 1 | Outbound call created | Telnyx Voice API | `POST https://api.telnyx.com/v2/calls` (via executor) | Executor loads running voice campaigns, selects scheduled recipients, and for each: `transport.request("/calls", { method: "POST", body: { connection_id, from, to } })`. |
| 2 | Call control ID stored | Next.js + Supabase | — | Executor updates `campaign_recipients` with `call_control_id`, inserts `campaign_events` (event_type: `call.initiated`). |
| 3 | Client state set for webhook | Telnyx Voice API | `PUT /calls/{call_control_id}/actions/client_state_update` | Executor sets base64-encoded `client_state`: `{ t: "tinadmin_outbound_assistant", a: assistant_id, tid: tenant_id, g: greeting?, cg, pf: enableProductPurchaseFlow, rw: webhookUrl }`. |
| 4 | Call answered | Telnyx | — | Telnyx sends `call.answered` or `call.conversation.started` to the Call Control Application webhook URL. |
| 5 | Call events webhook | Next.js (Vercel) | `POST /api/webhooks/telnyx/call-events` | Verify signature (ED25519 or HMAC). Insert into `telephony_events` and (for conversation/assistant events) `ai_agent_events`. Resolve tenant from `campaign_recipients` by `call_control_id` if not in payload. Update `campaign_recipients` status (e.g. in_progress, completed, no_answer). |
| 6 | AI assistant started on call | Next.js → Telnyx | `POST /calls/{call_control_id}/actions/ai_assistant_start` | `handleOutboundCallAnsweredAssistant` decodes `client_state`; if `t === "tinadmin_outbound_assistant"`, fetches assistant instructions (and optional greeting), then calls Telnyx to start the assistant on the call. |
| 7 | Assistant runs script | Telnyx AI Assistants | internal | Assistant follows instructions; when customer asks about products, it invokes the `search_products` tool (webhook). |
| 8 | Product search tool | Telnyx → Next.js | `POST /api/webhooks/telnyx/campaign-purchase/search-products` | Telnyx calls this URL with tool args (e.g. `query`). Next.js extracts query (body or fallback via `x-telnyx-call-control-id` → `ai_agent_events` → conversation messages). Then POSTs to `PRODUCT_SEARCH_URL`. |
| 9 | Upstream product search | Next.js → Product Search API | `POST PRODUCT_SEARCH_URL` (e.g. `https://productsearch.mypetjet.com/api/chat`) | Body: `{ message: query, conversationHistory: [] }`. Returns `{ products: [...], message? }`. Products normalized to include `variantId` for Shopify. |
| 10 | Search results to assistant | Next.js → Telnyx | Response from search-products route | JSON with `content` (readable list) and `products` (with variantId). Assistant speaks results and suggests calling `add_to_selection` when customer picks one. |
| 11 | Add to selection tool | Telnyx → Next.js | `POST /api/webhooks/telnyx/campaign-purchase/add-to-selection` | Body: variantId (Shopify GID), quantity, optional productTitle. Next.js: `getRecipientAndCampaignByCallControlId(call_control_id)` → `addSelectedProduct()` → update `campaign_recipients.result.purchase.selectedProducts`. |
| 12 | Customer confirms checkout | Telnyx AI | internal | Customer says they want the checkout link (e.g. "Yes, send it"). Assistant calls `create_draft_order` with `customerConfirmed: true`. |
| 13 | Create draft order tool | Telnyx → Next.js | `POST /api/webhooks/telnyx/campaign-purchase/create-draft-order` | Next.js: get recipient/campaign, check `enableProductPurchaseFlow` and `webhookUrl`, validate `customerConfirmed`, build line items from `selectedProducts`, call `triggerDraftOrderAndSaveResult()`. |
| 14 | Draft order webhook | Next.js → External | `POST settings.webhookUrl` (or `railwayWebhookUrl`) | Next.js POSTs `{ lineItems, customerEmail, ... }` (and optionally Retell-style envelope) to campaign-configured URL. Header: `X-Source-App: tinadmin-telnyx-campaign`. |
| 15 | Shopify / Railway | External service | Configured webhook URL | External service creates Shopify draft order (or equivalent), sends invoice/checkout link by email, returns `invoiceUrl` in JSON. |
| 16 | Save invoice URL | Next.js + Supabase | — | `triggerDraftOrderAndSaveResult` updates `campaign_recipients.result.purchase` with `invoiceUrl`, `checkoutConfirmed`, `lineItemsSent`. |
| 17 | Assistant tells customer | Telnyx AI | — | Assistant says checkout link was sent to email. |
| 18 | Call ends | Telnyx | — | Telnyx sends `call.hangup` / `call.completed` to call-events webhook. |
| 19 | Cost recording | Next.js | — | `recordAiCallCostFromEvent` in call-events handler: duration from payload, optional Telnyx conversation cost API; writes to billing/usage and `agent_usage_events`. |

---

## 4. Product Search Flow (Detail)

### 4.1 Sequence

```
Telnyx AI Assistant
   │  Customer says e.g. "I need a cordless dog clipper"
   │  Assistant decides to call search_products
   ▼
POST /api/webhooks/telnyx/campaign-purchase/search-products
   │  Optional header: x-telnyx-call-control-id
   │  Body: may be empty or contain { query, ... } or { arguments: { query } } or Telnyx envelope
   ▼
Next.js route (search-products/route.ts)
   │
   ├─ Query from body (preferred)
   │  extractQuery(body) checks: body.query, body.message, body.search, body.arguments.*,
   │  body.data.payload.arguments.*, etc. First non-empty string wins.
   │
   └─ Query from conversation (fallback when body query missing)
      1. Get x-telnyx-call-control-id from request.
      2. findConversationIdByCallControlId(callControlId):
         - Query ai_agent_events: provider=telnyx, external_id=callControlId,
           event_type IN ('call.conversation.created','call.conversation.ended'),
           order by received_at desc, limit 10.
         - From each row payload, extract conversation_id (data.payload.conversation_id or data.conversation_id).
      3. findQueryFromConversationMessages(conversationId):
         - GET https://api.telnyx.com/v2/ai/conversations/{id}/messages?sort=desc&page[size]=50
           (Authorization: Bearer TELNYX_API_KEY).
         - In messages, find tool_calls where function.name === 'search_products', parse function.arguments JSON for query.
   ▼
Once query is set:
   POST PRODUCT_SEARCH_URL (default https://productsearch.mypetjet.com/api/chat)
   Body: { message: query, conversationHistory: [] }
   Timeout: 12s (PRODUCT_SEARCH_TIMEOUT_MS)
   ▼
Response: { products: [...], message? }
   Normalize products (name, variantId, price, url, sku, etc.), max 10.
   Return to Telnyx: { content: "Here are the products...", products }.
```

### 4.2 Query extraction (body vs conversation fallback)

- **Body:** The route checks, in order, top-level and nested keys: `query`, `message`, `search`, `product_query`, `productQuery`, `text`, `input`, and under `arguments`, `data.payload.arguments` for Telnyx envelope. First non-empty string is used.
- **Conversation fallback:** If no query from body, the route uses `x-telnyx-call-control-id` to find a `conversation_id` from `ai_agent_events`, then fetches conversation messages from the Telnyx API and parses the latest `search_products` tool call arguments for `query`.

**Relevant file:** `apps/tenant/app/api/webhooks/telnyx/campaign-purchase/search-products/route.ts`  
See also: `docs/SEARCH_PRODUCTS_QUERY_FLOW.md`.

---

## 5. Order Creation Flow (Detail)

### 5.1 Sequence

```
Assistant confirms with customer: "Should I send the checkout link to your email?"
Customer: "Yes, send it"
   ▼
Assistant calls create_draft_order with { customerConfirmed: true, customerEmail?: "..." }
   ▼
POST /api/webhooks/telnyx/campaign-purchase/create-draft-order
   Header: x-telnyx-call-control-id (or in body)
   ▼
Next.js create-draft-order/route.ts
   │  getCallControlId(request, body)
   │  getRecipientAndCampaignByCallControlId(callControlId) → campaign_recipients + campaigns.settings
   │  getCampaignAutomationSettings(settings) → enableProductPurchaseFlow, webhookUrl
   │  If !enableProductPurchaseFlow || !webhookUrl → 403 purchase_flow_disabled
   │  Parse customerConfirmed (true/yes/1); if false → 200 { content: "Are you happy with those products?...", error: "needs_final_confirmation" }
   │  getPurchaseState(result) → selectedProducts
   │  If no selectedProducts → 400 no_products
   │  Customer email: body.customerEmail || recipient.email; if missing → 200 ask for email
   ▼
triggerDraftOrderAndSaveResult(recipientId, result, webhookUrl, { customerEmail, checkoutConfirmed: true })
   │  buildDraftOrderPayload(selectedProducts) → { lineItems: [{ variantId, quantity }] }
   │  postDraftOrderToWebhook(webhookUrl, payload, { customerEmail })
   │     POST webhookUrl with X-Source-App: tinadmin-telnyx-campaign, body: lineItems, customerEmail, etc.
   │     If URL path contains "/functions/shopify_send_draft_invoice" → also send Retell-style envelope (name, args, call.metadata)
   │     Parse response for invoiceUrl (or invoice_url, draftOrder.invoiceUrl)
   │  Update campaign_recipients.result.purchase: checkoutConfirmed, lineItemsSent, invoiceUrl
   ▼
Return to Telnyx: { content: "I've sent the checkout link to your email...", invoiceUrl, success: true }
   ▼
External webhook (Railway / Shopify backend) creates draft order, emails checkout link; customer completes purchase on Shopify.
```

### 5.2 Relevant files

- **Create draft order route:** `apps/tenant/app/api/webhooks/telnyx/campaign-purchase/create-draft-order/route.ts`
- **Purchase flow (state, webhook POST, persist):** `apps/tenant/src/core/campaigns/purchase-flow.ts`
- **Add to selection (persist selected products):** `apps/tenant/app/api/webhooks/telnyx/campaign-purchase/add-to-selection/route.ts`

---

## 6. Technologies by Step

| Layer | Technologies |
|-------|---------------|
| **Voice / telephony** | Telnyx Voice API, Call Control, Telnyx AI Assistants (Conversational AI) |
| **App / API** | Next.js 16 (App Router), Vercel serverless (Node.js runtime) |
| **Webhooks** | `POST /api/webhooks/telnyx/call-events`, `.../campaign-purchase/search-products`, `.../campaign-purchase/add-to-selection`, `.../campaign-purchase/create-draft-order` |
| **Product search** | External API configured via `PRODUCT_SEARCH_URL` (e.g. productsearch.mypetjet.com); not Abacus in this flow |
| **Database** | Supabase (PostgreSQL): `campaigns`, `campaign_recipients`, `campaign_events`, `telephony_events`, `ai_agent_events`, `integration_configs` |
| **Draft order / checkout** | Campaign setting `settings.webhookUrl` or `settings.railwayWebhookUrl` → external service (e.g. Railway function, Shopify Admin API or custom backend) |
| **Scheduling / cron** | Vercel Cron or external scheduler → `GET /api/campaigns/process` |
| **Abacus** | Not part of the campaign voice flow. Abacus is used elsewhere (e.g. agent provider, chatbot). The `127.0.0.1:7737/ingest` calls in campaign webhook routes are optional debug/telemetry (e.g. Cursor), not production path. |

---

## 7. Environment Variables

| Variable | Used in | Purpose |
|----------|---------|---------|
| `TELNYX_API_KEY` | Executor, call-events, search-products fallback | Telnyx API auth (calls, ai_assistant_start, conversation messages) |
| `TELNYX_CONNECTION_ID` | Executor (or campaign.settings.connection_id) | Call Control connection for outbound dial |
| `TELNYX_WEBHOOK_SECRET` | call-events | HMAC signature verification (legacy) |
| `TELNYX_PUBLIC_KEY` | call-events | ED25519 webhook signature verification |
| `PRODUCT_SEARCH_URL` | search-products route | Upstream product search API (default: https://productsearch.mypetjet.com/api/chat) |
| `CRON_SECRET` | /api/campaigns/process | Auth for cron-triggered campaign processing |
| `BASE_URL` / `NEXT_PUBLIC_SITE_URL` | telnyx-ensure-campaign-purchase-tools, call-control | Public base URL for webhook URLs (call-events, search-products, add-to-selection, create-draft-order) |

Campaign-level (in `campaigns.settings` or integration): `connection_id`, `greeting`, `enableProductPurchaseFlow`, `webhookUrl` (or `railwayWebhookUrl`).

---

## 8. Database Tables

| Table | Role in campaign voice flow |
|-------|-----------------------------|
| **campaigns** | Campaign config: assistant_id, from_number, settings (connection_id, greeting, enableProductPurchaseFlow, webhookUrl), scheduling, throttling. |
| **campaign_recipients** | Per-recipient state: phone, status, scheduled_at, call_control_id, result (e.g. result.purchase.selectedProducts, result.purchase.invoiceUrl). |
| **campaign_events** | Audit: call.initiated, and events from call-events webhook (e.g. call.answered, call.hangup). |
| **telephony_events** | All Telnyx webhook events (call-events) stored here; tenant_id, provider, event_type, external_id, payload. |
| **ai_agent_events** | Subset of events (conversation/assistant-related) duplicated here; used by search-products to resolve conversation_id from call_control_id for query fallback. |
| **integration_configs** | Tenant Telnyx credentials and settings (for executor and webhook transport). |

---

## 9. File Reference

| Area | File(s) |
|------|--------|
| **Call initiation** | `apps/tenant/app/actions/campaigns/executor.ts` (processCampaignVoiceBatch, dial, client_state_update, campaign_recipients update) |
| **Cron / Process now** | `apps/tenant/app/api/campaigns/process/route.ts`, `apps/tenant/app/actions/campaigns/campaigns.ts` (processCampaignBatchNow) |
| **Call events webhook** | `apps/tenant/app/api/webhooks/telnyx/call-events/route.ts` (signature, telephony_events, ai_agent_events, tenant resolution, handleOutboundCallAnsweredAssistant, campaign_recipients/events, recordAiCallCostFromEvent) |
| **Search products** | `apps/tenant/app/api/webhooks/telnyx/campaign-purchase/search-products/route.ts` |
| **Add to selection** | `apps/tenant/app/api/webhooks/telnyx/campaign-purchase/add-to-selection/route.ts` |
| **Create draft order** | `apps/tenant/app/api/webhooks/telnyx/campaign-purchase/create-draft-order/route.ts` |
| **Purchase state & webhook POST** | `apps/tenant/src/core/campaigns/purchase-flow.ts` (getRecipientAndCampaignByCallControlId, addSelectedProduct, getPurchaseState, triggerDraftOrderAndSaveResult, postDraftOrderToWebhook) |
| **Campaign automation settings** | `apps/tenant/src/core/campaigns/automation-settings.ts` |
| **Telnyx webhook config** | `apps/tenant/src/core/telnyx/config.ts` |
| **Telnyx transport (webhook context)** | `apps/tenant/src/core/telnyx/webhook-transport.ts` |
| **Call Control app (webhook URL)** | `apps/tenant/app/actions/telnyx/call-control.ts` (webhook_event_url → .../call-events) |
| **Assistant tools setup** | `apps/tenant/scripts/telnyx-ensure-campaign-purchase-tools.ts` (register search_products, add_to_selection, create_draft_order URLs) |
| **Migrations** | `supabase/migrations/20260210000000_create_campaign_tables.sql`, `20260203000000_create_telephony_events.sql` |
| **Product search flow doc** | `docs/SEARCH_PRODUCTS_QUERY_FLOW.md` |

---

## 10. Summary

- **Outbound campaign voice** is driven by the **executor** (cron or "Process now") creating Telnyx calls and setting **client_state** so that when the call is **answered**, the **call-events** webhook starts the **Telnyx AI assistant** on that call.
- The assistant uses three **webhook tools** implemented as Next.js API routes: **search_products** (→ product search API), **add_to_selection** (→ Supabase), **create_draft_order** (→ campaign webhook → Shopify/draft order service).
- **Product search** uses `PRODUCT_SEARCH_URL`; the query is taken from the webhook body or, if missing, from **ai_agent_events** + Telnyx conversation messages.
- **Order creation** is two-phase: **add_to_selection** stores selected products in **campaign_recipients.result.purchase**; **create_draft_order** sends them to the campaign **webhookUrl** and stores the returned **invoiceUrl** for the assistant to confirm to the customer.
