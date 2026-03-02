# Telnyx “Proxy Brain” (Tiered Escalation) Setup

Goal: keep using the **official Telnyx widget** (`<telnyx-ai-agent ...>`) while routing every user message through **this platform’s backend**:

- **Tiered mode (L1 → L2):**
  - **Level 1 (L1) = Telnyx only.** The first reply and simple queries are answered by the Telnyx assistant.
  - **Level 2 (L2) = Abacus (or your strategic agent).** When a message is escalated, the **answer content comes from the L2 agent** (e.g. Abacus), not from Telnyx. Telnyx is only used for L1; after escalation, the user sees the L2 agent’s reply (and the “Connecting to Strategic Assistant…” banner).
- **Transport-only mode:** Telnyx is **transport only** (chat/voice + delivery); **all** message processing is delegated to one agent (e.g. Abacus) via backend API.

This works by configuring a dedicated Telnyx assistant (the *proxy assistant*) to call a webhook tool hosted by this app on every turn.

## 1) Create a Telnyx proxy assistant

In Telnyx Mission Control (AI → Assistants):

- Create a new assistant (example name: `Proxy Brain - Customer Support`).
- In **Tools**, add a webhook tool:
  - **type**: `webhook`
  - **name**: `platform_answer`
  - **method**: `POST`
  - **url**: `https://<your-domain>/api/webhooks/telnyx/assistant-proxy?publicKey=<PLATFORM_AGENT_PUBLIC_KEY>`
  - **parameters** (JSON Schema): Add a `message` or `query` parameter of type `string` so the assistant passes the user's message. Example:
    ```json
    { "message": { "type": "string", "description": "The user's message" } }
    ```

Notes:
- The `publicKey` must be the **platform agent public key** for the entry agent that has `routing.tieredChat = true`.
- Putting the `publicKey` in the URL avoids ambiguous mappings and works across environments.

### Recommended proxy assistant instructions

Make the proxy assistant always call the tool and use its output as the final reply (example):

> You are a proxy assistant. For every user message, call the `platform_answer` tool and return exactly the `content` from the tool result to the user. Do not add extra text. If the tool returns an error, apologize briefly and ask the user to retry.

## 2) Configure the platform (tiered vs transport-only)

In this app’s **Agent Manager** → open the **entry agent** (the one referenced by `publicKey` in the webhook URL):

### Option A: Transport-only (Telnyx = transport, Abacus = brain)

- Enable **Tiered chat** (so the proxy path is used).
- Set **Proxy brain delegate** to your **Abacus** platform agent.
- Every message from the Telnyx proxy is sent to that agent; no L1 Telnyx call, no intent detection. Telnyx is responsible only for transport and response delivery.

### Option B: Tiered (L1 → L2 escalation)

- Set `routing.tieredChat = true`
- Set `routing.level2AgentId` → **Abacus agent instance** (strategic escalation)
- Leave **Proxy brain delegate** empty.

Important:
- **L1 = Telnyx** (first response only). **L2 = Abacus** (or whichever agent you set as Level 2). When escalation runs, the **reply text is from the L2 agent**, not from Telnyx.
- In tiered proxy-brain mode, L1 is the same Telnyx assistant from `assistant_id`; complex intents escalate to L2, and the user gets the L2 agent’s answer (e.g. Abacus).
- `routing.level1AgentId` / `routing.level3AgentId` are ignored in the 2-level flow.

## 3) Deploy + set webhook signing (recommended)

The proxy endpoint is:

- `POST /api/webhooks/telnyx/assistant-proxy`

For production, configure Telnyx webhook signing in your env:

- `TELNYX_PUBLIC_KEY` (ED25519 verification)

## 4) Testing (prompt ladder)

### Use Test Chat (not Chat Preview) with Customer Support Specialist

To see escalation in the **Test Chat** modal (the one that shows “Assistant: assistant-c0b92fc3...”) instead of Chat Preview, the **Telnyx assistant** must call your app on every message. Do this in **Telnyx Mission Control** (portal.telnyx.com):

1. **Get the Customer support agent’s public key**  
   In this app: **Agent Manager** → open **Customer support** → copy the `public_key` from the agent row or from the widget snippet (e.g. `agent_fa5b70bdbeb34dbfa68c794534590c98`).

2. **Open the same assistant in Telnyx**  
   Go to **Telnyx Mission Control** → **AI** → **Assistants** → find the assistant whose ID is `assistant-c0b92fc3-a4fd-4633-b37a-fd3b8a60b2c7` (the one linked to Customer support).

3. **Add a webhook tool to that assistant**  
   In that assistant’s **Tools**:
   - Add a tool: **type** = `webhook`, **name** = e.g. `platform_answer`, **method** = `POST`
   - **URL**:  
     `https://<your-app-domain>/api/webhooks/telnyx/assistant-proxy?publicKey=<CUSTOMER_SUPPORT_PUBLIC_KEY>`  
     Replace `<your-app-domain>` with your app URL (e.g. `yourapp.vercel.app`; for local dev use an ngrok URL like `https://abc123.ngrok.io`).  
     Replace `<CUSTOMER_SUPPORT_PUBLIC_KEY>` with the public key from step 1.
   - **Parameters** (JSON Schema): e.g. `{ "message": { "type": "string", "description": "The user message" } }`.

