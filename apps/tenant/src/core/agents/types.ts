export type AgentTier = "simple" | "advanced" | "third_party";
export type AgentStatus = "draft" | "active" | "paused" | "archived";
export type AgentProvider = "telnyx" | "advanced" | "abacus" | string;
export type AgentChannel = "webchat" | "sms" | "voice";

export interface AgentInstance {
  id: string;
  tenant_id: string;
  tier: AgentTier;
  provider: AgentProvider;
  display_name: string;
  description: string | null;
  status: AgentStatus;
  external_ref: string | null;
  public_key: string;
  channels_enabled: Record<string, unknown>;
  routing: Record<string, unknown>;
  knowledge_profile: Record<string, unknown>;
  model_profile: Record<string, unknown>;
  voice_profile: Record<string, unknown>;
  speech_profile: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_by: string | null;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
  tenant_relation?: "mapped_shared" | "tenant_owned_or_unmapped" | "internal";
}

export interface CreateAgentInput {
  tier: AgentTier;
  provider: AgentProvider;
  display_name: string;
  description?: string;
  status?: AgentStatus;
  external_ref?: string;
  channels_enabled?: Record<string, unknown>;
  routing?: Record<string, unknown>;
  knowledge_profile?: Record<string, unknown>;
  model_profile?: Record<string, unknown>;
  voice_profile?: Record<string, unknown>;
  speech_profile?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UpdateAgentInput {
  display_name?: string;
  description?: string | null;
  status?: AgentStatus;
  external_ref?: string | null;
  channels_enabled?: Record<string, unknown>;
  routing?: Record<string, unknown>;
  knowledge_profile?: Record<string, unknown>;
  model_profile?: Record<string, unknown>;
  voice_profile?: Record<string, unknown>;
  speech_profile?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ListAgentsOptions {
  tier?: AgentTier;
  provider?: string;
  status?: AgentStatus;
  search?: string;
  sortBy?:
    | "updated_at"
    | "created_at"
    | "display_name"
    | "tenant_relationship";
  sortDir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface AgentListingBinding {
  id: string;
  tenant_id: string;
  agent_id: string;
  listing_external_id: string;
  listing_slug: string | null;
  is_primary: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateAgentListingBindingInput {
  listing_external_id: string;
  listing_slug?: string;
  is_primary?: boolean;
  settings?: Record<string, unknown>;
}

export interface AgentKnowledgeSource {
  id: string;
  tenant_id: string;
  agent_id: string;
  source_type: string;
  source_ref: string | null;
  status: string;
  config: Record<string, unknown>;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAgentKnowledgeSourceInput {
  source_type:
    | "file_upload"
    | "url"
    | "sitemap"
    | "ticket"
    | "email_vault"
    | "external_bucket"
    | "manual_qa"
    | "call_transcript";
  source_ref?: string;
  status?: string;
  config?: Record<string, unknown>;
}

export interface AgentUsageEvent {
  id: string;
  tenant_id: string;
  agent_id: string;
  channel: AgentChannel | string;
  provider: string;
  event_type: string;
  input_tokens: number;
  output_tokens: number;
  audio_seconds: number;
  transcription_seconds: number;
  tool_calls: number;
  estimated_cost: number;
  currency: string;
  trace_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface RecordAgentUsageInput {
  channel: AgentChannel | string;
  provider: string;
  event_type: string;
  input_tokens?: number;
  output_tokens?: number;
  audio_seconds?: number;
  transcription_seconds?: number;
  tool_calls?: number;
  estimated_cost?: number;
  currency?: string;
  trace_id?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentProviderRequest {
  tenantId: string;
  agent: AgentInstance;
  message: string;
  conversationId?: string;
  externalConversationId?: string;
  channel?: AgentChannel | string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentProviderResponse {
  content: string;
  conversationId?: string;
  externalConversationId?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    audioSeconds?: number;
    transcriptionSeconds?: number;
    toolCalls?: number;
    estimatedCost?: number;
    currency?: string;
  };
  handoffSuggested?: boolean;
  handoffReason?: string;
  toolResults?: unknown;
  raw?: unknown;
}

export interface AgentChatRequest {
  tenantId: string;
  agentId?: string;
  publicKey?: string;
  listingExternalId?: string;
  message: string;
  conversationId?: string;
  channel?: AgentChannel | string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentChatResponse {
  agentId: string;
  provider: string;
  message: string;
  conversationId: string;
  externalConversationId?: string;
  handoffSuggested?: boolean;
  handoffReason?: string;
  usage?: RecordAgentUsageInput;
}

export interface PromoteAgentInput {
  toTier: AgentTier;
  toProvider: AgentProvider;
  reason?: string;
  metadata?: Record<string, unknown>;
  promotedBy?: string | null;
}

