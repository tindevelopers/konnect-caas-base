# Chat Systems Guide: Three Types of Chat & Voice

This guide explains **how to use** the platform’s three chat systems, how they differ, and when to choose each. All three can power **web chat**; **voice chat** (phone/WebRTC) is supported as described below. Knowledge (instructions, documents, RAG) applies to both web and voice where the system supports it.

For **training, configuration, and implementation details**, see **[CHAT_AI_AGENTS.md](./CHAT_AI_AGENTS.md)**.

---

## The Three Systems at a Glance

| System | Display name | Best for | Web chat | Voice chat | Knowledge source |
|--------|--------------|----------|----------|------------|------------------|
| **1. Telnyx** | Telnyx | Voice-first, phone & WebRTC, simple assistants | Yes | Yes (PSTN + WebRTC) | Telnyx knowledge bases |
| **2. Enhanced** | Enhanced | In-app RAG, domain docs, MCP tools | Yes | Via separate Telnyx agent | Platform knowledge bases + RAG + MCP |
| **3. Abacus** | Abacus | Super-agentic, external LLM | Yes | Via Abacus/voice integration | System prompt + Abacus capabilities |

---

## Comparison: Features and Benefits

| Feature | Telnyx | Enhanced | Abacus |
|---------|--------|----------|--------|
| **Web chat** | Yes (Unified Answer API) | Yes (in-platform RAG) | Yes (ChatLLM / Super Assistants) |
| **Voice (phone / PSTN)** | Yes, native | Use a separate Telnyx agent for voice | Depends on Abacus/voice setup |
| **Voice (WebRTC / Webcall)** | Yes, native | Use a separate Telnyx agent for Webcall | Depends on integration |
| **Knowledge base** | Telnyx KB (in Telnyx) | Platform KB + vector search (RAG) | System prompt + Abacus features |
| **Domain intelligence** | No | Yes (auth, billing, multi-tenancy, etc.) | No (external LLM) |
| **MCP / tools** | No | Yes (scheduling, tickets, MCP servers) | Via Abacus Super Assistants / Deep Agent |
| **Handoff / escalation** | Via Telnyx or app logic | Yes (help vs handoff, target agents) | Via Abacus or app logic |
| **Where to configure** | Agent Manager + AI → Assistants (Telnyx) | Agent Manager + Chatbot knowledge bases + MCP | Agent Manager + Integrations (Abacus) |
| **Main benefit** | Single stack for voice + chat; production telephony | Rich in-app context, docs, and tools | Powerful external LLM and agentic workflows |

---

## 1. Telnyx-Only Chat (Tier 1 – Simple)

**What it is:** Voice-first AI assistants powered by the **Telnyx AI Assistants API**. Same assistant handles **phone calls**, **WebRTC (Webcall)**, and **web chat**. Knowledge comes from Telnyx knowledge bases only.

### How to use it

1. **Create the assistant**
   - Go to **AI → Assistants** and create an assistant (or use Telnyx Mission Control).
   - Set **instructions** (system prompt), **model**, **voice** (for voice channels), and attach a **knowledge base** in Telnyx if needed.

2. **Register a platform agent**
   - Go to **Agent Manager** and add an agent.
   - Set **Provider** to **Telnyx**.
   - Set **External ref** to the Telnyx assistant ID (e.g. `assistant-xxx`).

3. **Use in product**
   - **Web chat:** Use the **Chat Preview** on the assistant’s page, or embed/widget using the **Answer API** with the agent’s `public_key` (if set).
   - **Voice:** Assign the assistant to a **phone number** for inbound/outbound PSTN, or use **Webcall** (WebRTC) from the app. Same assistant, same knowledge.

### Voice vs web

- **Voice:** Fully supported (PSTN and WebRTC). Configure voice model and greeting in the assistant’s Voice tab.
- **Web chat:** Supported via the Unified Answer API; messages are sent to Telnyx and the same assistant responds. No in-platform RAG.

### Best for

- Single assistant for both voice and web.
- Simple flows with Telnyx-managed knowledge.
- Production telephony and Webcall without extra RAG or MCP.

---

## 2. Enhanced Chat (Tier 2 – Telnyx + In-Platform RAG and MCP)

**What it is:** **In-platform RAG chatbot** with domain intelligence (auth, billing, multi-tenancy, etc.), **knowledge bases** stored in the platform, and optional **MCP tools** (e.g. scheduling, support tickets). Provider code is `advanced`. Voice for this “agent” is typically handled by **linking to a separate Telnyx assistant** for phone/WebRTC if you want voice.

### How to use it

1. **Create a platform agent**
   - In **Agent Manager**, add an agent with **Provider** set to **Enhanced** (advanced).
   - Optionally set **External ref** to a Telnyx assistant ID if you want to use that same assistant for **voice** on a different channel (e.g. phone); for pure web RAG chat, external ref can be empty.

