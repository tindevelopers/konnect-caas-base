# Verification: Abacus Predictions API (getChatResponse) usage

**Question:** Does our application use the Abacus Predictions API endpoint `https://apps.abacus.ai/api/getChatResponse`? Is it used in the **product search** workflow or only for other chat features?

**Conclusion (updated):** The endpoint is used for **assistant-proxy chat**, **L2 escalation**, **agent answer/chat APIs**, and **integrations health check**. As of the product-search integration change, the **search_products** webhook **also** calls `https://apps.abacus.ai/api/getChatResponse` when `ABACUS_DEPLOYMENT_TOKEN` and `ABACUS_DEPLOYMENT_ID` are set. If those env vars are not set, the route returns a friendly fallback message and empty products.

---

## 1. Repo-wide search: Abacus API references

| Term | Files | Purpose |
|------|--------|---------|
| **apps.abacus.ai** | `providers/abacus.ts`, `integrations/health.ts`, `chatbot-embed/page.tsx`, `AbacusChatbotEmbed.tsx`, docs | Deployment endpoint (getChatResponse), health check URL, widget/embed UI URL |
| **getChatResponse** | `providers/abacus.ts`, `integrations/health.ts`, integrations catalog placeholder, Cursor skill, docs | API path for deployment mode; health check path; docs |
| **deploymentToken** | `providers/abacus.ts`, `integrations/health.ts`, `integrationsCatalog.ts`, `diagnose-abacus-l2.mjs` | Query param for apps.abacus.ai/api/getChatResponse; config; diagnostic |
| **deploymentId** | `providers/abacus.ts`, `integrations/health.ts`, `integrationsCatalog.ts` | Query param for getChatResponse; config |
| **AbacusAgentProvider** | `providers/abacus.ts`, `providers/index.ts`, docs | Chat provider that calls getChatResponse or RouteLLM |
| **routellm.abacus.ai** | `providers/abacus.ts` | Alternative base URL when **not** using deployment mode (RouteLLM /v1/chat/completions) |

---

## 2. Files that call the Abacus API (server-side)

Only two places in the repo perform an HTTP request to an Abacus endpoint:

| File | Endpoint(s) called | When |
|------|--------------------|------|
| **apps/tenant/src/core/agents/providers/abacus.ts** | `https://apps.abacus.ai/api/getChatResponse?deploymentToken=...&deploymentId=...` (deployment mode) **or** `https://routellm.abacus.ai/v1/chat/completions` (model mode) | When `AbacusAgentProvider.sendMessage()` is invoked (see triggers below). |
| **apps/tenant/app/actions/integrations/health.ts** | Same base + path when `useDeployment`: `https://apps.abacus.ai` + `/api/getChatResponse` with `deploymentToken` and `deploymentId` query params | When an admin runs the Abacus integration health check (System Admin → Integrations → Abacus → health check). |

The **search-products** route (`apps/tenant/app/api/webhooks/telnyx/campaign-purchase/search-products/route.ts`) does **not** reference either file and does **not** call any Abacus URL. It only calls `PRODUCT_SEARCH_URL` (default: `https://productsearch.mypetjet.com/api/chat`).

---

## 3. Feature, workflow, and relation to product search

