import "server-only";

import { appendFileSync } from "fs";
import { join } from "path";
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

/** Match common "[Insert Link]" placeholders (case-insensitive, optional spaces). */
const INSERT_LINK_PATTERN = /\[\s*insert\s+link\s*\]/i;

/** Find first URL in text (http or https). */
function findFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s)\]}\]]+/i);
  return match ? match[0].replace(/[.,;:!?)]+$/, "") : null;
}

/**
 * Replace the first "[Insert Link]" placeholder with an actual markdown link.
 * Uses the first citation URL if available, otherwise the first URL found in the content.
 */
function replaceInsertLinkPlaceholder(
  content: string,
  citations: AnswerCitation[]
): string {
  if (!INSERT_LINK_PATTERN.test(content)) return content;
  const citationUrl = citations.find((c) => c.url?.trim())?.url?.trim();
  const urlInContent = findFirstUrl(content);
  const url = citationUrl ?? urlInContent;
  if (!url) return content;
  const linkLabel = citationUrl
    ? (citations.find((c) => c.url === citationUrl)?.title ?? "Link")
    : "Link";
  const markdownLink = `[${linkLabel}](${url})`;
  return content.replace(INSERT_LINK_PATTERN, markdownLink);
}

/**
 * Enrich a plain answer into chat-friendly markdown.
 * If the provider already returns markdown, pass through.
 * Replaces "[Insert Link]" with actual links when a URL is available (citation or in content).
 * Add citation footnotes when available.
 */
function toChatMarkdown(
  content: string,
  citations: AnswerCitation[]
): string {
  let md = replaceInsertLinkPlaceholder(content, citations);

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

  // #region debug link flow (session 722982)
  const rawMsg = chatResponse.message ?? "";
  const hasPlaceholder = /\[\s*insert\s+link\s*\]/i.test(rawMsg);
  const urlInRaw = findFirstUrl(rawMsg);
  const fromWidget = Boolean((request.metadata as Record<string, unknown>)?.telnyx_proxy_brain);
  const payload1 = {
    sessionId: "722982",
    location: "answer-service.ts:getAgentAnswer:beforeToChatMarkdown",
    message: "Raw provider response and link inputs",
    data: {
      fromWidget,
      rawMessageLen: rawMsg.length,
      hasInsertLinkPlaceholder: hasPlaceholder,
      urlFoundInContent: !!urlInRaw,
      urlSnippet: urlInRaw ? urlInRaw.slice(0, 60) : null,
      citationsCount: citations.length,
      citationHasUrl: citations.some((c) => c.url?.trim()),
    },
    timestamp: Date.now(),
    hypothesisId: "H1",
  };
  try {
    appendFileSync(
      join(process.cwd(), ".cursor", "debug-722982.log"),
      JSON.stringify(payload1) + "\n"
    );
  } catch (_) {}
  fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "722982" },
    body: JSON.stringify(payload1),
  }).catch(() => {});
  // #endregion

  const voiceText = toVoiceText(chatResponse.message);
  const chatMarkdown = toChatMarkdown(chatResponse.message, citations);

  // #region debug link flow (session 722982)
  const hasMarkdownLink = /\]\s*\(\s*https?:\/\//i.test(chatMarkdown);
  const payload2 = {
    sessionId: "722982",
    location: "answer-service.ts:getAgentAnswer:afterToChatMarkdown",
    message: "chat_markdown after link replacement",
    data: {
      fromWidget,
      chatMarkdownLen: chatMarkdown.length,
      hasMarkdownLinkInOutput: hasMarkdownLink,
      snippet: chatMarkdown.slice(0, 300),
    },
    timestamp: Date.now(),
    hypothesisId: "H2",
  };
  try {
    appendFileSync(
      join(process.cwd(), ".cursor", "debug-722982.log"),
      JSON.stringify(payload2) + "\n"
    );
  } catch (_) {}
  fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "722982" },
    body: JSON.stringify(payload2),
  }).catch(() => {});
  // #endregion

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
