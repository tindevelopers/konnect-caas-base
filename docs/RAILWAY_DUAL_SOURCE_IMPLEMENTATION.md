# Railway Function: How to Support Both Retell and This App (Tinadmin)

This guide shows **how** to implement dual-source support in your Railway function. It **does not replace** your Retell custom function—it **extends** it so the same endpoint accepts both Retell and Tinadmin requests.

---

## Will this affect the existing Retell custom function?

**No.** Retell behavior stays the same:

- Requests **from Retell** still have `name` + `args` + `call` and (when you verify) `X-Retell-Signature`. You keep verifying the signature for those and reading `body.args` as you do today.
- You only **add** a branch at the very beginning: if the request is from Tinadmin (`X-Source-App: tinadmin-telnyx-campaign`), you skip Retell signature checks and read from top-level `body.lineItems` / `body.customerEmail` instead of `body.args`. After that, **one shared flow** handles both (validation → draft order → email → return `invoiceUrl`).

So:

- Retell: same contract, same validation, same logic.
- Tinadmin: new path only for **source detection** and **input normalization**; everything else is shared.

---

## Where to make changes

In your **Railway project** (e.g. `shopify-mcp-retell-integration`), in the handler for:

`/functions/shopify_send_draft_invoice`

(or whatever route receives the Retell custom function calls and Tinadmin webhook calls).

You only change the **entry** of that handler: detect source → normalize input → then run your existing draft-order + email logic.

---

## Step 1: Detect source

Run this **first**, before any Retell signature check or body parsing.

```ts
// Example: Node/Express or similar
const sourceApp = req.headers["x-source-app"] ?? req.headers["X-Source-App"];
const isTinadmin = sourceApp === "tinadmin-telnyx-campaign";

const hasRetellShape =
  typeof req.body?.name === "string" &&
  req.body.name === "shopify_send_draft_invoice" &&
  req.body?.args != null;
const isRetell = !isTinadmin && hasRetellShape;

// Optional: reject unknown sources
if (!isTinadmin && !isRetell) {
  return res.status(400).json({ error: "Unknown source: missing x-source-app or Retell body shape" });
}
```

- **Tinadmin:** `X-Source-App: tinadmin-telnyx-campaign` → set `isTinadmin = true`. Do **not** require or verify `X-Retell-Signature`.
- **Retell:** No Tinadmin header, but body has `name === "shopify_send_draft_invoice"` and `args` → set `isRetell = true`. Keep your existing `X-Retell-Signature` verification for these.

So: **only Retell path runs signature verification**; Tinadmin path skips it. No change to how Retell is currently handled.

---

## Step 2: Verify Retell signature only for Retell

Keep your current Retell verification, but run it **only** when `isRetell` is true.

```ts
if (isRetell) {
  const signature = req.headers["x-retell-signature"] ?? req.headers["X-Retell-Signature"];
  if (!signature) {
    return res.status(401).json({ error: "Missing X-Retell-Signature" });
  }
  const isValid = Retell.verify(
    JSON.stringify(req.body),
    process.env.RETELL_API_KEY,
    signature
  );
  if (!isValid) {
    return res.status(401).json({ error: "Invalid X-Retell-Signature" });
  }
}
// If isTinadmin, we do NOT verify any signature.
```

This is the only place Retell is “special”; Tinadmin is not subject to this check.

---

## Step 3: Normalize input into one shape

From either source, build a single internal object (e.g. `normalized`) that the rest of your code uses. That way the rest of the handler does not care whether the request came from Retell or Tinadmin.

