# 🤖 CHATBOT DOMAIN

Multi-tenant RAG chatbot system with domain intelligence for the SaaS platform.

## 📁 Structure

```
chatbot/
├── index.ts                    # PUBLIC API - Import only from here!
├── types.ts                    # TypeScript types
├── chat-service.ts            # Main chat orchestration
├── rag-engine.ts              # RAG implementation using Vercel AI SDK
├── domain-intelligence.ts     # Domain understanding and routing
├── embedding-service.ts       # Text embedding generation
├── knowledge-base.ts          # Knowledge base management
├── vector-store.ts            # Vector database operations (pgvector)
├── chunking.ts               # Text chunking strategies
├── prompts.ts                # System prompts and templates
└── data-sources/             # Data source integrations
    ├── platform-docs-source.ts
    ├── crm-source.ts
    ├── billing-source.ts
    └── tenant-source.ts
```

## 🎯 Purpose

This domain handles:
- ✅ Multi-tenant chatbot with RAG capabilities
- ✅ Domain intelligence (auth, billing, multi-tenancy, permissions, database)
- ✅ Knowledge base management
- ✅ Document ingestion and indexing
- ✅ Conversation history
- ✅ Vector search using pgvector

## 📦 Public API

### Chat Service

```typescript
import { processChatMessage, getConversation, listConversations } from '@/core/chatbot';

// Process a chat message
const response = await processChatMessage({
  message: "How do I manage tenants?",
  tenantId: "xxx",
  userId: "yyy",
});

// Get conversation
const conversation = await getConversation(conversationId, tenantId);

// List conversations
const conversations = await listConversations(tenantId, { userId: "yyy" });
```

### Knowledge Base

```typescript
import {
  createKnowledgeBase,
  createDocument,
  listKnowledgeBases,
} from '@/core/chatbot';

// Create knowledge base
const kb = await createKnowledgeBase({
  tenantId: "xxx",
  name: "Platform Docs",
  type: "platform",
});

// Add document
const doc = await createDocument({
  knowledgeBaseId: kb.id,
  tenantId: "xxx",
  title: "Getting Started",
  content: "...",
  source: "docs/getting-started.md",
  sourceType: "file",
});
```

### Domain Intelligence

```typescript
import { detectDomain } from '@/core/chatbot';

// Detect domain from query
const domain = detectDomain("How do I reset my password?");
// Returns: { domain: "auth", confidence: 0.8 }
```

## 🔧 Configuration

### Environment Variables

- `OPENAI_API_KEY` or `AI_GATEWAY_API_KEY` - Required for embeddings and LLM. For local development set one of these in `apps/tenant/.env.local` (or use System Admin → API Configuration for the AI gateway). Do not rely on `VERCEL_OIDC_TOKEN` for local runs.
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key

### Database Setup

Run the migration to create chatbot tables:

```bash
supabase migration up
```

The migration creates:
- `chatbot_conversations` - Conversation history
- `chatbot_messages` - Individual messages
- `chatbot_knowledge_bases` - Knowledge bases
- `chatbot_documents` - Documents
- `chatbot_document_chunks` - Document chunks
- `chatbot_embeddings` - Vector embeddings

## 🚀 Usage Examples

### Admin Chatbot

Access at `/saas/chatbot` in the admin dashboard.

### Portal Chatbot

Embed the `ChatbotWidget` component in portal pages.

### API Routes

- `POST /api/chatbot/chat` - Send a message
- `GET /api/chatbot/conversations` - List conversations
- `GET /api/chatbot/knowledge-base` - List knowledge bases
- `POST /api/chatbot/knowledge-base` - Create knowledge base or document

## 📚 Knowledge Base Ingestion

To ingest platform documentation:

```typescript
import { extractPlatformDocs } from '@/core/chatbot/data-sources/platform-docs-source';

await extractPlatformDocs({
  tenantId: "xxx",
  knowledgeBaseId: kb.id,
});
```

This will extract:
- Domain README files (`packages/@tinadmin/core/src/*/README.md`)
- Architecture documentation (`docs/ARCHITECTURE.md`)
- Multi-tenancy docs (`docs/MULTITENANT_ARCHITECTURE.md`)

## 🔒 Tenant Isolation

- All chatbot data is tenant-scoped
- RLS policies enforce tenant isolation
- Platform knowledge bases are shared but filtered by tenant context
- Conversations are isolated per tenant

## 🎨 Domain Intelligence

The chatbot understands platform domains:

- **Auth** - Authentication, sessions, passwords
- **Multi-tenancy** - Tenant management, isolation
- **Billing** - Subscriptions, payments, invoices
- **Permissions** - RBAC, access control
- **Database** - Data access patterns, RLS
- **Shared** - Common utilities

Queries are automatically routed to relevant domain knowledge.

