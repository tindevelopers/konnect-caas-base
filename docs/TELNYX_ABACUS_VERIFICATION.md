# Telnyx → Proxy → Abacus: Verification Checklist

**Goal:** Prove the message flow is:

**Telnyx Widget → Telnyx event/webhook → your proxy → Abacus Prediction API → your proxy → Telnyx send message → widget renders**

…and **not:** Telnyx Widget → Telnyx internal LLM → widget renders.

---

## White-label / public API (same backend)

The **white-label** endpoint `POST /api/public/agents/answer` (see **AI → Assistants → Embed & API** in the app) uses the **same** backend path as the Telnyx proxy:

- Request: `{ "publicKey": "<agent public key>", "message": "..." }`.
- The server calls `getAgentAnswer` → `routeAgentChat` → the configured provider (e.g. **Abacus**).
- So **yes**, you can reach the Abacus AI chat system through this proxy from any frontend (custom UI, mobile app, etc.). No Telnyx widget required; the agent’s `publicKey` identifies the platform agent, which is wired to Abacus when the agent’s provider is `abacus`.

---

## Step 0a — Widget and assistant config (required for chat to reach proxy)

For widget **text chat** to reach your proxy (and thus Abacus), two things must be true:

1. **Widget** exposes the text chat channel. The embed uses `channels="voice,web_chat"` (or the Telnyx widget default includes web_chat). The in-app Test Chat modal sets this automatically.

2. **Telnyx assistant** has (a) a **webhook tool** whose URL is your proxy (`.../api/webhooks/telnyx/assistant-proxy?publicKey=...`) and (b) **web_chat** in `enabled_features`.

**Easiest:** In the assistant’s **Website Embed & Unified Answer Preview** section, click **“Sync webhook + enable text chat to Telnyx”**. That updates the Telnyx assistant via API with the correct webhook tool and `enabled_features` including `web_chat`. Then use Test Chat; messages should hit your proxy.

If you prefer to configure in Telnyx Mission Control: add a webhook tool with the proxy URL and ensure the assistant has the Web Chat channel enabled.

---

## Step 0 — Observability (prove the chain in logs)

In **Vercel** (or your server logs), grep for:

| Log line | Meaning |
|----------|--------|
| `[TelnyxAssistantProxy] TELNYX_INBOUND` | Telnyx delivered a message event to your webhook. |
| `[TelnyxAssistantProxy] GET_AGENT_ANSWER_START` | Proxy is calling the platform (which will invoke Abacus if agent is abacus). |
| `[TelnyxAssistantProxy] GET_AGENT_ANSWER_OK provider=abacus` | Abacus returned; response is from our backend. |
| `[TelnyxAssistantProxy] RESPONSE_TO_TELNYX` | Proxy is returning the body to Telnyx. |
| `[TelnyxAssistantProxy] GET_AGENT_ANSWER_FAIL` | Proxy or Abacus call failed (e.g. bad key, network). |

For every user message you should see: **TELNYX_INBOUND → GET_AGENT_ANSWER_START → GET_AGENT_ANSWER_OK provider=abacus → RESPONSE_TO_TELNYX**.

---

## Step 1 — Widget bound to the correct assistant

In Telnyx **Widget** tab, confirm the embed uses the correct assistant, e.g.:

- `agent-id="assistant-52bbbd69-427e-4906-bb8c-d3c3e5867c7e"` (or your “Telnyx new agent” ID).

If the widget points at a different assistant, you may be testing the wrong one.

---

## Step 2 — Fingerprint test (Abacus-only response prefix)

Set an env var only in **staging / preview** so that every Abacus reply is prefixed with a string Telnyx cannot know:

- **Vercel:** Project → Settings → Environment Variables → add:
  - Name: `ABACUS_RESPONSE_PREFIX`
  - Value: `ABACUS_OK_91:`
  - Environment: Preview (or the one you use for testing)

Redeploy, then in the widget **Test Chat** send:

- *“Say your system signature.”*

**If Abacus is generating:** The reply should start with `ABACUS_OK_91:`.

**If it doesn’t:** Replies are likely from Telnyx native inference, or the webhook is not being used.

Remove `ABACUS_RESPONSE_PREFIX` after verification.

---

## Step 3 — Break Abacus on purpose (definitive test)

Temporarily set the Abacus API key to an **invalid** value **only in staging/test**:

- In Vercel: change `ABACUS_API_KEY` to e.g. `invalid_key_for_test`.

Send a message in Test Chat.

- **If responses still appear normal** → Not using Abacus (e.g. Telnyx native LLM).
- **If you get an error / fallback** (e.g. “Sorry — the assistant is temporarily unavailable”) and logs show `GET_AGENT_ANSWER_FAIL` → Proxy **is** calling Abacus; the failure is expected.

Restore the real `ABACUS_API_KEY` after the test.

---

## Step 4 — Telnyx is calling your webhook proxy

Ensure the assistant has the proxy webhook tool and web_chat enabled (see **Step 0a**; use “Sync webhook + enable text chat to Telnyx” or configure in Telnyx Mission Control).

