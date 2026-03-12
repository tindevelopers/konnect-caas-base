# Telnyx add-to-selection empty payload — pipeline trace

This document traces the product selection pipeline to determine why the Telnyx AI assistant sometimes calls `add_to_selection` with an empty body (no `variantId`, no `quantity`).

**Observed logs:**
```
[CampaignPurchase:RAW_REQUEST_BODY] null
[CampaignPurchase:NORMALIZED_BODY] {}
[CampaignPurchase:ADD_SELECTION_PAYLOAD] {}
[CampaignPurchase:add-to-selection] Returning 400 invalid_product
```

---

## 1. Product / catalog retrieval (Shopify or catalog API)

### 1.1 In-repo product data sources

| Location | Purpose | Returns variantId? |
|----------|---------|--------------------|
| `apps/tenant/app/actions/stripe/products.ts` | Stripe billing products (subscriptions) | N/A — not product catalog for voice |
| `apps/tenant/src/core/agents/answer-service.ts` | `extractProductRecommendations()` | **No** — returns `[]`; comment: "In the future this will call a retrieval service against a product catalog." |
| Campaign `settings` | `enableProductPurchaseFlow`, `webhookUrl` only | No product list stored |
| `client_state` at call start (executor) | `t`, `a`, `tid`, `g`, `cg`, `pf`, `rw` | No product or variant data |

**Finding:** There is **no** campaign product catalog or Shopify product/variant API in this codebase that returns data to the AI assistant. Product discovery is not implemented here; it relies on whatever the assistant was given elsewhere (instructions or external systems).

### 1.2 Response schema to the AI assistant

- No app endpoint in this repo returns a "product search" or "catalog" response to the Telnyx assistant.
- If a catalog is provided to the assistant, it is via one of:
  - **Assistant instructions** (text in Telnyx assistant config), and/or
  - **Dynamic variables** (Telnyx `dynamic_variables_webhook_url` or static `dynamic_variables`), and/or
  - **Another Telnyx tool** (e.g. a "search_products" webhook) not defined in this repo.

For `add_to_selection` to receive a `variantId`, that value must appear in one of those sources with a field the model can use. The backend expects:

- `variantId` (or `variant_id`, `variant_gid`, `variantGid`, `shopifyVariantId`) — Shopify GID format: `gid://shopify/ProductVariant/<id>`
- `quantity` — number ≥ 1

---

## 2. Where variantId should come from

If the only thing the assistant ever sees is **product names** (e.g. "Andis Clipper") and not **variant GIDs**, it has no value to send for `variantId`. So:

- **If the catalog/instructions only include productId (or product name):** The variantId must be added to that catalog or to the instructions. For Shopify, each sellable option is a **variant**; the GID is `gid://shopify/ProductVariant/<variant_id>`. Either the catalog API or the instructions must expose this per variant.
- **If the catalog is external:** The response schema of that external API must include at least one of: `variantId`, `variant_id`, `variant_gid`, `shopifyVariantId`, or `productVariantId`, in GID or normalizable form (see `apps/tenant/src/core/campaigns/shopify-variant-id.ts`).

---

## 3. Assistant tool definitions (add-to-selection, create-draft-order)

### 3.1 Where tools are defined

- **Script (source of truth):** `apps/tenant/scripts/telnyx-ensure-campaign-purchase-tools.ts`
- **Routes (handlers):**
  - `apps/tenant/app/api/webhooks/telnyx/campaign-purchase/add-to-selection/route.ts`
  - `apps/tenant/app/api/webhooks/telnyx/campaign-purchase/create-draft-order/route.ts`

### 3.2 add_to_selection parameter schema (from script)

```ts
parameters: {
  type: "object",
  required: ["variantId", "quantity"],
  properties: {
    variantId: {
      type: "string",
      description: "Shopify Product Variant GID in format gid://shopify/ProductVariant/<id>",
    },
    quantity: { type: "integer", minimum: 1, description: "Quantity of product to add" },
    call_control_id: { type: "string", description: "Telnyx call control ID" },
  },
},
```

Description text: *"Use when customer selects a product. Send JSON like {\"variantId\":\"gid://shopify/ProductVariant/1234567890\",\"quantity\":1}. Required: variantId as Shopify ProductVariant GID and quantity >= 1. ..."*

So the **tool schema is correct** and explicitly expects:

- `variantId`: string (Shopify ProductVariant GID)
- `quantity`: integer ≥ 1

### 3.3 create_draft_order

- Required: `customerConfirmed` (boolean).
- Optional: `customerEmail`, `call_control_id`.
- No `variantId` in this tool; draft order is built from **already-persisted** `selectedProducts` (from add_to_selection).

---

## 4. Flow: product discovery → suggestion → selection → tool call

1. **Campaign executor** (`apps/tenant/app/actions/campaigns/executor.ts`)  
   - Dials out, sets `client_state` (assistant_id, tenant_id, greeting, pf, rw).  
   - **Does not** send any product list or variantIds.

