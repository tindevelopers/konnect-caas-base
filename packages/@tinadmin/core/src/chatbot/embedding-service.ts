/**
 * EMBEDDING SERVICE
 * 
 * Generates text embeddings using OpenAI's embedding API.
 */

import OpenAI from 'openai';
import { getPlatformIntegrationConfig } from '../integrations';

const AI_GATEWAY_PROVIDER = 'ai_gateway';
const DEFAULT_AI_GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh/v1';

let openaiInstance: OpenAI | null = null;
let openaiInstanceFingerprint: string | null = null;

function extractString(obj: unknown, key: string): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === 'string' && v.trim() ? v : undefined;
}

async function resolveOpenAIConfig(): Promise<{ apiKey: string; baseURL?: string }> {
  const vercelEnv = process.env.VERCEL;

  // 1) Platform-configured Vercel AI Gateway (only in Vercel runtime; locally it often holds expired OIDC token)
  if (vercelEnv === '1') {
    try {
      const platform = await getPlatformIntegrationConfig(AI_GATEWAY_PROVIDER);
      const creds = platform?.credentials as Record<string, unknown> | null | undefined;
      const settings = platform?.settings as Record<string, unknown> | null | undefined;
      const gatewayKey = extractString(creds, 'apiKey');
      const gatewayBase = extractString(settings, 'baseUrl') ?? DEFAULT_AI_GATEWAY_BASE_URL;
      if (gatewayKey) {
        return { apiKey: gatewayKey, baseURL: gatewayBase };
      }
    } catch {
      // Fall back to env vars.
    }
  }

  // 2) Prefer OPENAI_API_KEY when set (avoids expired OIDC under vercel dev); then env gateway key.
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    return { apiKey: openaiKey };
  }

  // Use only explicit keys; do not use VERCEL_OIDC_TOKEN here (it expires and causes 401).
  const envGatewayKey = process.env.AI_GATEWAY_API_KEY?.trim();
  if (envGatewayKey) {
    return { apiKey: envGatewayKey, baseURL: DEFAULT_AI_GATEWAY_BASE_URL };
  }

  throw new Error(
    'No AI credentials configured for embeddings. Set OPENAI_API_KEY or AI_GATEWAY_API_KEY in apps/tenant/.env.local (or in Vercel project env / System Admin → API Configuration). Do not rely on VERCEL_OIDC_TOKEN for embeddings.'
  );
}

async function getOpenAI(): Promise<OpenAI> {
  const cfg = await resolveOpenAIConfig();
  const fingerprint = `${cfg.baseURL || 'openai'}:${cfg.apiKey.slice(0, 6)}`;
  if (!openaiInstance || openaiInstanceFingerprint !== fingerprint) {
    openaiInstance = new OpenAI({
      apiKey: cfg.apiKey,
      ...(cfg.baseURL ? { baseURL: cfg.baseURL } : {}),
    });
    openaiInstanceFingerprint = fingerprint;
  }
  return openaiInstance;
}

export interface EmbeddingOptions {
  model?: 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002';
  dimensions?: number;
}

const DEFAULT_MODEL: EmbeddingOptions['model'] = 'text-embedding-3-small';
const DEFAULT_DIMENSIONS = 1536;

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 3000;

function is429(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  const msg = error instanceof Error ? error.message : String(error);
  return status === 429 || msg.toLowerCase().includes('quota');
}

/**
 * Generate embedding for a single text. Retries on 429 with exponential backoff (3s, 6s, 12s).
 */
export async function generateEmbedding(
  text: string,
  options: EmbeddingOptions = {}
): Promise<number[]> {
  const {
    model = DEFAULT_MODEL,
    dimensions = DEFAULT_DIMENSIONS,
  } = options;

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const openai = await getOpenAI();
      const response = await openai.embeddings.create({
        model: model as any,
        input: text,
        dimensions: model === 'text-embedding-3-small' || model === 'text-embedding-3-large'
          ? dimensions
          : undefined,
      });
      return response.data[0].embedding;
    } catch (error: unknown) {
      lastError = error;
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStatus = (error as { status?: number })?.status;
      console.error(`Error generating embedding (attempt ${attempt}/${MAX_ATTEMPTS}):`, error);
      if (errStatus === 401 && String(errMsg).toLowerCase().includes('oidc')) {
        throw new Error(
          'Embedding failed: Vercel OIDC token expired or invalid. Set OPENAI_API_KEY or AI_GATEWAY_API_KEY in apps/tenant/.env.local or System Admin → API Configuration.'
        );
      }
      if (is429(error) && attempt < MAX_ATTEMPTS) {
        const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`Embedding 429 (attempt ${attempt}), retrying in ${delayMs}ms...`);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      if (errStatus === 429 || String(errMsg).toLowerCase().includes('quota')) {
        throw new Error(
          'Embedding failed: OpenAI rate limit or quota exceeded. Wait a minute and try again, or request a limit increase at https://platform.openai.com/account/limits'
        );
      }
      throw new Error('Failed to generate embedding');
    }
  }
  if (is429(lastError)) {
    throw new Error(
      'Embedding failed: OpenAI rate limit or quota exceeded. Wait a minute and try again, or request a limit increase at https://platform.openai.com/account/limits'
    );
  }
  throw new Error('Failed to generate embedding');
}

/**
 * Generate embeddings for multiple texts (batch)
 */
export async function generateEmbeddings(
  texts: string[],
  options: EmbeddingOptions = {}
): Promise<number[][]> {
  const {
    model = DEFAULT_MODEL,
    dimensions = DEFAULT_DIMENSIONS,
  } = options;

  try {
    const openai = await getOpenAI();
    const response = await openai.embeddings.create({
      model: model as any,
      input: texts,
      dimensions: model === 'text-embedding-3-small' || model === 'text-embedding-3-large' 
        ? dimensions 
        : undefined,
    });

    return response.data.map((item: any) => item.embedding);
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw new Error('Failed to generate embeddings');
  }
}

/**
 * Get embedding model dimensions
 */
export function getEmbeddingDimensions(model?: EmbeddingOptions['model']): number {
  switch (model || DEFAULT_MODEL) {
    case 'text-embedding-3-small':
      return 1536;
    case 'text-embedding-3-large':
      return 3072;
    case 'text-embedding-ada-002':
      return 1536;
    default:
      return DEFAULT_DIMENSIONS;
  }
}

