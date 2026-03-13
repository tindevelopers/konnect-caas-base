# How the search_products query is sent to the product search API

This doc explains how the search phrase (e.g. "cordless dog clipper") gets from the Telnyx AI assistant to the upstream product search service and back.

## Important: which API is called?

The **search_products** webhook does **not** call an Abacus API in this codebase. It calls the **product search upstream** configured by:

- **`PRODUCT_SEARCH_URL`** (env) — default: `https://productsearch.mypetjet.com/api/chat`

If your product catalog or chat is powered by Abacus, that service would need to be exposed at a URL you set as `PRODUCT_SEARCH_URL`. The route is agnostic: it sends the same request shape to whatever URL is configured.

---

## End-to-end flow

```
[Telnyx AI Assistant]  -->  POST /api/webhooks/.../search-products  -->  [Your app]
                                                                              |
                                                                              v
[Upstream product API]  <--  POST PRODUCT_SEARCH_URL (body: { message, conversationHistory })  <--  [Your app]
```

1. **Telnyx** invokes the webhook tool `search_products` (POST to your app).
2. **Your app** gets the **query** (see below), then calls the **upstream** product search API.
3. **Upstream** returns products (and optional text); your app normalizes and returns that to Telnyx.

---

## 1. Where the query comes from (your app)

The route gets the search phrase in one of two ways.

### A. From the webhook request body (preferred)

When Telnyx sends the tool arguments in the POST body, the route reads the query from (first non-empty wins):

- Top-level: `query`, `message`, `search`, `product_query`, `productQuery`, `text`, `input`
- Nested: `body.arguments.query`, `body.arguments.message`, …
- Telnyx-style: `body.data.payload.arguments.query`, etc.

So if Telnyx sends:

```json
{ "query": "cordless dog clipper" }
```

or:

```json
{ "arguments": { "query": "cordless dog clipper" } }
```

the route uses that as `query`.

### B. Fallback when body is empty (e.g. `content-length: 0`)

Your Vercel logs show many requests with **`'content-length': '0'`** — Telnyx sometimes calls the webhook with an empty body. In that case:

1. The route reads **`x-telnyx-call-control-id`** from the request headers.
2. It looks up **conversation_id** for that call in `ai_agent_events` (from `call.conversation.created` / `call.conversation.ended`).
3. It calls **Telnyx API**:  
   `GET https://api.telnyx.com/v2/ai/conversations/{conversationId}/messages?sort=desc&page[size]=50`  
   (with `TELNYX_API_KEY`).
4. It finds the most recent **tool_calls** for `search_products` in those messages and parses the **arguments** JSON to get `query`.

So even when the webhook body is empty, the query can still be recovered from the conversation (e.g. "cordless dog clipper", "cordless dog clipper small dogs professional"). That’s why you still see successful "Results" logs with real queries.

---

## 2. How the query is sent to the upstream API (fetch)

Once the app has `query`, it calls the **product search URL** like this:

**URL:** `PRODUCT_SEARCH_URL` (default `https://productsearch.mypetjet.com/api/chat`)

**Method:** `POST`

**Headers:** `Content-Type: application/json`

**Body (JSON):**

```json
{
  "message": "<the extracted query, e.g. 'cordless dog clipper'>",
  "conversationHistory": []
}
```

So the search phrase is sent in the **`message`** field; **`conversationHistory`** is always an empty array in this flow.

Code reference (search-products route):

```ts
const searchRes = await fetch(PRODUCT_SEARCH_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    message: query,
    conversationHistory: [],
  }),
  signal: controller.signal,
});
```

There is a **12 second** timeout; if the upstream is slow, the route returns a timeout message.

---

## 3. What the upstream returns and what the app does

The route expects the upstream response to be JSON with at least:

- **`products`** — array of product objects (each may have `name`, `title`, `variantId`, `variant_id`, `price`, `url`, etc.)
- Optionally **`message`** or **`response`** — text used when there are no products (e.g. clarification questions)

The app:

- Normalizes each product (e.g. `variantId` or `variant_id` → `variantId`).
- Takes up to 10 products.
- Builds a **content** string for the assistant (product list + instruction to use `variantId` with `add_to_selection`).
- Returns to Telnyx: `{ content, products }` with status 200.

---

## 4. Summary table

| Step | Actor | Action |
|------|--------|--------|
| 1 | Telnyx | POST to your `/api/webhooks/.../search-products` (body may be empty). |
| 2 | Your app | Get `query` from body or from Telnyx conversation messages (using `x-telnyx-call-control-id`). |
| 3 | Your app | `fetch(PRODUCT_SEARCH_URL, { method: "POST", body: JSON.stringify({ message: query, conversationHistory: [] }) })`. |
| 4 | Upstream (e.g. productsearch.mypetjet.com) | Returns `{ products: [...], message? }`. |
| 5 | Your app | Normalize products, build `content`, return `{ content, products }` to Telnyx. |

So: the **query is sent to the product search API** (whatever is behind `PRODUCT_SEARCH_URL`) as the **`message`** field in a POST body, with an empty **`conversationHistory`**. There is no separate “Abacus API” call in this route unless you set `PRODUCT_SEARCH_URL` to an Abacus endpoint.
