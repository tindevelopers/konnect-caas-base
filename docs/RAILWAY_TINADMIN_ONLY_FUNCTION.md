# Simpler option: New Railway function for Tinadmin only

If the dual-source approach feels complicated, use **two endpoints** instead:

| Endpoint | Used by | Request shape | Auth |
|----------|---------|----------------|-------|
| **Existing** `/functions/shopify_send_draft_invoice` | Retell only | `name`, `args`, `call` | `X-Retell-Signature` |
| **New** e.g. `/functions/tinadmin_draft_invoice` | This app (Tinadmin) only | Flat: `lineItems`, `customerEmail`, etc. | None, or your own (e.g. API key) |

Use a path that does **not** contain `shopify_send_draft_invoice`, so our app sends the flat body only (no Retell envelope).

You **do not** change the existing Retell function. You add one new function that only accepts what our app sends.

---

## What to build (new function only)

**1. New route** in your Railway project, e.g.:

- Path: `/functions/tinadmin_draft_invoice` (or any path **without** `shopify_send_draft_invoice` in it)
- Method: `POST`
- Body: JSON (what our app already sends)

**2. Request body** (exactly what this app sends):

```json
{
  "lineItems": [
    { "variantId": "gid://shopify/ProductVariant/123", "quantity": 1 }
  ],
  "items": [ ... same ... ],
  "line_items": [ ... same ... ],
  "variant_ids": ["gid://shopify/ProductVariant/123"],
  "quantities": [1],
  "customerEmail": "customer@example.com",
  "customer_email": "customer@example.com",
  "email": "customer@example.com"
}
```

Read **only** what you need, e.g.:

- `lineItems = body.lineItems ?? body.line_items ?? body.items ?? []`
- `customerEmail = body.customerEmail ?? body.customer_email ?? body.email`

**3. Logic** (same as your existing draft-order flow):

- Validate `lineItems` (and optionally `customerEmail`)
- Create Shopify draft order
- Send email with checkout link
- Return `200` with `{ "invoiceUrl": "https://..." }` (or `invoice_url`)

**4. No Retell code** in this function: no `name`/`args`/`call`, no `X-Retell-Signature`. Optional: add a simple secret (e.g. `X-API-Key` or query param) if you want to lock the endpoint to your app.

---

## What to set in this app

In the **campaign** (or wherever you set the webhook URL), set **Webhook URL** to the **new** function, e.g.:

```text
https://shopify-mcp-retell-integration-production-0355.up.railway.app/functions/tinadmin_draft_invoice
```

Our app sends the **flat** body to any URL whose path does **not** contain `shopify_send_draft_invoice`. So a path like `/functions/tinadmin_draft_invoice` gets the simple shape. No code changes needed in this repo.

---

## Summary

- **Existing function:** Leave it as-is for Retell only.
- **New function:** One route, one body shape (flat `lineItems` + `customerEmail`), same draft-order + email logic.
- **This app:** Point campaign webhook URL to the new function.

No dual-source logic, no branching by caller—just a second, Tinadmin-only endpoint.
