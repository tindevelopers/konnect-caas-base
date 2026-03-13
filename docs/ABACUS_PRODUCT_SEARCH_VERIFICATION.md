# Abacus vs. product search pipeline — verification

**Question:** Is Abacus actually part of the product search pipeline, or are we only calling productsearch.mypetjet.com (which may or may not use Abacus internally)?

**Short answer:** In **this repo**, the product search pipeline **does not call any Abacus API**. It only calls `PRODUCT_SEARCH_URL` (default: `https://productsearch.mypetjet.com/api/chat`). We **cannot** determine from this codebase whether productsearch.mypetjet.com uses Abacus internally; that would require inspecting that external service or its documentation.

---

## 1. Where `PRODUCT_SEARCH_URL` is defined

| Location | Finding |
|----------|---------|
| **Code (default)** | `apps/tenant/app/api/webhooks/telnyx/campaign-purchase/search-products/route.ts` line 7–8: `process.env.PRODUCT_SEARCH_URL \|\| "https://productsearch.mypetjet.com/api/chat"` |
| **.env.example** | Not present. |
| **.env.production.example** | Not present. |
| **Other .env in repo** | No `.env` or `.env.local` is committed; no grep match for `PRODUCT_SEARCH` in env files. |
| **Vercel** | Not in repo. If set, it would be in Vercel project → Settings → Environment Variables. |

**Conclusion:** The **only** definition in the repo is the default in the route. Any override would come from environment (e.g. Vercel env or local `.env.local`), not from committed files.

---

## 2. What service is behind `https://productsearch.mypetjet.com/api/chat`

- **In this repo:** There is no code that implements or configures the **internals** of productsearch.mypetjet.com. The app only **calls** that URL.
- **Who runs it:** The hostname `productsearch.mypetjet.com` suggests a Pet Jet / MyPetJet product-search service; it is **external** to this codebase.
- **Whether it uses Abacus:** Cannot be determined from this repo. You would need to:
  - Inspect that service’s code or docs, or
  - Ask the team that operates productsearch.mypetjet.com, or
  - Use network/integration docs from the service owner.

So: we know we call **productsearch.mypetjet.com**; we do **not** know from this repo if that service uses Abacus behind the scenes.

---

## 3. Does this repo call Abacus from the search_products flow?

**No.** The search-products route:

- Reads `query` (from body or conversation fallback).
- Calls `fetch(PRODUCT_SEARCH_URL, { method: "POST", body: JSON.stringify({ message: query, conversationHistory: [] }) })`.
- Returns normalized products to Telnyx.

There is **no** import of `AbacusAgentProvider`, no `getChatResponse`, no `routellm.abacus.ai`, no `apps.abacus.ai` in that route or in any code path triggered by it. So **in this repository**, the product search pipeline does **not** directly call Abacus.

---

## 4. Repo-wide search: Abacus, getChatResponse, routellm, apps.abacus

| Term | Where it appears | Used in product search? |
|------|------------------|--------------------------|
| **abacus** | Integrations catalog, agent-manager UI, assistant-proxy, answer-service, AbacusAgentProvider, docs, test scripts, TELNYX_ABACUS_VERIFICATION.md | **No** — used for **chat/escalation** (proxy, L2 agent), not for search_products. |
| **AbacusAgentProvider** | `apps/tenant/src/core/agents/providers/abacus.ts`; registered in `providers/index.ts` | **No** — used by `getAgentAnswer` / assistant-proxy for **chat**; never referenced by search-products route. |
| **getChatResponse** | Abacus provider (apps.abacus.ai), integrations catalog placeholder, Cursor skill | **No** — chat path only. |
| **routellm.abacus.ai** | `apps/tenant/src/core/agents/providers/abacus.ts` (RouteLLM base URL) | **No** — Abacus **chat** provider only. |
| **apps.abacus.ai** | `apps/tenant/src/core/agents/providers/abacus.ts` (`ABACUS_DEPLOYMENT_ENDPOINT`), chatbot-embed page (widget SDK) | **No** — chat/deployment and embed only. |

So: **Abacus is used elsewhere in the repo (chat, proxy, L2, widget), but not in the product search pipeline.**

---

## 5. Is Abacus used in the product search pipeline?

| Possibility | Verdict |
|-------------|--------|
| **Directly in this repo** | **No.** The search_products route does not call Abacus; it only calls `PRODUCT_SEARCH_URL`. |
| **Indirectly behind productsearch.mypetjet.com** | **Unknown from this repo.** The app does not know or control what that host does internally. |
| **Not used at all** | **No.** Abacus **is** used in this repo for **other** flows (chat, escalation, widget). |

So: **Abacus is not part of the product search pipeline in this codebase.** Whether it is part of the pipeline “in the world” depends entirely on whether productsearch.mypetjet.com (or whatever URL is in `PRODUCT_SEARCH_URL`) is implemented using Abacus — and that cannot be verified from this repo alone.

---

## 6. Architecture: product search vs. Abacus chat

