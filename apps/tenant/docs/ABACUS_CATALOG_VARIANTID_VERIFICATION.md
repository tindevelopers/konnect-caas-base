# Abacus ↔ Telnyx Voice: Shopify catalog and variantId verification

This document verifies whether the Telnyx voice assistant receives Shopify product catalog data (including **variantId**) from the Abacus Answer API, and where **variantId** is missing when `add_to_selection` is called with an empty payload.

**Architecture (as stated):**
```
Customer → Telnyx Voice Assistant → Abacus Answer API → Shopify Catalog → Product Recommendation → Tool Call (add_to_selection)
```

**Observed:** `ADD_SELECTION_PAYLOAD {}`, `variantIdRaw: undefined` — assistant does not have variantId when calling add_to_selection.

---

## 1. Where the assistant Answer API is called — full request flow

### 1.1 Entry points

| Entry point | File | When used |
|-------------|------|-----------|
| **Public Answer API** | `apps/tenant/app/api/public/agents/answer/route.ts` | POST with `publicKey` + `message` (e.g. webchat, external clients). |
| **Telnyx assistant-proxy (voice)** | `apps/tenant/app/api/webhooks/telnyx/assistant-proxy/route.ts` | Telnyx assistant “proxy brain” **webhook tool**: Telnyx POSTs user utterance here; proxy returns text as tool result. |

For **voice**, the flow is:

1. User speaks → Telnyx runs the assistant.
2. If the assistant uses a **webhook tool** that points to the proxy → Telnyx POSTs to `assistant-proxy` with message content.
3. **assistant-proxy** extracts `message` from the payload, resolves the entry agent (by `assistant_id` or `publicKey`), then calls **`getAgentAnswer()`**.
4. **getAgentAnswer** (`apps/tenant/src/core/agents/answer-service.ts`) either:
   - routes to **routeAgentChat()** (single agent), or
   - in tiered/proxy mode uses a **delegate agent** (e.g. Abacus) and again goes through **routeAgentChat()**.
5. **routeAgentChat()** (`apps/tenant/src/core/agents/router.ts`) resolves the agent, gets the provider driver (e.g. `AbacusAgentProvider`), and calls **`provider.sendMessage()`**.
6. **AbacusAgentProvider.sendMessage()** (`apps/tenant/src/core/agents/providers/abacus.ts`) sends the request to Abacus and returns content + usage + raw.

So the “Answer API” used by the voice assistant in this architecture is:

- **assistant-proxy** → **getAgentAnswer()** → **routeAgentChat()** → **AbacusAgentProvider.sendMessage()**.

---

## 2. What is sent to the Abacus API

**File:** `apps/tenant/src/core/agents/providers/abacus.ts`  
**Method:** `AbacusAgentProvider.sendMessage()`

**Request:**

- **URL:** `${baseUrl}/chat/completions` (RouteLLM-style).
- **Body:**
  - `model` (from config, e.g. `gpt-4o`, `route-llm`).
  - `messages`: `[{ role: "system", content: systemPrompt }, { role: "user", content: request.message }]`.
- **systemPrompt:** from `request.agent.model_profile?.systemPrompt`; if `telnyx_proxy_brain` metadata is set, a short line is appended about including product URLs in the reply.

**Not included in the request:**

- No product retrieval.
- No catalog search.
- No retrieval context.
- No vector search.
- No Shopify catalog metadata.
- No explicit “product list” or “variant” parameters.

So the app **never asks Abacus for product/catalog data**; it only sends a single user message and a system prompt.

---

## 3. Abacus response schema and what the app uses

**File:** `apps/tenant/src/core/agents/providers/abacus.ts`

**Response handling:**

- **Parsed as:** `RouteLLMChatResponse` and/or `AbacusChatResponse`.
- **Used:**
  - **Content:** from `choices[0].message.content` or legacy `content` / `response` / `message`. This is the only part that is returned as `content` and eventually becomes the reply text.
  - **Raw:** the full JSON payload is stored in `raw` and returned in `AgentProviderResponse.raw`.
- **Not used:** no code in this repo reads from the Abacus payload for:
  - `product_title`
  - `product_id`
  - `variantId`
  - `variant_gid`
  - `shopifyVariantId`
  - `variant_title`
  - `price`
  - `availability`
  - or any product-recommendation array.

So even if Abacus **did** return a structured product list with variantId in its JSON, this codebase does **not** inspect or map that response. The only thing that flows back is the **text content**.

---

## 4. Product recommendations and variantId in the Answer response

**File:** `apps/tenant/src/core/agents/answer-service.ts`

**buildAnswerResponse():**

- Calls `extractProductRecommendations(request.message, chatResponse.message, chatResponse.usage?.metadata)`.
- **extractProductRecommendations()** (same file) is a **placeholder** and **always returns `[]`**. Comment: *"In the future this will call a retrieval service against a product catalog. For now it returns an empty array."*
- It does **not** read from the Abacus response (raw or metadata). So **product_recommendations** in the Answer response are always empty.

