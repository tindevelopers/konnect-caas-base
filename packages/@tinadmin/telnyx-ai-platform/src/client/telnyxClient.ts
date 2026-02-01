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
        const message =
          typeof details === "string"
            ? details
            : details && typeof details === "object" && "message" in details
            ? String((details as { message?: string }).message)
            : `Telnyx API request failed (${response.status})`;
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
