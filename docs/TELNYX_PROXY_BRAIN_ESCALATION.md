# Telnyx “Proxy Brain” (Tiered Escalation) Setup

Goal: keep using the **official Telnyx widget** (`<telnyx-ai-agent ...>`) while routing every user message through **this platform’s tiered router**:

- **L1**: Telnyx basic assistant
- **L2**: Enhanced/action assistant
- **L3**: Abacus strategic assistant

This works by configuring a dedicated Telnyx assistant (the *proxy assistant*) to call a webhook tool hosted by this app on every turn.

## 1) Create a Telnyx proxy assistant

In Telnyx Mission Control (AI → Assistants):

- Create a new assistant (example name: `Proxy Brain - Customer Support`).
- In **Tools**, add a webhook tool:
  - **type**: `webhook`
  - **name**: `platform_answer`
  - **method**: `POST`
  - **url**: `https://<your-domain>/api/webhooks/telnyx/assistant-proxy?publicKey=<PLATFORM_AGENT_PUBLIC_KEY>`

Notes:
- The `publicKey` must be the **platform agent public key** for the entry agent that has `routing.tieredChat = true`.
- Putting the `publicKey` in the URL avoids ambiguous mappings and works across environments.

### Recommended proxy assistant instructions

Make the proxy assistant always call the tool and use its output as the final reply (example):

> You are a proxy assistant. For every user message, call the `platform_answer` tool and return exactly the `content` from the tool result to the user. Do not add extra text. If the tool returns an error, apologize briefly and ask the user to retry.

## 2) Configure the platform tiered router (L1/L2/L3)

In this app’s Agent Manager / agent instance routing configuration for the **platform entry agent** (the one referenced by `publicKey` above):

- Set:
  - `routing.tieredChat = true`
  - `routing.level1AgentId` → **non-proxy Telnyx agent instance** (basic)
  - `routing.level2AgentId` → Enhanced agent instance (actions/booking)
  - `routing.level3AgentId` → **Abacus agent instance** (strategic)

Important:
- In proxy-brain mode, `routing.level1AgentId` is required to avoid recursion (the proxy assistant cannot be L1).

## 3) Deploy + set webhook signing (recommended)

The proxy endpoint is:

- `POST /api/webhooks/telnyx/assistant-proxy`

For production, configure Telnyx webhook signing in your env:

- `TELNYX_PUBLIC_KEY` (ED25519 verification)

## 4) Testing (prompt ladder)

Using the official Telnyx widget attached to the **proxy assistant**:

- Simple (should stay L1): “What are your business hours?”
- Intermediate (should escalate to L2): “Please book an appointment for tomorrow at 3pm.”
- Complex (should escalate to L3): “I run a 50-agent call center. Compare your plans, propose the best option, and outline an implementation roadmap with risks.”

If the response includes “Connecting to Action Assistant…” or “Connecting to Strategic Assistant…”, that banner came from the tiered router and was prepended by the proxy endpoint.

