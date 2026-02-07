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
  // 1) Platform-configured Vercel AI Gateway (preferred when present)
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
    // If Supabase service role isn't configured in this environment, fall back to env vars.
  }

  // 2) Environment-configured Vercel AI Gateway
  const envGatewayKey = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (envGatewayKey) {
    return { apiKey: envGatewayKey, baseURL: DEFAULT_AI_GATEWAY_BASE_URL };
  }

  // 3) Direct OpenAI (env)
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'No AI credentials configured. Set System Admin → API Configuration (Vercel AI Gateway), or set AI_GATEWAY_API_KEY / OPENAI_API_KEY.'
    );
  }
  return { apiKey };
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

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(
  text: string,
  options: EmbeddingOptions = {}
): Promise<number[]> {
  const {
    model = DEFAULT_MODEL,
    dimensions = DEFAULT_DIMENSIONS,
  } = options;

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
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate embedding');
  }
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

