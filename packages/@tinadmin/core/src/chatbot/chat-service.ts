/**
 * CHAT SERVICE
 * 
 * Main chat orchestration service.
 */

import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { retrieveContext, buildContextString } from './rag-engine';
import { buildSystemPrompt } from './prompts';
import { createTenantAwareServerClient } from '../database/tenant-client';
import { getPlatformIntegrationConfig } from '../integrations';
import type { ChatRequest, ChatResponse, ChatMessage, ChatConversation } from './types';

/** AI SDK 5 only supports models with spec v2 (e.g. gpt-4o-mini, gpt-4o). gpt-3.5-turbo is v1 and unsupported. */
export interface ChatOptions {
  tenantId: string;
  userId?: string;
  conversationId?: string;
  model?: 'gpt-4o-mini' | 'gpt-4o' | 'gpt-4-turbo' | 'gpt-4';
  temperature?: number;
  maxTokens?: number;
}

/**
 * Process a chat message and generate response
 */
export async function processChatMessage(
  request: ChatRequest,
  options: ChatOptions = { tenantId: request.tenantId }
): Promise<ChatResponse> {
  const {
    tenantId,
    userId,
    conversationId,
    model = 'gpt-4o-mini',
    temperature = 0.7,
    maxTokens = 1000,
  } = { ...options, tenantId: request.tenantId, userId: request.userId };

  // Retrieve relevant context
  const { chunks, citations, domainContext } = await retrieveContext(request.message, {
    tenantId,
    includeDomainContext: true,
  });

  // Build context string
  const contextString = buildContextString(chunks);

  // Build system prompt
  const systemPrompt = buildSystemPrompt({
    domain: domainContext.domain,
    context: chunks.map(c => c.content),
  });

  // Get conversation history if conversationId exists
  const conversationHistory = conversationId
    ? await getConversationHistory(conversationId, tenantId)
    : [];

  // Build messages
  const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
    { role: 'user', content: request.message },
  ];

  // Resolve AI credentials (platform config → env).
  const openaiProvider = await getOpenAIProvider();

  // Generate response using Vercel AI SDK (maxTokens in SDK 3.x, maxOutputTokens in SDK 5+)
  const result = await generateText({
    model: openaiProvider(model) as any,
    messages,
    temperature,
    ...(maxTokens != null && {
      maxTokens,
      maxOutputTokens: maxTokens,
    }),
  } as Parameters<typeof generateText>[0]);

  // Get the response text
  const responseText = result.text;

  // Create or update conversation
  const finalConversationId = conversationId || await createConversation({
    tenantId,
    userId,
    title: extractTitle(request.message),
  });

  // Save messages
  await saveMessage({
    conversationId: finalConversationId,
    tenantId,
    role: 'user',
    content: request.message,
  });

  const messageId = await saveMessage({
    conversationId: finalConversationId,
    tenantId,
    role: 'assistant',
    content: responseText,
    metadata: {
      citations: citations.map(c => ({
        documentId: c.documentId,
        title: c.title,
        source: c.source,
      })),
      domain: domainContext.domain,
      confidence: domainContext.confidence,
    },
  });

  return {
    message: responseText,
    conversationId: finalConversationId,
    messageId,
    citations,
    metadata: {
      domain: domainContext.domain,
      confidence: domainContext.confidence,
    },
  };
}

const AI_GATEWAY_PROVIDER = 'ai_gateway';
const DEFAULT_AI_GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh/v1';

let openaiProviderCache:
  | { provider: ReturnType<typeof createOpenAI>; fingerprint: string }
  | null = null;

function extractString(obj: unknown, key: string): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === 'string' && v.trim() ? v : undefined;
}

