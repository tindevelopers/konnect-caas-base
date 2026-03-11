# Campaign Purchase Flow (Two-Stage)

Outbound campaign calls can use a **two-stage** purchase flow: product selection during the call, then a single draft-order trigger only after the customer confirms they want the checkout link.

## Behavior

1. **Stage 1 — Discovery and selection**
   - Luna helps the customer discover products (existing behavior).
   - When the customer selects a product, Luna calls the **add_to_selection** tool with product details.
   - Selected products are stored in call/session state (`campaign_recipients.result.purchase.selectedProducts`). No webhook is triggered.

2. **Stage 2 — Final confirmation**
   - When Luna believes the selection is complete, she asks a **final confirmation** question, e.g.:
     - "Would you like me to send you the checkout link by email?"
     - "Shall I send those over by email so you can check out?"
     - "Are you happy with those products? I can send the checkout link to your email."
   - **Only if the customer explicitly confirms** (e.g. "Yes", "Send it"), Luna calls the **create_draft_order** tool.
   - The app then builds the payload from `selectedProducts`, POSTs to the campaign’s **Webhook URL** (e.g. Railway), and stores the returned `invoiceUrl` in session state.

## Trigger conditions

The purchase webhook is triggered only when **all** of the following are true:

- `selectedProducts.length > 0`
- Customer has confirmed they want the checkout link (tool receives `customerConfirmed: true`)
- `campaign.settings.enableProductPurchaseFlow === true`
- `campaign.settings.webhookUrl` is set

If a checkout `invoiceUrl` already exists for the call/session, the tool will return the existing link and **will not** trigger the webhook again (unless a force override is explicitly used).

## Telnyx assistant tools

Configure Luna in Telnyx with **two webhook tools**.

### 1. Add to selection (no checkout trigger)

- **Name:** `add_to_selection` (or `add_product_to_selection`)
- **URL:** `https://<your-app>/api/webhooks/telnyx/campaign-purchase/add-to-selection`
- **When to call:** When the customer selects a product during discovery (e.g. "I'll take that one", "Add the Andis Clipper").
- **Body parameters (JSON schema):**
  - `productTitle` (string)
  - `variantId` (string, required) — e.g. `gid://shopify/ProductVariant/123`
  - `quantity` (number, required)
  - `productUrl` (string, optional)
  - `variantTitle` (string, optional)
  - `sku` (string, optional)
  - `price` (number, optional)

### 2. Create draft order (after confirmation only)

- **Name:** `create_draft_order` or `send_checkout_email`
- **URL:** `https://<your-app>/api/webhooks/telnyx/campaign-purchase/create-draft-order`
- **When to call:** **Only** after the customer has explicitly confirmed they want the checkout link by email (e.g. "Yes, send it", "Please send the link").
- **Body parameters:**
  - `customerConfirmed` (boolean, **required**) — must be `true` to trigger the webhook
  - `customerEmail` (string, optional) — if your Railway flow needs it
  - `force` (boolean, optional) — bypass duplicate protection if an `invoiceUrl` already exists (use sparingly)

## Assistant instructions (Luna)

In Luna’s instructions, include:

- Accumulate selected products by calling **add_to_selection** whenever the customer chooses a product. Do not call create_draft_order at this stage.
- When product selection seems complete, ask **one** final confirmation question (e.g. "Would you like me to send you the checkout link by email?").
- Call **create_draft_order** only when the customer clearly confirms they want the link (e.g. "yes", "send it", "please send the link").
- Do not trigger the checkout tool when the customer is only adding or discussing products; only after explicit confirmation to send the checkout link.

## Railway payload

When **create_draft_order** runs, the app POSTs to the campaign’s Webhook URL with:

```json
{
  "lineItems": [
    { "variantId": "gid://shopify/ProductVariant/123", "quantity": 1 },
    { "variantId": "gid://shopify/ProductVariant/456", "quantity": 1 }
  ]
}
```

If `customerEmail` is sent by the tool, it is included in the body. The Railway endpoint should create the Shopify Draft Order and return `invoiceUrl` (or `invoice_url`) in the JSON response.

## State storage

- **Location:** `campaign_recipients.result.purchase`
- **Shape:**
  - `selectedProducts`: array of `{ productTitle, productUrl?, variantId, quantity, variantTitle?, sku?, price? }`
  - `lineItemsSent`: array of `{ variantId, quantity }` sent to the webhook
  - `checkoutConfirmed`: boolean
  - `checkoutConfirmedAt`: ISO timestamp
  - `invoiceUrl`: set after a successful create_draft_order call

Existing campaign behavior (e.g. Groom’D attendance logic) is unchanged. Purchase flow runs only when the campaign has **Enable AI Product Purchase Flow** on and a **Webhook URL** set.