### Product search pipeline (search_products webhook)

```
┌─────────────────────┐     POST /api/webhooks/.../search-products      ┌─────────────────────┐
│  Telnyx AI          │  ───────────────────────────────────────────►  │  This app           │
│  assistant          │  (body: query or empty; x-telnyx-call-control-id) │  (Next.js route)    │
└─────────────────────┘                                                 └──────────┬──────────┘
                                                                                    │
                                                                                    │  fetch(PRODUCT_SEARCH_URL)
                                                                                    │  body: { message: query, conversationHistory: [] }
                                                                                    ▼
                                                                         ┌─────────────────────┐
                                                                         │  Upstream service   │
                                                                         │  (default:          │
                                                                         │   productsearch.    │
                                                                         │   mypetjet.com/     │
                                                                         │   api/chat)         │
                                                                         └──────────┬──────────┘
                                                                                    │
                                                                                    │  JSON: { products?, message? }
                                                                                    ▼
                                                                         ┌─────────────────────┐
                                                                         │  This app           │
                                                                         │  normalizes products│
                                                                         │  returns to Telnyx  │
                                                                         └─────────────────────┘
```

**No Abacus in this diagram.** The route does not call routellm.abacus.ai or apps.abacus.ai.

### Where Abacus is used in this repo (for comparison)

```
┌─────────────────────┐     POST /api/webhooks/telnyx/assistant-proxy    ┌─────────────────────┐
│  Telnyx (widget /   │  ───────────────────────────────────────────►  │  This app           │
│  voice)             │  (message, conversationId, etc.)                 │  assistant-proxy    │
└─────────────────────┘                                                 └──────────┬──────────┘
                                                                                    │
                                                                                    │  getAgentAnswer → routeAgentChat(agent)
                                                                                    │  agent.provider === "abacus"
                                                                                    ▼
                                                                         ┌─────────────────────┐
                                                                         │  AbacusAgentProvider │
                                                                         │  (this repo)         │
                                                                         └──────────┬──────────┘
                                                                                    │
                    ┌──────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┐
                    │                                                               │                                                                  │
                    ▼                                                               ▼                                                                  ▼
         ┌─────────────────────┐       ┌─────────────────────┐       ┌─────────────────────┐
         │  apps.abacus.ai      │       │  routellm.abacus.ai  │       │  (deployment token   │
         │  /api/getChatResponse│       │  /v1/chat/completions│       │   + deployment id)   │
         └─────────────────────┘       └─────────────────────┘       └─────────────────────┘
```

So: **Abacus is used for chat/assistant-proxy only, not for search_products.**

---

## 7. Where Abacus is used in this repo (non–product-search)

| Area | How Abacus is used |
|------|---------------------|
| **Assistant proxy** | When the platform agent has `provider: "abacus"`, `getAgentAnswer` uses `AbacusAgentProvider` and calls either `https://apps.abacus.ai/api/getChatResponse` (deployment) or `https://routellm.abacus.ai/v1/...` (RouteLLM). |
| **Widget / tiered chat** | L2 agent or “proxy brain delegate” can be an Abacus agent; chat and escalation go through the same proxy → Abacus path. |
| **Chatbot embed** | `AbacusChatbotEmbed` and `/ai/chatbot-embed` use Abacus widget SDK and `https://apps.abacus.ai/chatllm/...`. |
| **Integrations** | System Admin → Integrations lists “Abacus.AI” (ChatLLM, Super Assistants, Predictions API). |
| **Agent registry** | Agents can have `provider: "abacus"` and use Abacus for chat. |

None of these paths are invoked by the **search_products** webhook.

---

## 8. Note on test script naming

`scripts/test-abacus-variant-pipeline.ts` uses:

```ts
const ABACUS_CHAT_URL = "https://productsearch.mypetjet.com/api/chat";
```

and comments say “Abacus /api/chat” and “Abacus chatbot API”. So **in that script** the same URL as the default `PRODUCT_SEARCH_URL` is **labeled** as “Abacus”. That is only a naming/convention choice in the test; it does **not** prove that productsearch.mypetjet.com is implemented with Abacus. To know that, you’d need to check the implementation or docs of productsearch.mypetjet.com.

---

## 9. Summary

| Question | Answer |
|----------|--------|
| Is Abacus **directly** used in the product search pipeline (in this repo)? | **No.** The search_products route only calls `PRODUCT_SEARCH_URL`. |
| Is productsearch.mypetjet.com **backed by** Abacus? | **Unknown from this repo.** Would need to be confirmed by the owner of that service. |
| Is Abacus used **anywhere** in this repo? | **Yes.** Chat, assistant-proxy, L2 escalation, widget, and embed use Abacus; product search does not. |

**Bottom line:** In this codebase, the product search pipeline is **only** calling the URL in `PRODUCT_SEARCH_URL` (default: productsearch.mypetjet.com). Abacus is **not** part of that pipeline here. Whether Abacus is used **inside** productsearch.mypetjet.com cannot be verified from this repo.
