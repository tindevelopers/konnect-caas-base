# Chat Systems: Multi-Turn, Generative AI & Platform Overview

**Summary for PDF.**  
*Multi-turn vs single-use chatbots, generative vs traditional AI, and why this platform’s chat system is stronger.*

---

## 1. Multi-Turn vs Single-Use Chatbots

### Multi-turn system

The bot keeps a **conversation session** and sends **prior turns** (history) with each new user message. The model can:

- Answer follow-ups (“What about the second one?”, “Can you explain that?”)
- Resolve references (“How do I cancel it?”)
- Stay on topic across many messages

**In this platform (Enhanced tier):** The app stores a `conversationId`, loads history from the database, and sends the full thread (system prompt + history + new message) to the LLM. So the platform **owns** the conversation and makes it multi-turn.

### Single-use / simplistic (e.g. basic Telnyx-only)

From the platform’s point of view:

- **One provider only** (Telnyx): no in-app RAG, no domain intelligence, no MCP.
- The app sends one message (and optionally a `conversation_id`) to Telnyx and returns the reply. Any “memory” lives on Telnyx’s side; the platform does not store or manage conversation history or inject extra context.
- **Simple** = minimal platform logic: no conversation DB, no RAG, no cross-agent behavior—just relay to Telnyx.

### Difference

| | Multi-turn (Enhanced) | Single-use (basic Telnyx) |
|---|------------------------|----------------------------|
| Conversation | Stored in platform DB, history sent every request | Not stored in platform; Telnyx may keep state |
| Context | RAG + domain + tools (MCP) | Telnyx KB only |
| Use case | Rich web chat, follow-ups, handoff | Voice + simple web chat, single stack |

---

## 2. Generative AI vs Traditional

*“Genetic” is likely meant as **Generative** (LLM-style) AI.*

### Traditional (rule-based / scripted)

- Fixed rules: “if user says X, reply Y” or scripted flows (e.g. IVR).
- No real language understanding; limited or no handling of rephrasing or follow-ups.
- Effectively single-turn: each input is matched to a rule or script step.
- Brittle: new phrasings or questions often break or hit “I didn’t understand.”

### Generative AI (LLM-based)

- Model **generates** responses from learned patterns; handles open-ended language, rephrasing, and follow-ups.
- Works naturally as **multi-turn** when conversation history is sent (as in Enhanced).
- Can be combined with **RAG** (knowledge bases) and **tools** (MCP) so answers are grounded in your data and actions.

**Summary:** Traditional = rules/scripts, little or no memory. Generative = LLM + optional multi-turn + RAG + tools. This platform uses generative AI in the Enhanced and Abacus tiers.

---

## 3. Why This Platform’s Chat System Is Stronger

1. **Three tiers in one place**  
   Telnyx (voice-first, simple), Enhanced (in-app RAG, domain intelligence, MCP, handoff, multi-turn), Abacus (external LLM / super-agentic). No need to choose only one kind of bot.

2. **Real multi-turn where it matters**  
   In Enhanced, conversations are stored by tenant and sent as history to the model so follow-ups and context work correctly.

3. **Domain intelligence**  
   RAG is aware of auth, billing, multi-tenancy, etc., so answers are about your product, not generic.

4. **Unified Answer API**  
   One API can route to Telnyx, Enhanced, or Abacus based on the agent’s provider.

5. **Cross-agent behavior**  
   Enhanced supports help vs handoff, target agents, and routing so you can escalate or pass context between agents.

6. **Multi-tenant and agent registry**  
   Agents are registered per tenant; knowledge and conversations are tenant-scoped.

---

## 4. Quick Reference

| Goal | Suggested tier |
|------|-----------------|
| Voice + web, simple KB | Telnyx |
| Web chat with docs, tools, follow-ups (multi-turn) | Enhanced |
| External LLM / super-agentic | Abacus |

---

*For training and configuration, see [CHAT_AI_AGENTS.md](./CHAT_AI_AGENTS.md). For product usage and comparison, see [CHAT_SYSTEMS_GUIDE.md](./CHAT_SYSTEMS_GUIDE.md).*

---

*Document generated for internal use. Print to PDF via Cursor/VS Code (e.g. “Markdown: Export to PDF” with an extension) or any Markdown-to-PDF tool (e.g. pandoc, markdown-pdf).*
