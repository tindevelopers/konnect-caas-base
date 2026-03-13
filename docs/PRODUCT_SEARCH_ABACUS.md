# Product search via Abacus Predictions API

The **search_products** Telnyx webhook calls the Abacus Predictions API (`https://apps.abacus.ai/api/getChatResponse`) when `ABACUS_DEPLOYMENT_TOKEN` and `ABACUS_DEPLOYMENT_ID` are set.

## Is it safe to do?

**Yes, with one important requirement.**

- **Same credentials as chat:** The route uses the same env vars (`ABACUS_DEPLOYMENT_TOKEN`, `ABACUS_DEPLOYMENT_ID`) that the Abacus agent provider uses for chat. You can use the same deployment for both, or a dedicated product-search deployment with its own token/id.
- **No breaking change for Telnyx:** The webhook still returns the same shape: `{ content, products }`. The Telnyx assistant and the rest of the purchase flow (add_to_selection, create_draft_order) are unchanged.
- **Graceful fallback:** If the env vars are missing, the route returns HTTP 200 with a friendly message and empty `products` (no 5xx). If the Abacus API fails or times out, the route also returns 200 with "I'm having trouble searching the catalog right now." and empty `products`.

**Requirement for full flow:**

- **variantId for add_to_selection:** The downstream steps (add_to_selection, create_draft_order) need valid Shopify variant GIDs. So your Abacus deployment’s response must include a **products** array whose items have at least **variantId** (or **variant_id**). The route looks for `products` at the top level or under `data.products` or `result.products`, and normalizes each item with `normalizeProduct()` (supports `name`/`title`, `variantId`/`variant_id`, `price`, etc.). If the deployment returns only free-form text and no structured `products`, then search will work for reading answers but **add_to_selection** will not have variantIds to use. Configure the Abacus deployment (e.g. tool/function output or structured response) so it returns a `products` array with `variantId`/`variant_id` for each product.

## Environment variables

Set in your deployment (e.g. Vercel) or in `apps/tenant/.env.local`:

- **ABACUS_DEPLOYMENT_TOKEN** — from your Abacus deployment (getChatResponse).
- **ABACUS_DEPLOYMENT_ID** — deployment ID for that API.

See `.env.example` for the section "Abacus Predictions API (product search)".

## Request / response

- **Request:** `POST https://apps.abacus.ai/api/getChatResponse?deploymentToken=...&deploymentId=...` with body `{ "messages": [{ "is_user": true, "text": "<query>" }] }`.
- **Response handling:** The route takes human-readable text from `content`, `response`, `message`, or `choices[0].message.content`, and builds the `products` array from `products`, `data.products`, or `result.products`, then normalizes each item for the Telnyx tool response.

## Compatibility

- Query extraction, conversation fallback (when Telnyx sends an empty body), logging, and GET/OPTIONS are unchanged.
- The returned payload still has `content` (string) and `products` (array of `{ name, variantId, price, ... }`) so the existing purchase flow remains compatible.