```ts
const body = req.body ?? {};

let lineItems: Array<{ variantId: string; quantity: number }>;
let customerEmail: string | undefined;

if (isTinadmin) {
  lineItems = body.lineItems ?? body.line_items ?? body.items ?? [];
  customerEmail =
    body.customerEmail ?? body.customer_email ?? body.email;
} else {
  // Retell
  const args = body.args ?? {};
  lineItems = args.lineItems ?? args.line_items ?? args.items ?? [];
  customerEmail = args.customerEmail ?? args.customer_email ?? args.email;
}

// Ensure array and shape
lineItems = Array.isArray(lineItems)
  ? lineItems
    .filter((i) => i && typeof i.variantId === "string" && typeof i.quantity === "number")
    .map((i) => ({ variantId: String(i.variantId), quantity: Number(i.quantity) || 1 }))
  : [];
```

Use `lineItems` and `customerEmail` everywhere below (validation, draft order, email). No more `body.args` or Retell-specific fields in the rest of the code.

---

## Step 4: Use one internal flow

After normalization, **do not branch again** by source:

- Validate `lineItems` (and optionally `customerEmail`) the same way for both.
- Create the draft order the same way.
- Send the email the same way.
- Return the same response: `res.status(200).json({ invoiceUrl: "..." })` (or `invoice_url` if you prefer; our app accepts both).

So: **one validation + one draft-order + one email flow** for both Retell and Tinadmin. Only the **way you read** `lineItems` and `customerEmail` from the request differs (Step 3).

---

## Step 5: Add temporary logging

Log once at the start of the handler (after reading body and detecting source). This does not change behavior; it only helps debug.

```ts
const requestId = req.headers["x-request-id"] ?? `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

console.info("[shopify_send_draft_invoice]", {
  requestId,
  source: isTinadmin ? "tinadmin" : isRetell ? "retell" : "unknown",
  headers: {
    "content-type": req.headers["content-type"],
    "x-source-app": req.headers["x-source-app"] ?? req.headers["X-Source-App"],
    "x-retell-signature": (req.headers["x-retell-signature"] ?? req.headers["X-Retell-Signature"])
      ? "present"
      : "missing",
  },
  bodyKeys: Object.keys(body),
  normalizedLineItemsCount: lineItems.length,
  hasCustomerEmail: Boolean(customerEmail),
});
```

After validation:

```ts
if (lineItems.length === 0) {
  console.warn("[shopify_send_draft_invoice] validation_error", { requestId, error: "no line items" });
  return res.status(400).json({ error: "lineItems required" });
}
```

After draft order / email (on success or failure):

```ts
// On success
console.info("[shopify_send_draft_invoice] success", {
  requestId,
  response_status: 200,
  invoiceUrl: invoiceUrl ? "present" : "missing",
});

// On downstream error (e.g. Shopify API)
console.error("[shopify_send_draft_invoice] downstream_error", {
  requestId,
  error: err.message,
  response_status: 500,
});
```

You can remove or reduce these logs once things are stable.

---

## Full flow (summary)

1. **Detect source** (Step 1) → `isTinadmin` or `isRetell`.
2. **Auth:** If `isRetell`, verify `X-Retell-Signature`; if `isTinadmin`, skip (Step 2).
3. **Normalize** (Step 3) → single `lineItems` and `customerEmail` for both.
4. **Log** (Step 5) once with requestId, source, headers, body keys, normalized counts.
5. **Validate** (e.g. `lineItems.length`, Shopify variant IDs) → log validation errors.
6. **One flow:** create draft order, send email, then `res.status(200).json({ invoiceUrl })` (or `invoice_url`).
7. On any error, log and return an appropriate status/body.

---

## Checklist

- [ ] In the handler for `shopify_send_draft_invoice`, add source detection (Step 1).
- [ ] Run Retell signature verification only when `isRetell` (Step 2).
- [ ] Normalize `lineItems` and `customerEmail` from either `body` (Tinadmin) or `body.args` (Retell) (Step 3).
- [ ] Use one validation + draft order + email flow for both (Step 4).
- [ ] Add temporary logging (Step 5); remove or reduce later.
- [ ] Deploy and test with both a Retell call and a Tinadmin campaign (create-draft-order) call.

After this, the same Railway custom function works for both Retell and this app, and the existing Retell custom function behavior is unchanged.