**Citations:**

- `extractCitations(chatResponse.usage?.metadata)` reads `metadata.citations`.
- In the router, `usage.metadata` is set from **input.metadata** (request), not from the **provider’s raw response**. So Abacus response payload is never passed into `usage.metadata`, and citations are not populated from Abacus here.

So:

- **Product recommendations:** never populated from Abacus (or any provider); always `[]`.
- **variantId:** never extracted from any provider response in this codebase.

---

## 5. Where variantId is dropped (catalog mapping)

| Step | Location | What happens to variantId / product data |
|------|----------|------------------------------------------|
| 1. Request to Abacus | `apps/tenant/src/core/agents/providers/abacus.ts` | Request has **no** product/catalog/retrieval parameters. Abacus is not asked for catalog or variantId. |
| 2. Abacus response | Same file | Only **content** (text) is used. Full response is in `raw` but **not** parsed for products/variantId. |
| 3. Router | `apps/tenant/src/core/agents/router.ts` | Builds `usage` from `providerResult.usage` and **input.metadata**. **Does not** put `providerResult.raw` (or any Abacus product data) into `usage.metadata`. So downstream never sees Abacus product/variant payload. |
| 4. Answer response | `apps/tenant/src/core/agents/answer-service.ts` | `extractProductRecommendations(..., chatResponse.usage?.metadata)` always returns `[]`. Even if we later put Abacus product data into `usage.metadata`, the type is `ProductRecommendation` (title, productRef, why, etc.) and does **not** include variantId; would need schema + extraction. |
| 5. Assistant-proxy → Telnyx | `apps/tenant/app/api/webhooks/telnyx/assistant-proxy/route.ts` | Returns to Telnyx only **content** (finalText = chat_markdown or voice_text). **Does not** return `product_recommendations` or any structured product/variant payload. So the Telnyx assistant **never** receives variantId from the proxy. |
| 6. add_to_selection tool | Separate webhook | When the assistant calls **add_to_selection**, it must supply **variantId** and **quantity** in the **tool arguments**. The only context the assistant has is: its **instructions** and the **text** from previous tool results (e.g. proxy response). So if variantId was never in instructions and never in the proxy response, the assistant has nothing to send → empty payload. |

**Exact locations where variantId is missing:**

1. **Abacus request** — no catalog/retrieval/variant request: `apps/tenant/src/core/agents/providers/abacus.ts` (request body has only `model` + `messages`).
2. **Abacus response** — not parsed for products/variantId: same file; only `content` is used.
3. **Provider raw not forwarded** — router does not pass `providerResult.raw` (or product data) into `usage.metadata`: `apps/tenant/src/core/agents/router.ts` (usage built from `providerResult.usage` + `input.metadata` only).
4. **Product recommendations** — always empty and not derived from provider: `apps/tenant/src/core/agents/answer-service.ts` (`extractProductRecommendations` returns `[]`).
5. **Proxy response to Telnyx** — only text returned, no structured catalog: `apps/tenant/app/api/webhooks/telnyx/assistant-proxy/route.ts` (response has `content` / `result` / `data.content` only).

---

## 6. Assistant instructions and catalog data

- **Instructions** are configured in Telnyx (or in the app’s assistant editor) and are **not** dynamically built from Abacus or from the Answer API in this codebase.
- The **assistant-proxy** does not inject product catalog or variantIds into instructions; it only returns a single text reply per tool call.
- So the assistant has access to **variantId** only if:
  - instructions (or Telnyx dynamic variables) explicitly list products with variantIds, or
  - some other tool (e.g. a “get_catalog” tool) returns structured data including variantId and the model is instructed to use it when calling add_to_selection.

Currently, the proxy does not expose catalog data to the model, so **assistant instructions do not receive catalog/variantId from the Abacus Answer API** in this flow.

---

## 7. Does the assistant have variantId before calling add_to_selection?

**No**, in the current implementation:

- The Abacus request does not ask for product/catalog.
- The Abacus response is not parsed for products or variantId.
- Product recommendations in the Answer response are always empty.
- The assistant-proxy returns only text to Telnyx.
- So the Telnyx assistant **never** receives structured product/variantId from the Answer API or the proxy. When it calls add_to_selection, it has no variantId to put in the arguments → empty or missing payload.

---

## 8. Abacus catalog and variantId (indexing / payload)

- This repo does **not** call any Abacus “catalog” or “retrieval” endpoint; it only uses a generic **chat/completions**-style endpoint with a user message and system prompt.
- So we **cannot** verify from this codebase whether “Abacus already contains the Shopify catalog” or whether “variantId is indexed in the vector database or response payload.” That would require:
  - Abacus API docs or dashboard (catalog/retrieval config, response schema).
  - Inspecting the actual Abacus response (e.g. logging `raw` in the Abacus provider) to see if it includes product/variantId.

