import { TelnyxApiError, TelnyxClientConfig, TelnyxRequestOptions, TelnyxTransport } from "./types";

function buildQuery(query?: TelnyxRequestOptions["query"]) {
  if (!query) return "";
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined) return;
    params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

async function parseError(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }
  try {
    return await response.text();
  } catch {
    return undefined;
  }
}

function extractErrorMessage(details: unknown, status: number): string {
  const fallback = `Telnyx API request failed (${status})`;
  if (typeof details === "string" && details.trim()) return details.trim();
  if (!details || typeof details !== "object") return fallback;
  const d = details as Record<string, unknown>;
  if (typeof d.message === "string" && d.message.trim()) return d.message.trim();
  const errors = d.errors;
  if (Array.isArray(errors) && errors.length) {
    const parts: string[] = [];
    for (const err of errors.slice(0, 3)) {
      if (err && typeof err === "object") {
        const e = err as Record<string, unknown>;
        const title = typeof e.title === "string" ? e.title.trim() : "";
        const detail = typeof e.detail === "string" ? e.detail.trim() : "";
        const code = typeof e.code === "string" ? e.code.trim() : "";
        const part = [code && `(${code})`, title, detail].filter(Boolean).join(" ");
        if (part) parts.push(part);
      }
    }
    if (parts.length) return `${fallback}: ${parts.join("; ")}`;
  }
  if (typeof d.error === "string" && d.error.trim()) return d.error.trim();
  if (typeof d.detail === "string" && d.detail.trim()) return d.detail.trim();
  return fallback;
}

export function createTelnyxClient(config: TelnyxClientConfig): TelnyxTransport {
  const baseUrl = config.baseUrl ?? "https://api.telnyx.com/v2";

  return {
    async request<T>(path: string, options: TelnyxRequestOptions = {}) {
      const url = `${baseUrl}${path}${buildQuery(options.query)}`;
      const response = await fetch(url, {
        method: options.method ?? "GET",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          ...(config.userAgent ? { "User-Agent": config.userAgent } : {}),
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        const details = await parseError(response);
        const message = extractErrorMessage(details, response.status);
        throw new TelnyxApiError(message, response.status, details);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        return (await response.json()) as T;
      }
      return (await response.text()) as T;
    },
  };
}
