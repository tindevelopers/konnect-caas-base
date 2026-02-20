/**
 * RAG ENGINE
 * 
 * Retrieval-Augmented Generation engine using Vercel AI SDK.
 */

import { generateEmbedding } from './embedding-service';
import { searchSimilar } from './vector-store';
import { detectDomain, enhanceQueryWithDomain, getDomainPrompt } from './domain-intelligence';
import type { ChatRequest, ChatResponse, Citation, DomainContext } from './types';

export interface RAGOptions {
  tenantId: string;
  limit?: number;
  threshold?: number;
  includeDomainContext?: boolean;
}

/**
 * Retrieve relevant context for a query
 */
export async function retrieveContext(
  query: string,
  options: RAGOptions
): Promise<{
  chunks: Array<{ content: string; metadata?: Record<string, unknown> }>;
  citations: Citation[];
  domainContext: DomainContext;
}> {
  const {
    tenantId,
    limit = 5,
    threshold = 0.7,
    includeDomainContext = true,
  } = options;

  // Detect domain
  const domainContext = detectDomain(query);

  let queryEmbedding: number[];
  try {
    queryEmbedding = await generateEmbedding(query);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('rate limit') || msg.includes('quota') || msg.includes('Failed to generate embedding')) {
      console.warn('[RAG] Embedding failed (rate limit/quota), continuing without knowledge context:', msg.slice(0, 80));
      return { chunks: [], citations: [], domainContext };
    }
    throw err;
  }

  // Enhance query with domain context if enabled
  const enhancedQuery = includeDomainContext
    ? enhanceQueryWithQuery(query, domainContext)
    : query;

  // Search for similar embeddings
  const results = await searchSimilar(queryEmbedding, {
    tenantId,
    limit,
    threshold,
  });

  // Build citations
  const citations: Citation[] = results.chunks.map((chunk, index) => {
    const document = results.documents.find(d => d.id === chunk.documentId);
    return {
      documentId: chunk.documentId,
      title: document?.title || 'Untitled',
      content: chunk.content,
      source: document?.source || 'unknown',
      relevanceScore: results.scores[index],
    };
  });

  // Extract chunks with metadata
  const chunks = results.chunks.map((chunk, index) => ({
    content: chunk.content,
    metadata: {
      ...chunk.metadata,
      documentId: chunk.documentId,
      relevanceScore: results.scores[index],
    },
  }));

  return {
    chunks,
    citations,
    domainContext,
  };
}

/**
 * Enhance query with domain context
 */
function enhanceQueryWithQuery(query: string, domainContext: DomainContext): string {
  if (domainContext.domain === 'general') {
    return query;
  }

  const domainPrompt = getDomainPrompt(domainContext.domain);
  return `${query}\n\nContext: This question relates to ${domainContext.domain}. ${domainPrompt}`;
}

/**
 * Build context string from retrieved chunks
 */
export function buildContextString(
  chunks: Array<{ content: string; metadata?: Record<string, unknown> }>
): string {
  if (chunks.length === 0) {
    return 'No relevant context found.';
  }

  return chunks
    .map((chunk, index) => {
      const title = chunk.metadata?.title as string | undefined;
      const source = chunk.metadata?.source as string | undefined;
      const header = title || source ? `[${title || source}]` : `[Context ${index + 1}]`;
      return `${header}\n${chunk.content}`;
    })
    .join('\n\n---\n\n');
}

/**
 * Format citations for response
 */
export function formatCitations(citations: Citation[]): string {
  if (citations.length === 0) {
    return '';
  }

  return citations
    .map((citation, index) => {
      return `[${index + 1}] ${citation.title} (${citation.source})`;
    })
    .join('\n');
}