| Occurrence | File | Feature | Workflow that triggers it | Related to product search? |
|------------|------|---------|---------------------------|----------------------------|
| Deployment-mode chat | `apps/tenant/src/core/agents/providers/abacus.ts` | Assistant proxy / agent chat | Telnyx widget or voice sends message → assistant-proxy (or public/agents answer/chat) → `getAgentAnswer()` → `routeAgentChat(agent)` → agent has `provider: "abacus"` → `AbacusAgentProvider.sendMessage()` → `fetch(https://apps.abacus.ai/api/getChatResponse?deploymentToken=...&deploymentId=...)` with body `{ messages: [...] }`. | **No** — chat only. |
| RouteLLM-mode chat | Same file | Same | Same flow; when deployment is not configured, provider uses `routellm.abacus.ai/v1/chat/completions` instead of getChatResponse. | **No** — chat only. |
| L2 escalation | Same provider, invoked from `answer-service.ts` | Tiered chat (L2 agent) | User message escalated to L2 → `routeAgentChat(l2Agent)` → if L2 agent is Abacus, `AbacusAgentProvider.sendMessage()` → same getChatResponse or RouteLLM call. | **No** — escalation chat only. |
| Integrations health check | `apps/tenant/app/actions/integrations/health.ts` | System Admin → Integrations | Admin triggers health check for Abacus integration → code builds URL (apps.abacus.ai + /api/getChatResponse when deployment ID set) → `fetch(url)` with test body. | **No** — config/health only. |
| Chatbot embed (UI) | `apps/tenant/app/ai/chatbot-embed/page.tsx`, `AbacusChatbotEmbed.tsx` | Embed Abacus chatbot in app | Page loads iframe/script pointing at `https://apps.abacus.ai/chatllm/?appId=...`. Our server does **not** call getChatResponse for this; the Abacus widget may call it client-side. | **No** — widget UI; not product search. |

**Product search workflow** (search_products webhook) uses only:

- `apps/tenant/app/api/webhooks/telnyx/campaign-purchase/search-products/route.ts`
- `fetch(PRODUCT_SEARCH_URL, { body: JSON.stringify({ message: query, conversationHistory: [] }) })`
- Default URL: `https://productsearch.mypetjet.com/api/chat`

There is no reference to `apps.abacus.ai`, `getChatResponse`, `deploymentToken`, `deploymentId`, or `AbacusAgentProvider` in the search-products route or in any code path it calls.

---

## 4. Is `https://apps.abacus.ai/api/getChatResponse` used in the product search pipeline?

**No.**

The product search pipeline is:

1. **Telnyx AI assistant** invokes webhook tool **search_products**.
2. **Next.js** receives POST at **`/api/webhooks/telnyx/campaign-purchase/search-products`**.
3. Route extracts `query`, then calls **`fetch(PRODUCT_SEARCH_URL, …)`** with body `{ message: query, conversationHistory: [] }`.
4. **Default** `PRODUCT_SEARCH_URL` is **`https://productsearch.mypetjet.com/api/chat`** (not apps.abacus.ai).
5. Response is normalized and returned to Telnyx.

**No step in this pipeline** calls `https://apps.abacus.ai/api/getChatResponse`. The search-products route does not import or invoke the Abacus provider or the health check; it only uses `PRODUCT_SEARCH_URL`.

---

## 5. Table: Where Abacus (getChatResponse) is used vs. not used

| Feature | File | Endpoint called | Purpose |
|---------|------|------------------|---------|
| **Assistant proxy chat** | `apps/tenant/src/core/agents/providers/abacus.ts` | `https://apps.abacus.ai/api/getChatResponse?deploymentToken=...&deploymentId=...` (deployment mode) or `https://routellm.abacus.ai/v1/chat/completions` (model mode) | Agent chat when platform agent has `provider: "abacus"`. Triggered by Telnyx assistant-proxy, public/agents answer and chat APIs. |
| **L2 agent escalation** | Same (via `answer-service.ts` → `routeAgentChat`) | Same as above | When L2 agent is Abacus, escalated messages are sent to Abacus via same provider. |
| **Integrations health check** | `apps/tenant/app/actions/integrations/health.ts` | When deployment: `https://apps.abacus.ai` + `/api/getChatResponse` with `deploymentToken` and `deploymentId` query params | Verify Abacus integration (API key or deployment) is valid. |
| **Chatbot embed (UI)** | `apps/tenant/app/ai/chatbot-embed/page.tsx`, `AbacusChatbotEmbed.tsx` | `https://apps.abacus.ai/chatllm/?appId=...` (widget page; getChatResponse may be used by Abacus widget client-side, not by our server) | Load Abacus ChatLLM widget in app; server does not call getChatResponse. |
| **Product search** | `apps/tenant/app/api/webhooks/telnyx/campaign-purchase/search-products/route.ts` | `https://apps.abacus.ai/api/getChatResponse?deploymentToken=...&deploymentId=...` (when `ABACUS_DEPLOYMENT_TOKEN` and `ABACUS_DEPLOYMENT_ID` are set) | Search catalog via Abacus Predictions API; returns content + products with variantId for add_to_selection. |