async function getOpenAIProvider(): Promise<ReturnType<typeof createOpenAI>> {
  // 1) Platform-configured Vercel AI Gateway
  try {
    const platform = await getPlatformIntegrationConfig(AI_GATEWAY_PROVIDER);
    const creds = platform?.credentials as Record<string, unknown> | null | undefined;
    const settings = platform?.settings as Record<string, unknown> | null | undefined;
    const gatewayKey = extractString(creds, 'apiKey');
    const gatewayBase = extractString(settings, 'baseUrl') ?? DEFAULT_AI_GATEWAY_BASE_URL;
    if (gatewayKey) {
      const fingerprint = `gateway:${gatewayBase}:${gatewayKey.slice(0, 6)}`;
      if (openaiProviderCache?.fingerprint === fingerprint) return openaiProviderCache.provider;
      const provider = createOpenAI({ apiKey: gatewayKey, baseURL: gatewayBase, name: 'openai' });
      openaiProviderCache = { provider, fingerprint };
      return provider;
    }
  } catch {
    // Fall back to env vars if Supabase/admin client isn't available.
  }

  // 2) Environment-configured Vercel AI Gateway. Do not rely on VERCEL_OIDC_TOKEN for local runs; set OPENAI_API_KEY or AI_GATEWAY_API_KEY in apps/tenant/.env.local or System Admin → API Configuration.
  const envGatewayKey =
    process.env.AI_GATEWAY_API_KEY ||
    (process.env.VERCEL === '1' ? process.env.VERCEL_OIDC_TOKEN : undefined);
  if (envGatewayKey) {
    const fingerprint = `gateway:${DEFAULT_AI_GATEWAY_BASE_URL}:${envGatewayKey.slice(0, 6)}`;
    if (openaiProviderCache?.fingerprint === fingerprint) return openaiProviderCache.provider;
    const provider = createOpenAI({
      apiKey: envGatewayKey,
      baseURL: DEFAULT_AI_GATEWAY_BASE_URL,
      name: 'openai',
    });
    openaiProviderCache = { provider, fingerprint };
    return provider;
  }

  // 3) Direct OpenAI (env) — createOpenAI defaults to OPENAI_API_KEY.
  const fingerprint = `openai:${(process.env.OPENAI_API_KEY || 'missing').slice(0, 6)}`;
  if (openaiProviderCache?.fingerprint === fingerprint) return openaiProviderCache.provider;
  const provider = createOpenAI();
  openaiProviderCache = { provider, fingerprint };
  return provider;
}

/**
 * Create a new conversation
 */
async function createConversation(input: {
  tenantId: string;
  userId?: string;
  title?: string;
}): Promise<string> {
  const tenantClient = await createTenantAwareServerClient(input.tenantId);
  const supabase = tenantClient.getClient();

  const { data, error } = await (supabase
    .from('chatbot_conversations') as any)
    .insert({
      tenant_id: input.tenantId,
      user_id: input.userId,
      title: input.title,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating conversation:', error);
    throw new Error('Failed to create conversation');
  }

  return data.id;
}

/**
 * Get conversation history
 */
async function getConversationHistory(
  conversationId: string,
  tenantId: string
): Promise<ChatMessage[]> {
  const tenantClient = await createTenantAwareServerClient(tenantId);
  const supabase = tenantClient.getClient();

  const { data, error } = await (supabase
    .from('chatbot_messages') as any)
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching conversation history:', error);
    return [];
  }

  return (data || []).map((msg: any) => ({
    id: msg.id,
    conversationId: msg.conversation_id,
    role: msg.role,
    content: msg.content,
    createdAt: new Date(msg.created_at),
    metadata: msg.metadata,
  }));
}

/**
 * Save a message
 */
async function saveMessage(input: {
  conversationId: string;
  tenantId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const tenantClient = await createTenantAwareServerClient(input.tenantId);
  const supabase = tenantClient.getClient();

  const { data, error } = await (supabase
    .from('chatbot_messages') as any)
    .insert({
      conversation_id: input.conversationId,
      tenant_id: input.tenantId,
      role: input.role,
      content: input.content,
      metadata: input.metadata || {},
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error saving message:', error);
    throw new Error('Failed to save message');
  }

  return data.id;
}

/**
 * Extract title from first message
 */
function extractTitle(message: string): string {
  // Take first 50 characters
  const title = message.slice(0, 50).trim();
  return title.length < message.length ? `${title}...` : title;
}

/**
 * Get conversation by ID
 */
export async function getConversation(
  conversationId: string,
  tenantId: string
): Promise<ChatConversation | null> {
  const tenantClient = await createTenantAwareServerClient(tenantId);
  const supabase = tenantClient.getClient();

  const { data, error } = await (supabase
    .from('chatbot_conversations') as any)
    .select('*')
    .eq('id', conversationId)
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching conversation:', error);
    throw new Error('Failed to fetch conversation');
  }

  return {
    id: data.id,
    tenantId: data.tenant_id,
    userId: data.user_id,
    title: data.title,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
    metadata: data.metadata,
  };
}

/**
 * List conversations for a user/tenant
 */
export async function listConversations(
  tenantId: string,
  options?: { userId?: string; limit?: number }
): Promise<ChatConversation[]> {
  const tenantClient = await createTenantAwareServerClient(tenantId);
  const supabase = tenantClient.getClient();

  let query = (supabase
    .from('chatbot_conversations') as any)
    .select('*')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })
    .limit(options?.limit || 20);

  if (options?.userId) {
    query = query.eq('user_id', options.userId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error listing conversations:', error);
    throw new Error('Failed to list conversations');
  }

  return (data || []).map((conv: any) => ({
    id: conv.id,
    tenantId: conv.tenant_id,
    userId: conv.user_id,
    title: conv.title,
    createdAt: new Date(conv.created_at),
    updatedAt: new Date(conv.updated_at),
    metadata: conv.metadata,
  }));
}

