import "server-only";

import { routeAgentChat } from "./router";
import type { AgentChatResponse } from "./types";
import type {
  AnswerRequest,
  AnswerResponse,
  AnswerCitation,
  ProductRecommendation,
} from "./answer-types";

/**
 * Condense a full answer into a concise, speakable voice response.
 * Strips markdown, links, and long lists; keeps the first 2-3 sentences.
 */
function toVoiceText(content: string): string {
  let text = content
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~`#>]/g, "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\n{2,}/g, " ")
    .replace(/\n/g, " ")
    .trim();

  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length > 3) {
    text = sentences.slice(0, 3).join(" ").trim();
  }

  if (text.length > 500) {
    text = text.slice(0, 497).replace(/\s+\S*$/, "") + "...";
  }

  return text;
}

/**
 * Enrich a plain answer into chat-friendly markdown.
 * If the provider already returns markdown, pass through.
 * Add citation footnotes when available.
 */
function toChatMarkdown(
  content: string,
  citations: AnswerCitation[]
): string {
  let md = content;

  if (citations.length > 0) {
    md += "\n\n---\n**Sources:**\n";
    for (const [i, c] of citations.entries()) {
      const link = c.url ? `[${c.title}](${c.url})` : c.title;
      md += `${i + 1}. ${link}\n`;
    }
  }

  return md;
}

/**
 * Extract citations from the raw provider response when available.
 * The advanced (RAG) provider returns citations in raw.citations;
 * other providers may not.
 */
function extractCitations(raw: unknown): AnswerCitation[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;

  const rawCitations = obj.citations as
    | Array<Record<string, unknown>>
    | undefined;
  if (!Array.isArray(rawCitations)) return [];

  return rawCitations
    .filter((c) => c && typeof c.title === "string")
    .map((c) => ({
      title: String(c.title),
      source: String(c.source ?? ""),
      documentId: c.documentId ? String(c.documentId) : undefined,
      url: c.url ? String(c.url) : undefined,
    }));
}

/**
 * Placeholder product recommendation extraction.
 * In the future this will call a retrieval service against a product catalog.
 * For now it returns an empty array.
 */
function extractProductRecommendations(
  _message: string,
  _content: string,
  _raw: unknown
): ProductRecommendation[] {
  return [];
}

/**
 * Unified Answer API: routes through the agent provider layer and produces
 * dual-format output (voice_text + chat_markdown) from the same knowledge source.
 */
export async function getAgentAnswer(
  request: AnswerRequest
): Promise<AnswerResponse> {
  const chatResponse: AgentChatResponse = await routeAgentChat({
    tenantId: request.tenantId ?? "",
    agentId: request.agentId,
    publicKey: request.publicKey,
    message: request.message,
    conversationId: request.conversationId,
    channel: request.channel,
    userId: request.userId,
    metadata: {
      ...(request.metadata ?? {}),
      externalConversationId: request.externalConversationId,
      answerApiChannel: request.channel,
      context: request.context,
    },
  });

  const citations = extractCitations(chatResponse.usage?.metadata);
  const recommendations = extractProductRecommendations(
    request.message,
    chatResponse.message,
    chatResponse.usage?.metadata
  );

  const voiceText = toVoiceText(chatResponse.message);
  const chatMarkdown = toChatMarkdown(chatResponse.message, citations);

  return {
    agentId: chatResponse.agentId,
    provider: chatResponse.provider,
    conversationId: chatResponse.conversationId,
    externalConversationId: chatResponse.externalConversationId,

    voice_text: voiceText,
    chat_markdown: chatMarkdown,

    citations,
    product_recommendations: recommendations,

    handoffSuggested: chatResponse.handoffSuggested ?? false,
    handoffReason: chatResponse.handoffReason,

    toolResults: undefined,
    usage: chatResponse.usage,
  };
}