2. **Add knowledge**
   - Create **knowledge bases** and **documents** in the chatbot domain (APIs or **Chatbot → Knowledge base** in the app where available).
   - Ingest platform docs (READMEs, architecture) so answers use your product’s context.
   - Attach knowledge to the agent via **agent knowledge sources** / knowledge profile.

3. **Configure tools and handoff**
   - Enable **MCP servers** (e.g. in **AI → MCP Servers**) so the agent can suggest or use tools.
   - Set **routing** on the agent (e.g. `crossAgentMode`: help vs handoff, `handoffTargets`) for escalation.

4. **Use in product**
   - **Web chat:** Users talk to this agent via the Answer API or in-app chat; responses use **RAG** (retrieved docs) and **MCP/tool hints**.
   - **Voice:** To give this “agent” a voice, use a **Telnyx** assistant (separate or linked via external ref) for phone/WebRTC; the voice side uses Telnyx’s KB and instructions, while the web side uses platform RAG and MCP.

### Voice vs web

- **Web chat:** Full support with RAG, domain context, and MCP. This is the main surface for Enhanced.
- **Voice:** Not natively “Enhanced” in the RAG sense. Use a **Telnyx** assistant (same or different) for voice; knowledge can be mirrored in Telnyx KB if you want consistency.

### Best for

- Web chat that needs **in-app docs**, **domain knowledge**, and **tools** (scheduling, tickets, MCP).
- When voice is secondary or handled by a separate Telnyx-only flow.

---

## 3. Abacus Chat (Tier 3 – Super-Agentic Agents)

**What it is:** Chat powered by **Abacus.AI ChatLLM** or **Super Assistants**. The platform sends the user message and an optional **system prompt** to Abacus; there is **no in-platform RAG**. Training is via system prompt and Abacus-side configuration (e.g. Super Assistants, Deep Agent). Voice can be supported if Abacus or your integration exposes a voice channel.

### How to use it

1. **Configure Abacus**
   - In **Integrations**, add **Abacus** (API key, optional base URL and `llmName`). Use tenant or platform default.

2. **Create a platform agent**
   - In **Agent Manager**, add an agent with **Provider** set to **Abacus**.
   - Set the **model profile** (e.g. **system prompt**) in the agent editor; this is sent as `system_message` to Abacus.

3. **Use in product**
   - **Web chat:** Users interact via the Answer API or in-app chat; the platform calls Abacus ChatLLM (or your configured Abacus endpoint). Responses are from the external LLM and any Super Assistant/Deep Agent logic you configured in Abacus.
   - **Voice:** Depends on whether you use Abacus’s voice features or route voice through another system (e.g. Telnyx); the platform’s Abacus provider is primarily for **web chat** unless you extend it.

### Voice vs web

- **Web chat:** Full support. This is the primary use.
- **Voice:** Not built-in in the base integration; add voice via Abacus capabilities or a separate voice path (e.g. Telnyx).

### Best for

- **Super-agentic** or **external LLM** workflows.
- When you want Abacus’s models and Super Assistants/Deep Agent rather than in-platform RAG.

---

## Quick Reference: Where to Use What

| Goal | Recommended system | Notes |
|------|--------------------|--------|
| One assistant for **voice + web**, simple KB | **Telnyx** | Single Telnyx assistant; voice + web chat + Telnyx KB. |
| **Web chat** with your docs and tools (RAG + MCP) | **Enhanced** | Platform knowledge bases, domain intelligence, handoff. Voice via separate Telnyx agent if needed. |
| **Web chat** with external LLM / super-agentic | **Abacus** | System prompt + Abacus; voice via Abacus or separate. |
| **Voice-only** (phone or WebRTC) | **Telnyx** | Use a Telnyx assistant; optionally same as one used for web. |
| **Web + voice** with same “brain” | **Telnyx** (or Enhanced + linked Telnyx for voice) | Telnyx: one assistant. Enhanced: RAG for web, Telnyx assistant for voice. |

---

## Related Documentation

- **[CHAT_AI_AGENTS.md](./CHAT_AI_AGENTS.md)** — Training and configuring each level (instructions, knowledge bases, RAG, MCP, system prompts).
- **[apps/tenant/docs/ASSISTANT_TESTING_GUIDE.md](../apps/tenant/docs/ASSISTANT_TESTING_GUIDE.md)** — Testing Telnyx assistants (Webcall, Call Assistant).
- **[OUTBOUND_VOICE_ASSISTANT_CHECKLIST.md](./OUTBOUND_VOICE_ASSISTANT_CHECKLIST.md)** — Voice checklist for outbound campaigns.
- **Chatbot domain (Enhanced):** [packages/@tinadmin/core/src/chatbot/README.md](../packages/@tinadmin/core/src/chatbot/README.md).
