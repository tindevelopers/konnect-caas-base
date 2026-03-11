---
name: Two-stage purchase confirmation gate
overview: Prevent premature Shopify draft-order creation by enforcing an explicit final-confirmation gate in the `create_draft_order` tool route, while continuing to accumulate product selections in session state.
todos:
  - id: enforce-confirmation-gate
    content: Add `customerConfirmed` gating to `create-draft-order` route (block webhook unless true).
    status: completed
  - id: prevent-duplicate-draft-orders
    content: Prevent duplicate draft orders by returning existing `invoiceUrl` (unless explicitly forced).
    status: completed
  - id: persist-confirmation-state
    content: Extend `purchase` JSON state to store confirmation metadata and parse/persist it in `purchase-flow.ts`.
    status: completed
  - id: persist-line-items-sent
    content: Persist the exact `lineItems` payload sent to the webhook as `purchase.lineItemsSent` for audit/debugging.
    status: completed
  - id: update-docs
    content: Update `CAMPAIGN_PURCHASE_FLOW.md` with required `customerConfirmed` parameter and revised trigger conditions.
    status: completed
isProject: false
---

## Goal

Ensure the campaign purchase webhook is **only** triggered after explicit customer approval to receive the checkout link by email, not when products are merely suggested or initially selected.

## Current state (confirmed in code)

- **Selection state** is already persisted in `campaign_recipients.result.purchase.selectedProducts` via `[apps/tenant/app/api/webhooks/telnyx/campaign-purchase/add-to-selection/route.ts](/Users/developer/Projects/konnect-caas-base/apps/tenant/app/api/webhooks/telnyx/campaign-purchase/add-to-selection/route.ts)`.
- The **only webhook trigger** is `[apps/tenant/app/api/webhooks/telnyx/campaign-purchase/create-draft-order/route.ts](/Users/developer/Projects/konnect-caas-base/apps/tenant/app/api/webhooks/telnyx/campaign-purchase/create-draft-order/route.ts)`, which posts `{ lineItems: [...] }` to `campaign.settings.webhookUrl` using logic in `[apps/tenant/src/core/campaigns/purchase-flow.ts](/Users/developer/Projects/konnect-caas-base/apps/tenant/src/core/campaigns/purchase-flow.ts)`.
- **Problem**: “customer explicitly confirms” is currently only a *convention*; the server does not enforce it.

## Approach (2 tools; enforce confirmation in `create_draft_order`)

### 1) Add a hard confirmation gate (server-side)

- Update `[apps/tenant/app/api/webhooks/telnyx/campaign-purchase/create-draft-order/route.ts](/Users/developer/Projects/konnect-caas-base/apps/tenant/app/api/webhooks/telnyx/campaign-purchase/create-draft-order/route.ts)` to require an explicit boolean in the request body:
  - Accept any of: `customerConfirmed`, `customer_confirmed`, `confirmed`.
  - Normalize early and **coerce strictly**:
    - Allow boolean `true`
    - Optionally allow string `"true"` (only if we decide to support this intentionally)
    - Do **not** treat random truthy strings loosely
  - **Only proceed to `triggerDraftOrderAndSaveResult(...)` if this value is `true`.**
  - If missing/false: return `200` with a `content` message that prompts Luna to ask a final confirmation question (and an `error` code like `needs_final_confirmation`).

### 2) Prevent duplicate draft orders (idempotency guard)

- Before creating a new draft order, check whether `campaign_recipients.result.purchase.invoiceUrl` already exists for this call/session.
  - If present, return `200` with the existing `invoiceUrl` and a `content` message like “I’ve already generated your checkout link—do you want me to resend it?” and **do not** call the webhook.
  - Optionally support a `force: true` / `forceCreate: true` body param to bypass this guard for recovery/debugging (default is safe/no-duplicate).

### 3) Persist confirmation metadata + what was sent (recommended for debugging)

- Extend the purchase state stored at `campaign_recipients.result.purchase` with:
  - `checkoutConfirmedAt` (ISO string)
  - `checkoutConfirmed` (boolean)
- Persist the final payload that was POSTed to the webhook:
  - `lineItemsSent`: array of `{ variantId, quantity }` used for the webhook call
- Update `[apps/tenant/src/core/campaigns/purchase-flow.ts](/Users/developer/Projects/konnect-caas-base/apps/tenant/src/core/campaigns/purchase-flow.ts)` so `getPurchaseState()` safely parses these fields, and `triggerDraftOrderAndSaveResult()` persists them along with `invoiceUrl`.

### 4) Make the final handoff tool schema unambiguous (docs)

- Update `[apps/tenant/docs/CAMPAIGN_PURCHASE_FLOW.md](/Users/developer/Projects/konnect-caas-base/apps/tenant/docs/CAMPAIGN_PURCHASE_FLOW.md)`:
  - In **Create draft order** tool section, document required `customerConfirmed: true`.
  - Clarify that the server **will not** call the webhook unless confirmation is present.
  - Document idempotency behavior (existing `invoiceUrl` returned) and any `force` override if implemented.

## Acceptance checks

- **No premature trigger**: calling `create-draft-order` without `customerConfirmed: true` never sends an HTTP POST to `campaign.settings.webhookUrl`.
- **No duplicate draft orders**: calling `create-draft-order` again after `invoiceUrl` exists does not call the webhook; it returns the existing `invoiceUrl` (unless `force` is explicitly used).
- **Happy path**: after at least 1 `add-to-selection`, calling `create-draft-order` with `customerConfirmed: true`:
  - posts `{ lineItems: [{ variantId, quantity }, ...] }` to `webhookUrl`
  - stores returned `invoiceUrl` in `campaign_recipients.result.purchase.invoiceUrl`
  - stores `lineItemsSent` in `campaign_recipients.result.purchase.lineItemsSent`
- **Gates preserved**: still requires:
  - `enableProductPurchaseFlow === true`
  - `webhookUrl` present
  - `selectedProducts.length > 0`
- **No impact**: Groom’D attendance logic unchanged (not touched).

## Manual test plan (local)

- Seed/identify a `campaign_recipients` row with a `call_control_id`.
- POST to `add-to-selection` with that `call_control_id` and a sample variant.
- POST to `create-draft-order` **without** `customerConfirmed`: expect `200` with confirmation prompt, and verify webhook wasn’t hit.
- POST to `create-draft-order` with `customerConfirmed: true`: expect `invoiceUrl`, `lineItemsSent`, and persisted state update.
- POST to `create-draft-order` again: expect it returns the same `invoiceUrl` without calling the webhook (unless `force` is provided).

