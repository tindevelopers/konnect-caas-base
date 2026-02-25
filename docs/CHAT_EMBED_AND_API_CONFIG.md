# Chat interface: Embed vs API configuration

This document extends the three-tier agent plan with **configuration to support both embeddable chat (Webflow, WordPress) and API access for larger systems**.

## Goal

- **Embed (e.g. Webflow, WordPress):** Provide a chat interface that can be embedded on external sites via script tag (or iframe). One-line drop-in for small sites.
- **API (bigger systems):** Provide API access so enterprises (e.g. airline, call center) can integrate chat (and handoff) into their own apps, CRMs, or UIs instead of using the prebuilt widget.

Configuration should allow a tenant (or per-agent) to choose which interface(s) are enabled and how they behave.

---

## Current state

- **Embed:** [GET /api/public/agents/widget?publicKey=...](apps/tenant/app/api/public/agents/widget/route.ts) returns a script that loads the chat widget. Agent Manager shows the snippet: `<script src=".../widget?publicKey=..."></script>`.
- **API:** [POST /api/public/agents/chat](apps/tenant/app/api/public/agents/chat/route.ts) accepts `publicKey` or `tenantId + listingExternalId` and returns the agent chat response. No API key required today; rate limit is per-IP.

---

## Proposed configuration

### 1. Where to store

- **Option A (recommended):** Per-tenant setting (e.g. `tenant_settings` or tenant `metadata` / integration config): `chatInterface: 'embed' | 'api' | 'both'`. Applies to all agents of that tenant unless overridden.
- **Option B:** Per-agent in `agent_instances.routing` or `metadata`: e.g. `routing.chatInterface: 'embed' | 'api' | 'both'`. Allows one agent to be embed-only and another API-only.
- **Option C:** Both: tenant default + optional per-agent override.

### 2. Fields

- **chatInterface** — `'embed' | 'api' | 'both'`
  - **embed:** Widget script and embed snippet are available; public chat API may be restricted to same-origin or allowed referrers only (to avoid abuse from non-embed contexts).
  - **api:** Public chat API is enabled for programmatic access; optionally require API key (see below). Embed snippet can be hidden or disabled in UI for this tenant/agent.
  - **both:** Default for flexibility; embed and API both allowed.

- **apiKeyRequired** (optional, tenant or global) — When `true`, `POST /api/public/agents/chat` (and any future public agent endpoints) require an `Authorization: Bearer <api_key>` or `X-API-Key: <api_key>`. API keys are issued per tenant (or per agent) and stored securely; used for bigger systems that need authenticated API access.

- **allowedEmbedOrigins** (optional) — For embed mode: list of allowed origins (e.g. `https://mybnb.com`, `https://*.webflow.io`) so the widget script or chat API can validate `Referer`/CORS and reject requests from unknown sites. Reduces abuse.

### 3. Behavior

| Scenario        | chatInterface | Behavior |
|----------------|---------------|----------|
| Webflow / WordPress (small) | `embed` or `both` | Tenant gets embed snippet; drops script on site. Widget works. Optionally restrict public chat to requests with allowed referrer. |
| Airline / large (own UI) | `api` or `both`   | Tenant gets API docs, issues API key(s). Their app calls `POST .../chat` (and handoff endpoints) with API key. No embed needed. |
| Both           | `both`            | Embed and API enabled; optional API key and/or allowed origins for security. |

### 4. Implementation notes

- **Widget route:** Keep [GET /api/public/agents/widget](apps/tenant/app/api/public/agents/widget/route.ts) as-is. If `chatInterface === 'api'` only, the agent manager (or embed-install UI) can hide the embed snippet or show a message "API-only; use the API for integration."
- **Public chat route:** In [POST /api/public/agents/chat](apps/tenant/app/api/public/agents/chat/route.ts), resolve tenant/agent and check `chatInterface`. If `embed` only, optionally require a valid `Referer` in allowed list. If `apiKeyRequired`, require valid API key and allow requests without embed referrer.
- **API keys:** If added, create a table (e.g. `tenant_api_keys` or `agent_api_keys`) with hashed key, tenant_id, optional agent_id, name, last_used_at; issue keys via tenant dashboard; validate in public chat (and handoff) routes.
- **CORS:** For API-only callers (browser or server), set CORS headers on public chat (and widget if needed) so that allowed origins can call from their domains. For server-to-server, no CORS needed.

### 5. UI

- **Tenant or Agent settings:** Add a section "Chat interface" with:
  - Radio or select: "Embed only" / "API only" / "Both".
  - If "Embed": optional "Allowed domains" (for referrer check).
  - If "API": optional "Require API key for public chat"; link to "Manage API keys" (create/revoke keys).
- **Agent Manager:** When showing embed snippet, respect `chatInterface` (hide or show). When "API only" or "Both", show "API endpoint" and link to docs (e.g. POST /api/public/agents/chat, body, headers).

### 6. Docs

- Document public endpoints: `GET .../widget`, `POST .../chat`, and (when implemented) handoff/help. For API mode, document request/response, API key header, and rate limits.
- Add a short "Embedding chat (Webflow, WordPress)" and "Integrating via API" to [CHAT_AI_AGENTS.md](docs/CHAT_AI_AGENTS.md) or a dedicated developer doc.

---

## Summary

- Add **chatInterface** (`embed` | `api` | `both`) at tenant level (and optionally per-agent) so that:
  - **Embed:** Embeddable widget for Webflow/WordPress; optional allowed origins.
  - **API:** Programmatic access for bigger systems; optional API key requirement.
- Implement checks in widget and public chat routes; add API key storage and validation if "API key required" is enabled.
- Expose the setting and embed/API instructions in tenant and agent UI and docs.

This configuration supports both "drop-in embed" and "API for our own app" from a single plan.