4. **Set the assistant’s instructions**  
   So it calls the webhook for every user message and returns the tool’s `content` as the reply, e.g.:  
   *“You are a proxy assistant. For every user message, call the platform_answer tool and return exactly the content from the tool result. Do not add extra text.”*

5. **Turn on Widget**  
   In Telnyx: **Edit** that assistant → ensure **Widget** (or the channel you use for Test Chat) is enabled.

6. **Test in the app**  
   In this app: **AI Assistants** → open the **Customer Support Specialist** assistant → click **Test Chat** → **Start Chat**.  
   Send e.g. “I want to buy a clipper” or “Compare plans and implementation roadmap.” You should see the “Connecting to Strategic Assistant…” escalation message, then the **reply from your L2 agent (Abacus)**, not from Telnyx. Telnyx is only used for Level 1.

**Requirements:** The webhook URL must be reachable from the internet (use **ngrok** for local: `ngrok http 3020`, then use the `https://...ngrok.io` URL in the webhook).

### Testing from the deployed app (no ngrok)

You can test directly from the deployed app (e.g. Vercel) by pointing the Telnyx webhook URL to your production domain:

- **URL**: `https://<your-production-domain>/api/webhooks/telnyx/assistant-proxy?publicKey=<CUSTOMER_SUPPORT_PUBLIC_KEY>`

When something goes wrong (e.g. "I'm sorry, something went wrong"), check **Vercel Logs**:

1. Open **Vercel Dashboard** → your project → **Logs**
2. Filter by the proxy route or search for `[TelnyxAssistantProxy:DEBUG]`
3. Each request logs steps: `start` → `extractMessage` → `entryResolved` → `beforeGetAgentAnswer` → `afterGetAgentAnswer` → `success`, or `catch` with `errMsg` on error

This lets you debug without running ngrok locally.

### Option A: Test Chat (in-app) — after webhook is set

1. Go to **AI Assistants** → open your **proxy assistant** (the one with the webhook) → click **Test Chat**.
2. Click **Start Chat**, then send the prompts below.

**Requirements:** Widget enabled in Telnyx Portal (AI → Assistants → Edit → Widget). Webhook URL must be publicly reachable (use `ngrok http 3020` for local dev).

### Option B: Script

```bash
cd apps/tenant && node scripts/test-escalation.mjs
```

### Prompts (using the official Telnyx widget or Test Chat)

- Simple (should stay L1): “What are your business hours?”
- Complex (should escalate to L2): “I run a 50-agent call center. Compare your plans, propose the best option, and outline an implementation roadmap with risks.”

If the response includes “Connecting to Strategic Assistant…”, that banner came from the tiered router; the **answer text after the banner is from the L2 agent (Abacus)**, not from Telnyx. Telnyx is only used for L1 replies.

## Alternative: Abacus-only entry (no tiered flow)

To have **Telnyx as transport only** without using the tiered entry agent:

1. Create a **platform agent** with `provider: "abacus"` (your Abacus chatbot).
2. Do **not** enable tiered chat for that agent.
3. Use that agent’s **public key** in the proxy webhook URL:  
   `https://<your-domain>/api/webhooks/telnyx/assistant-proxy?publicKey=<ABACUS_AGENT_PUBLIC_KEY>`

Then every proxy request is handled by `getAgentAnswer` → `routeAgentChat(entryAgent)` → Abacus provider. Telnyx only delivers the message and the response.

## Conversation ID (L2 persistence)

After escalation to L2, the backend stores `tiered_escalated_to_agent_id` on the **conversation** so that follow-up messages stay on L2. For this to work:

- **Answer API** and **Chat API** both return `conversationId` in the response.
- **Clients must send the same `conversationId`** on every follow-up message in that thread. If they omit it or use a new one, the next turn will start from L1 again.

The widget and embed preview already persist and send `conversationId`; if you integrate via API, include `conversationId` in the request body when continuing a thread.

## Entry points (Answer and Chat)

Tiered escalation runs for:

- **Answer:** `POST /api/public/agents/answer`, `POST /api/agents/[agentId]/answer`, and the Telnyx proxy webhook (which calls `getAgentAnswer` internally).
- **Chat:** `POST /api/agents/[agentId]/chat` and `POST /api/public/agents/chat` now also use the same tiered flow and return `conversationId` and `tieredEscalationBanner` so escalation works from any entry point.

## Pre-ship checklist

- `TELNYX_PUBLIC_KEY` is configured in production and webhook signature validation is enforced.
- For `assistant_id` lookup, `tenant_ai_assistants` is populated for tenant isolation (or strict mapping mode enabled via `TELNYX_PROXY_STRICT_ASSISTANT_TENANT_CHECK=true`).
- For tiered mode: `routing.level2AgentId` is set to your Abacus strategic assistant.
- For transport-only: either set **Proxy brain delegate** to your Abacus agent on the entry agent, or use an Abacus-only entry agent (see above).
- Proxy webhook tool URL uses `?publicKey=<PLATFORM_AGENT_PUBLIC_KEY>` for deterministic entry-agent routing.
- Clients send the same `conversationId` on follow-up messages so the user stays on L2 after escalation.