If Abacus does return product/variantId in its chat or retrieval response, the **current app code still drops it** at steps 2–5 above.

---

## Root cause summary (A/B/C/D)

| Option | Verdict | Notes |
|--------|--------|--------|
| **A) Abacus catalog does not contain Shopify variantId** | **Unknown from code** | We don’t request catalog from Abacus; we’d need to check Abacus config/API. |
| **B) Abacus API response omits variantId** | **Unknown from code** | We don’t parse the response for products; would need to log/inspect Abacus payload. |
| **C) Response mapping removes variantId** | **Yes** | We never read or map product/variantId from the Abacus response; router doesn’t pass raw to answer layer; extractProductRecommendations returns []; proxy returns only text. |
| **D) Assistant instructions do not expose catalog data to the model** | **Yes** | Proxy returns only text; no structured catalog or variantId is sent to the assistant. Instructions are not augmented with catalog from Abacus in this flow. |

So the **verifiable** issues in this repo are **C** and **D**. A and B require checking Abacus itself.

---

## Recommended fix so the assistant always has variantId before add_to_selection

### Option 1: Abacus returns product/variantId and we pass it through (recommended if Abacus has catalog)

1. **Confirm Abacus response shape**  
   - Log the full Abacus response in `apps/tenant/src/core/agents/providers/abacus.ts` (e.g. `raw` or the full `payload`).  
   - Verify whether it includes product list / recommendations with `variantId` (or `variant_gid`, `shopifyVariantId`). If not, configure Abacus (catalog/retrieval) to include Shopify variantId in the response.

2. **Forward provider raw to the answer layer**  
   - In `router.ts`, merge provider raw (or a normalized product list) into `usage.metadata` (e.g. `metadata.provider_raw` or `metadata.product_recommendations`) so `buildAnswerResponse` can use it.  
   - Or extend `AgentProviderResponse` / `AgentChatResponse` with an optional `productRecommendations` (including variantId) and have the router pass it through.

3. **Extract product recommendations with variantId**  
   - In `answer-service.ts`, implement `extractProductRecommendations()` to read from the Abacus payload (e.g. from `usage.metadata.provider_raw` or from the new product field).  
   - Map to a structure that includes **variantId** (and optionally product_title, price, availability). Extend `ProductRecommendation` in `answer-types.ts` to include `variantId` if needed.

4. **Expose catalog in the proxy response to Telnyx**  
   - In `assistant-proxy/route.ts`, include the extracted product list (with variantId) in the JSON returned to Telnyx (e.g. `data.product_recommendations` or a dedicated field).  
   - Ensure the Telnyx tool schema / instructions tell the assistant to use this field when calling add_to_selection (e.g. “When the user selects a product, use the variantId from the last product_recommendations in the tool result.”).

5. **Instructions**  
   - In the Telnyx assistant instructions, state that when calling add_to_selection the assistant must send the **variantId** (and quantity) from the context (e.g. from the last proxy tool result’s product list).

### Option 2: Catalog in instructions or dynamic variables (no Abacus change)

- If Abacus is not the source of catalog: maintain a product list (with variantId per variant) in **assistant instructions** or in Telnyx **dynamic variables** (or a dynamic variables webhook that returns catalog with variantId).  
- Instructions: tell the assistant to use that list when the user selects a product and to always pass the exact variantId and quantity to add_to_selection.

### Option 3: Separate “get catalog” tool

- Add another Telnyx webhook tool (e.g. “get_product_catalog” or “search_products”) that calls your app (or Abacus), returns a list of products **including variantId**, and instruct the assistant to use that tool result when calling add_to_selection with the chosen variantId and quantity.

---

## Files to change (for Option 1)

| File | Change |
|------|--------|
| `apps/tenant/src/core/agents/providers/abacus.ts` | (Optional) Log full response; optionally parse and return a structured product list (with variantId) in the provider response. |
| `apps/tenant/src/core/agents/router.ts` | Pass provider raw or product list into usage.metadata (or into a new field on the chat response) so answer-service can use it. |
| `apps/tenant/src/core/agents/answer-service.ts` | Implement `extractProductRecommendations()` to read from provider response and include variantId; ensure buildAnswerResponse receives it. |
| `apps/tenant/src/core/agents/answer-types.ts` | Add `variantId` (and any needed fields) to `ProductRecommendation` if not present. |
| `apps/tenant/app/api/webhooks/telnyx/assistant-proxy/route.ts` | Include `product_recommendations` (with variantId) in the JSON returned to Telnyx so the assistant can use them when calling add_to_selection. |
| Telnyx assistant instructions | State that add_to_selection must be called with variantId and quantity from the provided catalog / last tool result. |

This gives the exact locations where variantId is missing and a concrete path so the assistant always receives variantId (and quantity) before calling add_to_selection.
