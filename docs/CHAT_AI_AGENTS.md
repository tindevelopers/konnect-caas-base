# Chat AI Agents: Three Levels

This document describes the **three levels of chat AI agents** built into the platform and how developers can **train and configure** each. Getting agent training right is critical to product quality.

## Overview

| Level | Display name | Code / provider | Purpose |
|-------|---------------|------------------|---------|
| **1** | **Telnyx** | `telnyx` | Voice-first AI assistants via Telnyx (phone, WebRTC). Production telephony and webcall. |
| **2** | **Enhanced** | `advanced` | In-platform RAG chatbot with domain intelligence, knowledge bases, and optional MCP tools. |
| **3** | **Abacus** | `abacus` | Abacus.AI ChatLLM / Super Assistants. External LLM with configurable system prompt and models. |

Implementation lives in:

- **Types:** `apps/tenant/src/core/agents/types.ts` — `AgentProvider = "telnyx" | "advanced" | "abacus"`.
- **Drivers:** `apps/tenant/src/core/agents/providers/` — `telnyx.ts`, `advanced.ts`, `abacus.ts`.
- **Registry:** `apps/tenant/src/core/agents/providers/index.ts` — maps provider name to driver.

---

## 1. Telnyx

**What it is:** AI assistants powered by the Telnyx AI Assistants API. Used for **voice** (PSTN, WebRTC) and optionally chat. The platform stores an agent record whose `external_ref` is the Telnyx assistant ID.

### How to train and configure Telnyx agents