Then send a message in the widget and check **server logs** within a few seconds:

- You should see `[TelnyxAssistantProxy] TELNYX_INBOUND`.

If the webhook never receives anything, Telnyx is not routing messages through your proxy.

---

## Step 5 — Proxy calls Abacus

In proxy logs (see Step 0), confirm:

- After `GET_AGENT_ANSWER_START`, you see `GET_AGENT_ANSWER_OK provider=abacus` and a non-zero `contentLen`.

That proves the proxy called the platform, the platform used the Abacus provider, and Abacus returned a response.

---

## Step 6 — Response returns through Telnyx (not direct UI)

The proxy returns the assistant text in the **webhook response body** (e.g. `content`, `result`, `data.content`). Telnyx uses that to populate the conversation. There is no separate “send message” API call from the app; Telnyx sends the user message to your webhook and uses your JSON response as the assistant reply.

So the chain is: **Telnyx → your proxy (GET_AGENT_ANSWER_*) → Abacus → proxy → same HTTP response → Telnyx → widget**.

---

## Quick 1‑minute checklist

| Check | Action |
|-------|--------|
| Widget uses correct agent-id | Step 1 |
| Webhook proxy receives Telnyx events | Step 4 + grep `TELNYX_INBOUND` |
| Proxy calls Abacus | Step 5 + grep `GET_AGENT_ANSWER_OK provider=abacus` |
| Abacus returns response | Step 5 (contentLen > 0) |
| Response is in webhook body to Telnyx | Step 6 (design) |
| Widget shows reply | Manual test |
| Optional: fingerprint | Step 2 (`ABACUS_RESPONSE_PREFIX`) |
| Optional: hard proof | Step 3 (invalid key in staging) |

---

## Smoke test (proxy only)

To hit the proxy directly (bypasses Telnyx widget):

```bash
BASE_URL=https://your-preview-url.vercel.app pnpm exec tsx scripts/smoke-test-telnyx-abacus-agent.ts
# or
pnpm exec tsx scripts/smoke-test-telnyx-abacus-agent.ts https://your-preview-url.vercel.app
```

Success: response has `provider: "abacus"` and non-empty `content`. That confirms proxy → platform → Abacus; full E2E still requires Step 4 (Telnyx actually calling the webhook).

---

## "[Insert Link]" placeholder in chat

If the assistant reply contains the literal text `[Insert Link]` instead of a clickable URL, the **answer pipeline** (used by both the Telnyx proxy and the white-label API) does the following:

- **Replacement:** The first occurrence of `[Insert Link]` (case-insensitive) is replaced with a markdown link when a URL is available:
  - from **citations** (e.g. RAG provider), or
  - from the **same message** (first `https://...` URL found in the reply).
- So if the model returns something like *"Here's the product page: https://example.com/product. [Insert Link]"*, the user will see a clickable link where the placeholder was.
- If the model never outputs the URL and there are no citations, the placeholder remains. Fix that by updating the Abacus knowledge base or system prompt so the model returns the full URL in the message (or use a provider that returns citations with URLs).

---

## Widget vs direct API: links in the Telnyx widget

If the **direct** Public Answer API or assistant-proxy (curl/script) returns the correct answer with a product link, but the **Telnyx widget** shows "[Insert Link]" or no link:

1. **Same agent for widget and direct**
   - The proxy resolves the agent by **assistant_id** when the request comes from the widget (no `?publicKey=` in the webhook URL), and by **publicKey** when you call the API directly.
   - For the widget to get the same Abacus answer with links, the platform agent whose **external_ref** equals the Telnyx assistant id (the one bound to the widget) must be the **Abacus** agent. In **AI → Agent Manager**, the agent linked to that Telnyx assistant should have provider **Abacus** (and that agent’s `external_ref` = the widget’s assistant id). If the linked agent has provider Telnyx, the proxy will use Telnyx first and you may get a different or failed response.

2. **Widget not rendering markdown links**
   - The proxy appends raw URLs whenever the response contains any `https://` URL: it adds a line `Product link(s): https://...` so the link is visible in the chat even if the widget does not render markdown.

3. **Assistant returns product names but no URLs (“still no links”)**
   - If the chat shows only product **names** (e.g. “Andis Cordless Clipper Model A/B/C”) with no clickable or plain URLs, the **Abacus model is not returning any `https://` links** in that reply. The proxy can only show or append links that exist in the response.
   - **Fix:** In your **Abacus** deployment (knowledge base and/or system prompt):
     - Add the real product URLs (e.g. from Shopify: `https://petstoredirectdev.myshopify.com/products/...`) into the knowledge base or as examples in the system prompt.
     - In the system prompt, instruct the model to **always include the full product URL** when recommending or listing products (e.g. “When you recommend a product, output the full URL like https://petstoredirectdev.myshopify.com/products/... so the user can click it.”).
   - Once the model’s reply includes at least one `https://` URL, the proxy will append “Product link(s): …” and the link will appear in the Telnyx chat.
