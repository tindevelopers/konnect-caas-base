import Telnyx from "telnyx";

import {
  TelnyxApiError,
  type TelnyxClientConfig,
  type TelnyxRequestOptions,
  type TelnyxTransport,
} from "../client/types";
import { createTelnyxClient as createFetchTelnyxClient } from "../client/telnyxClient";

function normalizeMethod(method?: string): string {
  return (method ?? "GET").toUpperCase();
}

function buildHeaders(config: TelnyxClientConfig, options: TelnyxRequestOptions) {
  return {
    ...(config.userAgent ? { "User-Agent": config.userAgent } : {}),
    ...(options.headers ?? {}),
  };
}

function getDefaultAllowedPrefixes(): string[] {
  // Phase-2 defaults: switch messaging + AI-assistants-related endpoints first.
  // Voice/call-control, numbers, and messaging profile management stay on fetch until explicitly enabled.
  return ["/messages", "/ai/", "/integration_secrets"];
}

function resolveStage(): number {
  const raw = process.env.TELNYX_OFFICIAL_STAGE;
  if (!raw) return 2;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 2;
}

function prefixesForStage(stage: number): string[] {
  if (stage >= 5) return ["*"];
  const base = getDefaultAllowedPrefixes();
  if (stage >= 3) base.push("/phone_numbers", "/messaging_profiles");
  if (stage >= 4) base.push("/call_control_applications", "/calls");
  return base;
}

function parseAllowedPrefixes(): string[] {
  const raw = process.env.TELNYX_OFFICIAL_PATH_PREFIXES;
  if (!raw) return prefixesForStage(resolveStage());
  const prefixes = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return prefixes.length ? prefixes : prefixesForStage(resolveStage());
}

function isPathAllowed(path: string, allowedPrefixes: string[]): boolean {
  if (allowedPrefixes.includes("*")) return true;
  return allowedPrefixes.some((p) => path.startsWith(p));
}

function toTelnyxApiError(err: unknown): TelnyxApiError {
  if (err instanceof TelnyxApiError) return err;

  const message =
    err instanceof Error ? err.message : err ? String(err) : "Telnyx API request failed";

  if (err && typeof err === "object") {
    const anyErr = err as any;
    const status = typeof anyErr.status === "number" ? anyErr.status : 0;
    const details =
      anyErr.details ??
      anyErr.error ??
      anyErr.body ??
      anyErr.response ??
      anyErr.data ??
      err;
    return new TelnyxApiError(message, status, details);
  }

  return new TelnyxApiError(message, 0, err);
}

export function createOfficialTelnyxTransport(
  config: TelnyxClientConfig
): TelnyxTransport {
  // Keep behavior close to existing fetch transport:
  // - existing transport has no automatic retries
  // - preserve per-request headers support
  const client = new Telnyx({
    apiKey: config.apiKey,
    ...(config.baseUrl ? ({ baseURL: config.baseUrl } as any) : {}),
    ...(typeof (config as any).maxRetries === "number"
      ? ({ maxRetries: (config as any).maxRetries } as any)
      : ({ maxRetries: 0 } as any)),
  } as any);

  // Safety hatch: if the official SDK fails due to runtime compatibility issues,
  // fall back to the existing fetch-based transport.
  const fallbackEnabled = process.env.TELNYX_OFFICIAL_FALLBACK_FETCH !== "0";
  const fetchFallback = fallbackEnabled ? createFetchTelnyxClient(config) : null;
  const allowedPrefixes = parseAllowedPrefixes();

  return {
    async request<T>(path: string, options: TelnyxRequestOptions = {}) {
      const method = normalizeMethod(options.method);
      const headers = buildHeaders(config, options);

      if (!isPathAllowed(path, allowedPrefixes)) {
        if (fetchFallback) return fetchFallback.request<T>(path, options);
        throw new Error(
          `Telnyx official SDK path not enabled: ${path}. Configure TELNYX_OFFICIAL_PATH_PREFIXES="*", or include the needed prefix.`
        );
      }

      try {
        switch (method) {
          case "GET":
            return (await (client as any).get(path, {
              query: options.query,
              headers,
            })) as T;
          case "POST":
            return (await (client as any).post(path, {
              query: options.query,
              body: options.body,
              headers,
            })) as T;
          case "PUT":
            return (await (client as any).put(path, {
              query: options.query,
              body: options.body,
              headers,
            })) as T;
          case "PATCH":
            return (await (client as any).patch(path, {
              query: options.query,
              body: options.body,
              headers,
            })) as T;
          case "DELETE":
            return (await (client as any).delete(path, {
              query: options.query,
              body: options.body,
              headers,
            })) as T;
          default:
            throw new Error(`Unsupported HTTP method: ${method}`);
        }
      } catch (err) {
        const status = err && typeof err === "object" ? (err as any).status : undefined;
        const isApiError = typeof status === "number";
        if (!isApiError && fetchFallback) {
          return fetchFallback.request<T>(path, options);
        }
        throw toTelnyxApiError(err);
      }
    },
  };
}

