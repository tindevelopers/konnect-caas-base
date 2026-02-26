# Integrating Your Abacus Chatbot (Tier 3)

Connect **your Abacus chatbot** (ChatLLM, Super Assistants, or **Predictions API** deployment) to the app’s **Abacus** tier. The app supports both the generic ChatLLM API and the **Predictions API** deployment format (`deployment_id` + `messages`).

---

## Two modes

| Mode | When used | Request shape |
|------|-----------|----------------|
| **Deployment (Predictions API)** | When **Deployment ID** is set in the Abacus integration | `deployment_id`, `deployment_token`, `messages: [{ is_user, text }]`, optional `system_message`, `temperature` |
| **Generic ChatLLM** | When Deployment ID is not set | `prompt`, `system_message`, `llm_name` |

---

## Using your Abacus Predictions API chatbot

From your **Predictions API** page (e.g. ASK PSD → Predictions → Predictions API, method `getChatResponse`) you have:

1. **Token** — use as API Key and/or Deployment Token  
2. **Deployment ID** (e.g. `dc20e56f8`) — from the generated request code  
3. **Messages format** — `[{ "is_user": true, "text": "..." }]`

### Configure in the app

1. **Integrations** (tenant or System Admin → Integrations) → **Abacus.AI**
2. Set:
   - **API Key** — your Abacus API key or the **Token** from the Predictions API page (e.g. `58386b4b84b84e3bbf6c1239b232d466`)
   - **API Base URL** — when **Deployment ID** is set, the app defaults to `https://apps.abacus.ai` (Predictions API). Leave blank to use that.
   - **Deployment ID** — e.g. `dc20e56f8` (from the Abacus Predictions API curl/request)
   - **Deployment Token (optional)** — if different from API Key, set it; otherwise the API Key is used as the deployment token
   - **API path (optional)** — when using a deployment, the app defaults to `/api/getChatResponse`. Override only if your Abacus page shows a different path.
3. Save.

Then create an agent in **Agent Manager** with **Provider = Abacus**. For the Predictions API the app calls:

- **URL:** `POST https://apps.abacus.ai/api/getChatResponse?deploymentToken=...&deploymentId=...`
- **Body:** `{ "messages": [{ "is_user": true, "text": "<user message>" }], "systemMessage": ..., "temperature": 0.0, ... }`
- No `Authorization` header (auth is via `deploymentToken` in the query).

---

## What the app does (reference)

- **Provider:** `apps/tenant/src/core/agents/providers/abacus.ts`
- **Endpoint:** With **Deployment ID** set: `POST https://apps.abacus.ai/api/getChatResponse?deploymentToken=...&deploymentId=...` (body: `messages` only). Without deployment: `POST https://api.abacus.ai/predict/getChatResponse` (body: `prompt`, `system_message`, `llm_name`).
- **Deployment mode (Deployment ID set):** body includes `deployment_id`, `deployment_token`, `messages`, and optional `system_message`, `llm_name`, `temperature`.
- **Generic mode (no Deployment ID):** body is `prompt`, `system_message`, `llm_name`.
- **Response:** reply text is read from `content`, `response`, or `message` in the JSON response.

Credentials and options are read from:

1. **Tenant integration** (Integrations) — API Key, Base URL, Deployment ID, Deployment Token  
2. **Platform integration** (System Admin → Integrations)  
3. **Env:** `ABACUS_API_KEY`, `ABACUS_API_URL`, `ABACUS_DEPLOYMENT_ID`, `ABACUS_DEPLOYMENT_TOKEN`, `ABACUS_LLM_NAME`

---

## Optional: per-agent system prompt

On the **platform agent** (Agent Manager), you can set a **model profile** with a **system prompt**. That is sent as `system_message` to Abacus. Leave it empty to rely only on your Abacus chatbot’s instructions.

---

## Quick checklist (Predictions API deployment)

| Item | Where to set | Example |
|------|----------------|--------|
| API Key | Integrations → Abacus.AI → API Key | (or Token from Predictions API page) |
| Base URL | Integrations → API Base URL | `https://api.abacus.ai` |
| Deployment ID | Integrations → Deployment ID | `dc20e56f8` |
| Deployment Token | Integrations → Deployment Token (optional) | Only if different from API Key |
| API path | Integrations → API path (optional) | Default for deployment is `/api/getChatResponse`. Override only if your Abacus curl shows a different path. |

### Predictions API (curl format)

When **Deployment ID** is set, the app matches the Abacus Predictions API curl: base URL **`https://apps.abacus.ai`**, path **`/api/getChatResponse`**, with **`deploymentToken`** and **`deploymentId`** as query parameters and **`messages`** (and optional fields) in the JSON body. You don’t need to set Base URL or path unless your Abacus page shows something different.

---

*See [CHAT_AI_AGENTS.md](./CHAT_AI_AGENTS.md) for training/configuration and [CHAT_SYSTEMS_GUIDE.md](./CHAT_SYSTEMS_GUIDE.md) for when to use Abacus vs Telnyx vs Enhanced.*