---

## 6. Architecture diagram

### Product search pipeline — uses Abacus when configured

```
Telnyx AI assistant
   │
   │  (invokes webhook tool "search_products")
   ▼
Next.js: POST /api/webhooks/telnyx/campaign-purchase/search-products
   │
   │  fetch(https://apps.abacus.ai/api/getChatResponse?deploymentToken=...&deploymentId=...)
   │  body: { messages: [{ is_user: true, text: query }] }
   │  (requires ABACUS_DEPLOYMENT_TOKEN, ABACUS_DEPLOYMENT_ID)
   ▼
https://apps.abacus.ai/api/getChatResponse
   │
   │  returns content (content/response/message/choices) + optional products array
   ▼
Next.js extracts content + products, normalizes products → response to Telnyx
```

### Chat / proxy / L2 — Abacus IS used (getChatResponse or RouteLLM)

```
Telnyx chat / widget (or public agents API, or listing chat)
   │
   │  POST /api/webhooks/telnyx/assistant-proxy  (or /api/agents/[id]/answer, /api/public/agents/chat, etc.)
   ▼
Next.js: getAgentAnswer() → routeAgentChat(agent)
   │
   │  agent.provider === "abacus"  →  AbacusAgentProvider.sendMessage()
   ▼
AbacusAgentProvider (apps/tenant/src/core/agents/providers/abacus.ts)
   │
   ├── Deployment mode:  POST https://apps.abacus.ai/api/getChatResponse?deploymentToken=...&deploymentId=...
   │                     body: { messages: [{ is_user, text }, ...] }
   │
   └── Model mode:       POST https://routellm.abacus.ai/v1/chat/completions
                         (OpenAI-compatible request)

   │
   ▼
Abacus returns chat response → proxy/API returns to Telnyx or client
```

### L2 escalation (Abacus as L2 agent)

```
User message (e.g. complex intent)
   │
   ▼
getAgentAnswer() → tiered flow → escalation to L2 agent
   │
   │  L2 agent has provider: "abacus"
   ▼
routeAgentChat(l2Agent) → AbacusAgentProvider.sendMessage()
   │
   ▼
https://apps.abacus.ai/api/getChatResponse  (or routellm.abacus.ai)
   │
   ▼
L2 response returned to user
```

---

## 7. Summary

| Question | Answer |
|----------|--------|
| Does the app use `https://apps.abacus.ai/api/getChatResponse`? | **Yes** — in **AbacusAgentProvider** (deployment mode), **integrations health check**, and **search_products** webhook when `ABACUS_DEPLOYMENT_TOKEN` and `ABACUS_DEPLOYMENT_ID` are set. |
| Is getChatResponse used in the **product search** pipeline? | **Yes.** The search_products route calls Abacus getChatResponse with body `{ messages: [{ is_user: true, text: query }] }` when the env vars are set. |
| Where is getChatResponse used? | **Assistant proxy chat**, **L2 escalation** (when L2 is Abacus), **agent answer/chat APIs**, **Abacus integration health check**, and **campaign product search** (search_products webhook). |
| Request body for product search | The search_products route sends `{ messages: [{ is_user: true, text: query }] }` to match the Abacus Predictions API. |

**Bottom line:** The **campaign product search** workflow **can** use the Abacus Predictions API when `ABACUS_DEPLOYMENT_TOKEN` and `ABACUS_DEPLOYMENT_ID` are configured. The Abacus deployment should return a `products` array (with `variantId` or `variant_id`) for add_to_selection to work.