2. **Call answered**  
   - `apps/tenant/app/api/webhooks/telnyx/call-events/route.ts` → `handleOutboundCallAnsweredAssistant()`.  
   - Fetches assistant from Telnyx (GET assistant), then POSTs `ai_assistant_start` with `assistant: { id, instructions }` and optional greeting.  
   - **No** product catalog or variant list is injected here; only the assistant’s stored **instructions** (and tools) are used.

3. **Luna (Telnyx AI) runs**  
   - Uses **instructions** and **tools** from Telnyx.  
   - If instructions (or dynamic variables) do not contain per-product **variantId** in a way the model can copy into the tool call, the model can still **decide** to call `add_to_selection` when the user says "I'll take that one" but have **no variantId to send** → empty or partial payload.

4. **Telnyx invokes add_to_selection**  
   - POST to `.../add-to-selection` with body.  
   - If the model didn’t have a variantId, body is `{}` or missing arguments → backend logs `RAW_REQUEST_BODY null`, `NORMALIZED_BODY {}`, then returns 400 `invalid_product`.

---

## 5. Does the AI assistant have access to variantId when it calls add_to_selection?

- **Only if** the assistant was given that data in:
  - **Instructions:** e.g. "Products: [Andis Clipper, variantId gid://shopify/ProductVariant/123, ...]", or
  - **Dynamic variables:** e.g. a variable that lists products with `variantId` for each, or
  - **Another tool:** e.g. a "search_products" or "get_catalog" tool that returns objects containing `variantId`.

This codebase does **not** inject product/variant data into instructions or dynamic variables at call start, and does not define a catalog tool. So unless the assistant was configured elsewhere (Telnyx UI or another service) with instructions/variables that include **variantId**, the assistant **does not** have access to variantId at the moment it decides to call add_to_selection.

---

## 6. Where variantId can be “lost”

- **If variantId exists only in an external catalog API** that the assistant calls via some other tool, but that API returns only `productId` or product name (no `variantId`), then the loss is in that **catalog API response schema** (A).
- **If variantId is in instructions/variables** but the model still sends an empty tool call, the loss is in **model behavior** (B) or **prompt clarity** (D): e.g. instructions don’t say "always include the exact variantId in the add_to_selection call."
- **If the tool schema were wrong**, we’d see a different failure; the schema in this repo is correct (C is not the cause of empty body).

---

## 7. Root cause classification

| Hypothesis | Description | Verdict |
|------------|-------------|--------|
| **A) Catalog API not returning variantId** | Whatever provides product data to the assistant (catalog API or dynamic variables) does not include variantId. | **Likely** if product list comes from an external API or static list that only has names/IDs. |
| **B) Assistant not storing variantId internally** | Model receives variantId but doesn’t pass it to the tool (e.g. doesn’t fill required parameters). | **Possible** — LLMs sometimes omit arguments; can be mitigated with clearer instructions. |
| **C) Tool schema mismatch** | add_to_selection expects different parameters than what Telnyx sends. | **No** — schema and backend both expect `variantId` + `quantity`. |
| **D) Prompt not instructing assistant to track variantId** | Instructions don’t say to use the exact variantId when calling add_to_selection. | **Likely** — instructions may only describe products by name and not tell the model to pass variantId and quantity. |

**Most plausible:** **A** and/or **D**: the assistant never receives a structured variantId (catalog/instructions don’t provide it), and/or the instructions don’t explicitly require passing that variantId (and quantity) into add_to_selection.

---

## 8. Safest fix so the assistant always has variantId and quantity

1. **Provide variantIds to the assistant (fix A)**  
   - **Option A1:** In the assistant’s **instructions**, list each product with its **variantId** and a short label, e.g.:  
     `Products you can add: Andis Clipper (variantId: gid://shopify/ProductVariant/123456), ...`  
   - **Option A2:** Use a **dynamic variables webhook** (or static dynamic variables) that returns a variable like `product_catalog` with an array of `{ productTitle, variantId, ... }`. Ensure instructions say: "When the customer selects a product, use the variantId from this list in the add_to_selection tool."  
   - **Option A3:** If you have a "product search" or "catalog" tool, ensure its **response schema** includes `variantId` (or `variant_id` / `variant_gid` / `shopifyVariantId`) for each item so the model can copy it into add_to_selection.

2. **Make instructions explicit about tool arguments (fix D)**  
   - Add to the assistant instructions wording like:  
     "When calling add_to_selection you MUST send the exact variantId (gid://shopify/ProductVariant/...) and quantity (integer >= 1). Never call add_to_selection without both variantId and quantity."  
   - This reduces (B) as well: the model is less likely to omit required params.

3. **Backend (already done)**  
   - The add-to-selection route already parses empty bodies safely and returns a clear 400 with diagnostic logs. No change needed for resilience.

4. **Verify tool deployment**  
   - Re-run `telnyx-ensure-campaign-purchase-tools.ts` for the campaign’s assistant so the tool description and required parameters are up to date on Telnyx.

**Summary:** Ensure the assistant **receives** variantIds (via instructions or catalog/dynamic variables) and is **instructed** to always pass variantId and quantity when calling add_to_selection. The backend and tool schema are aligned; the gap is upstream in what data and instructions the assistant has.
