# Railway Draft Invoice Webhook — Audit: Retell vs This App (Tinadmin/Telnyx Campaign)

**Endpoint:** `https://shopify-mcp-retell-integration-production-0355.up.railway.app/functions/shopify_send_draft_invoice`  
**Goal:** Determine why Retell succeeds and this app does not; make the webhook support both without duplicating the function.

---

## 1. Retell Request (Working)

| Aspect | Value |
|--------|--------|
| **HTTP method** | POST |
| **Headers** | `Content-Type: application/json`, `X-Retell-Signature` (signature of request body using Retell secret) |
| **Body shape** | Retell custom-function envelope |
| **Body schema** | See below |

**Retell request body (from [Retell Custom Function docs](https://docs.retellai.com/build/conversation-flow/custom-function)):**

```json
{
  "name": "shopify_send_draft_invoice",
  "args": {
    "lineItems": [ { "variantId": "gid://shopify/ProductVariant/123", "quantity": 1 } ],
    "customerEmail": "customer@example.com"
  },
  "call": {
    "call_id": "...",
    "agent_id": "...",
    "transcript": "...",
    "metadata": { ... }
  }
}
```

- **Auth:** Railway function likely verifies `X-Retell-Signature` (body signed with Retell API key). Requests without a valid signature may be rejected (401).
- **Line items:** Read from `body.args.lineItems` (and possibly `body.args.customerEmail`).
- **Context:** `body.call` provides call metadata and transcript; function may rely on it for logging or store resolution.

---

## 2. This App Request (Failing)

| Aspect | Value |
|--------|--------|
| **HTTP method** | POST |
| **Headers** | `Content-Type: application/json` only. **No `X-Retell-Signature`.** No `X-Source-App` (before refactor). |
| **Body shape** | Flat payload; no `name` / `args` / `call` envelope. |
| **Body schema** | See below. |

**This app request body (current):**

```json
{
  "lineItems": [ { "variantId": "gid://shopify/ProductVariant/123", "quantity": 1 } ],
  "items": [ ... same ... ],
  "line_items": [ ... same ... ],
  "variant_ids": [ "gid://shopify/ProductVariant/123" ],
  "quantities": [ 1 ],
  "customerEmail": "customer@example.com",
  "customer_email": "customer@example.com",
  "email": "customer@example.com"
}
```

- **Auth:** No signature. If Railway validates `X-Retell-Signature`, this request fails with 401.
- **Line items:** Sent at **top level** (`body.lineItems`), not under `body.args`. If Railway only reads `body.args.lineItems`, it sees missing/undefined.
- **Context:** No `body.call`. Any logic that expects `call` (e.g. call_id, transcript, metadata) will get undefined.

---

## 3. Comparison Summary

| Item | Retell | This app | Mismatch impact |
|------|--------|----------|------------------|
| **URL** | Same | Same | — |
| **Method** | POST | POST | — |
| **Content-Type** | application/json | application/json | — |
| **X-Retell-Signature** | Present (signed body) | **Missing** | **401 if Railway verifies** |
| **body.name** | `"shopify_send_draft_invoice"` | **Missing** | Function may assume Retell and reject or mis-parse |
| **body.args** | `{ lineItems, customerEmail? }` | **Missing** (we send flat) | **Railway reads args.lineItems → undefined** |
| **body.call** | Full call object | **Missing** | Store/tenant resolution or logging may fail |
| **Line items location** | `body.args.lineItems` | `body.lineItems` | **Primary cause: wrong path** |
| **CORS** | Server-to-server | Server-to-server | No browser; CORS unlikely |

**Most likely causes of failure:**

1. **Auth:** Railway returns 401 when `X-Retell-Signature` is missing or invalid.
2. **Request shape:** Railway reads `body.args.lineItems` and `body.args.customerEmail`; our app sends `body.lineItems` and `body.customerEmail` → payload appears empty/invalid.
3. **Retell-specific logic:** Code may assume `body.call` or `body.name` and throw or early-return when absent.

---

## 4. Recommended Fixes

### A. In this app (konnect-caas-base) — done in code

- Send a **dual-format** body so the same endpoint can support both:
  - **Top-level (current):** `lineItems`, `customerEmail` / `customer_email` / `email`, plus aliases.
  - **Retell-compatible envelope:** `name`, `args` (with `lineItems`, `customerEmail`), and a minimal `call` (e.g. `{ metadata: { source: "tinadmin_telnyx_campaign" } }`).
- Set **`X-Source-App: tinadmin-telnyx-campaign`** so Railway can detect caller and optionally skip Retell signature verification for this source.
- Add **temporary logging:** request id, headers sent, body keys, response status, response body snippet, and parse/validation errors (see below).

### B. In Railway function (shopify-mcp-retell-integration)

Implement a **single handler** that supports both callers:

1. **Detect source**
   - If `X-Source-App: tinadmin-telnyx-campaign` → treat as Tinadmin; do **not** require `X-Retell-Signature`.
   - Else if `body.name === "shopify_send_draft_invoice"` and `body.args` → treat as Retell; **verify** `X-Retell-Signature` if present.

2. **Normalize to internal schema**
   - **From Retell:** `lineItems = body.args?.lineItems ?? []`, `customerEmail = body.args?.customerEmail ?? body.args?.email`.
   - **From Tinadmin:** `lineItems = body.lineItems ?? body.line_items ?? body.items ?? []`, `customerEmail = body.customerEmail ?? body.customer_email ?? body.email`.

3. **Validate**
   - Require `lineItems` array (length ≥ 1) and valid Shopify variant IDs.
   - Optional: require `customerEmail` if your flow sends email.

4. **Logging (temporary)**
   - Log: inbound headers (at least `content-type`, `x-source-app`, `x-retell-signature` presence), body keys, parsed source, validation errors, downstream Shopify/draft-order errors, and final response status/body.

5. **Response**
   - Return same shape for both: `200` with `{ invoiceUrl: "..." }` or `{ invoice_url: "..." }`. Optionally `{ error: "message" }` on 4xx/5xx with a consistent format.

6. **CORS**
   - Not required for server-to-server; if you add a browser client later, allow the app origin.

---

## 5. Temporary Logging (Railway)

Suggested fields to log per request:

- `received_at` (ISO)
- `request_id` (if app sends `X-Request-Id`)
- `source`: `"retell"` | `"tinadmin"`
- `headers`: `{ "content-type": "...", "x-source-app": "...", "x-retell-signature": "present"|"missing" }`
- `body_keys`: `Object.keys(body)`
- `normalized_line_items_count`: number
- `normalized_customer_email`: present | missing
- `validation_error`: string | null
- `downstream_error`: string | null (e.g. Shopify API error)
- `response_status`: number
- `response_invoice_url`: present | missing

---

## 6. Shared Internal Schema (for Railway)

Use a single internal type after normalization:

```ts
interface DraftInvoiceRequest {
  lineItems: Array<{ variantId: string; quantity: number }>;
  customerEmail?: string;
  source: "retell" | "tinadmin";
  callId?: string;   // from Retell body.call.call_id if present
}
```

Then one code path: create draft order, send email, return `{ invoiceUrl }`.

---

## 7. This App: Response Handling

Our app already accepts multiple response shapes:

- `data.invoiceUrl` or `data.invoice_url`
- `data.draftOrder?.invoiceUrl` or `data.draftOrder?.invoice_url`

No change needed on our side for response parsing once Railway returns 200 with one of these.

---

## 8. Checklist

- [ ] **Railway:** Add source detection (header + body shape).
- [ ] **Railway:** Normalize request into shared schema from both Retell and Tinadmin payloads.
- [ ] **Railway:** Skip Retell signature verification when `X-Source-App: tinadmin-telnyx-campaign`.
- [ ] **Railway:** Add temporary logging (headers, body keys, source, validation/downstream errors, response).
- [x] **This app:** Send dual-format body + `X-Source-App` (implemented in `apps/tenant/src/core/campaigns/purchase-flow.ts`).
- [x] **This app:** Add request logging (requestId, headers, body keys, response status/body) — implemented in purchase-flow.

---

## 9. Railway Implementation Sketch (pseudo-code)

```ts
// 1. Detect source
const sourceApp = req.headers["x-source-app"];
const isTinadmin = sourceApp === "tinadmin-telnyx-campaign";
const isRetell = !isTinadmin && body?.name === "shopify_send_draft_invoice" && body?.args != null;

// 2. Auth: only verify Retell signature when caller is Retell
if (isRetell && req.headers["x-retell-signature"]) {
  if (!Retell.verify(JSON.stringify(body), process.env.RETELL_API_KEY, req.headers["x-retell-signature"]))
    return res.status(401).json({ error: "Invalid signature" });
}
if (!isRetell && !isTinadmin)
  return res.status(400).json({ error: "Unknown source" });

// 3. Normalize
const lineItems = isRetell
  ? (body.args?.lineItems ?? body.args?.line_items ?? [])
  : (body.lineItems ?? body.line_items ?? body.items ?? []);
const customerEmail = isRetell
  ? (body.args?.customerEmail ?? body.args?.email)
  : (body.customerEmail ?? body.customer_email ?? body.email);

// 4. Validate, create draft order, send email, return { invoiceUrl }
```
