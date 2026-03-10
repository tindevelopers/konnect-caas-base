import type { AgentChannel, RecordAgentUsageInput } from "./types";

export type ProductRecommendationKind =
  | "similar"
  | "better"
  | "competitive"
  | "in_stock";

export interface ProductRecommendation {
  kind: ProductRecommendationKind;
  title: string;
  productRef: string;
  why: string;
  rep_script: string;
  confidence: number;
}

export interface AnswerCitation {
  title: string;
  source: string;
  documentId?: string;
  url?: string;
}

export interface AnswerRequest {
  agentId?: string;
  publicKey?: string;
  tenantId?: string;
  channel: AgentChannel | string;
  message: string;
  conversationId?: string;
  externalConversationId?: string;
  userId?: string;
  context?: {
    callControlId?: string;
    locale?: string;
    customerProfile?: Record<string, unknown>;
    [key: string]: unknown;
  };
  metadata?: Record<string, unknown>;
}

export interface AnswerResponse {
  agentId: string;
  provider: string;
  conversationId: string;
  externalConversationId?: string;

  voice_text: string;
  chat_markdown: string;

  citations: AnswerCitation[];
  product_recommendations: ProductRecommendation[];

  handoffSuggested: boolean;
  handoffReason?: string;
  tieredEscalationBanner?: string;

  /** Optional banner for tiered escalation (e.g. "Escalated to L2") shown in proxy/chat. */
  tieredEscalationBanner?: string;

  toolResults?: unknown;
  usage?: RecordAgentUsageInput;
}