1. **Create the assistant in Telnyx**
   - **In-app:** AI → Assistants → Create (or use existing). The app can create assistants via `@tinadmin/telnyx-ai-platform` and Telnyx API (e.g. `createAssistant`, `updateAssistant`).
   - **Telnyx Mission Control:** [Telnyx Portal](https://portal.telnyx.com) → AI Assistants — create or edit assistants, set instructions, model, greeting, and voice/speech settings.

2. **Instructions and personality**
   - Set **instructions** (system prompt) when creating/updating the assistant. This defines behavior, tone, and constraints.
   - Use Telnyx template variables when needed (e.g. `{{telnyx_conversation_channel}}`, `{{telnyx_current_time}}`).
   - **Templates** in the app (e.g. Default, Customer Support, Appointment Scheduler) provide starting instructions; customize per use case.

3. **Knowledge**
   - Telnyx supports **knowledge bases** for assistants. Configure and attach them in Telnyx (Mission Control or API).
   - Ensure the platform agent’s `external_ref` is set to the Telnyx assistant ID so routing and telemetry match.

4. **Voice / speech**
   - Configure model, voice, and speech (STT/TTS) in the assistant in Telnyx or in the app’s assistant editor.
   - Connection ID and phone numbers are required for PSTN; Webcall uses WebRTC and does not require numbers.

**Key files:** `apps/tenant/app/actions/telnyx/assistants.ts`, `apps/tenant/app/ai/assistants/`, `packages/@tinadmin/telnyx-ai-platform/`. See [Assistant Testing Guide](apps/tenant/docs/ASSISTANT_TESTING_GUIDE.md) for testing (Webcall, Call Assistant, Test Call).

---

## 2. Enhanced (Advanced)

**What it is:** The in-platform **RAG chatbot** with domain intelligence. Provider code name is `advanced`. It uses the core chatbot domain (`processChatMessage`), vector search (pgvector), and optional MCP/tool hints.

### How to train and configure Enhanced agents

1. **Knowledge bases**
   - Create and manage **knowledge bases** in the chatbot domain (`chatbot_knowledge_bases`, `chatbot_documents`, `chatbot_document_chunks`, `chatbot_embeddings`).
   - **API:** `createKnowledgeBase`, `createDocument` from `@/core/chatbot` (or equivalent path in your app).
   - **Ingestion:** Add documents via `createDocument` (title, content, source, sourceType). Use `extractPlatformDocs` from `@/core/chatbot/data-sources/platform-docs-source` to ingest platform docs into a knowledge base.
   - **Agent linkage:** For agent-scoped knowledge, use the agent’s `knowledge_profile.knowledgeBaseId` and `agent_knowledge_sources`; sync via `syncAgentKnowledgeSource` in `apps/tenant/src/core/agents/knowledge.ts` when using URL/file sources.

2. **Domain intelligence**
   - The chatbot routes queries to **domain knowledge** (auth, billing, multi-tenancy, permissions, database, shared). Domain context is injected into the RAG flow.
   - Ensure relevant READMEs and docs are ingested (e.g. `packages/@tinadmin/core/src/*/README.md`, `docs/ARCHITECTURE.md`, `docs/MULTITENANT_ARCHITECTURE.md`) so answers stay accurate.

3. **System prompts and behavior**
   - System prompts and RAG behavior are defined in the **chatbot** domain: `packages/@tinadmin/core/src/chatbot/prompts.ts`, `rag-engine.ts`, `chat-service.ts`.
   - Tune prompts and retrieval (chunk size, top-k) in the RAG engine for your product’s tone and accuracy.

4. **Optional tools**
   - Enhanced provider can surface **tool hints** (e.g. scheduling, support ticket context) and **MCP servers** (`telnyx_mcp_servers`). Configure MCP and tool behavior in the provider and in the database so agents know when to suggest handoffs or tools.

**Key files:** `packages/@tinadmin/core/src/chatbot/` (README, chat-service, rag-engine, knowledge-base, vector-store, prompts), `apps/tenant/src/core/agents/providers/advanced.ts`, `apps/tenant/src/core/agents/knowledge.ts`. API routes: `POST /api/chatbot/chat`, knowledge-base routes under `/api/chatbot/knowledge-base`.

---

## 3. Abacus

**What it is:** Chat powered by **Abacus.AI ChatLLM** (REST). The platform sends the user message and an optional system prompt to Abacus; no in-platform RAG. Provider code name is `abacus`.

### How to train and configure Abacus agents

1. **Credentials**
   - Configure **Abacus** in Integrations (tenant or platform): API key, optional base URL. Stored in `integration_configs` (provider `abacus`) and used by `getAbacusCredentials` in the Abacus provider.

2. **System prompt**
   - The main “training” surface in-app is the **system prompt** on the agent’s **model profile**.
   - In code: `request.agent.model_profile?.systemPrompt` is sent as `system_message` to Abacus `getChatResponse`. Set this when creating/updating the agent (e.g. in the agent editor or API).
   - Default if unset: `"You are a helpful assistant."` — replace with role, rules, and product-specific instructions.

3. **Model**
   - LLM is controlled by Abacus (`llm_name`). Configured via integration settings (`llmName`) or env (`ABACUS_LLM_NAME`). Default is `OPENAI_GPT4O`. Change in Integrations or env for different models/cost/quality.

4. **Advanced training in Abacus**
   - For deeper control, use Abacus’s own features: **Super Assistants**, **Deep Agent**, or **deployments** (see [Abacus.AI docs](https://abacus.ai/help)). Those are configured in Abacus; the platform can call custom endpoints or deployment URLs if you extend the provider to use a different Abacus API path or body shape.

**Key files:** `apps/tenant/src/core/agents/providers/abacus.ts`, integration config for `abacus` in System Admin / Integrations. Skills: `.cursor/skills/abacus-chatllm-javascript/SKILL.md`, `.cursor/skills/abacus-super-assistants-javascript/SKILL.md`.

---

## Quick reference: where to train each level

| Level   | Primary training surface | Where to configure |
|--------|---------------------------|--------------------|
| Telnyx | Instructions, model, greeting, knowledge (in Telnyx) | Telnyx Mission Control; app AI → Assistants create/edit |
| Enhanced | Knowledge bases, documents, domain docs, RAG prompts | Chatbot API / knowledge-base routes; `@/core/chatbot`; prompts.ts; agent knowledge sync |
| Abacus | System prompt, model (llm_name) | Agent `model_profile.systemPrompt`; Integrations (Abacus) API key and `llmName` |

---

## Documentation and related docs

- **Chatbot domain (Enhanced):** [packages/@tinadmin/core/src/chatbot/README.md](../packages/@tinadmin/core/src/chatbot/README.md)
- **Telnyx assistant testing:** [apps/tenant/docs/ASSISTANT_TESTING_GUIDE.md](../apps/tenant/docs/ASSISTANT_TESTING_GUIDE.md)
- **Cursor skills (Telnyx/Abacus):** [.cursor/skills/README.md](../.cursor/skills/README.md)

Developers should use this guide to choose the right level for each product surface (voice vs. in-app chat vs. external LLM) and to train each agent type correctly.
