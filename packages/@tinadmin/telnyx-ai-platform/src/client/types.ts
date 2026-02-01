export interface TelnyxClientConfig {
  apiKey: string;
  baseUrl?: string;
  userAgent?: string;
}

export interface TelnyxRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

export interface TelnyxTransport {
  request<T>(path: string, options?: TelnyxRequestOptions): Promise<T>;
}

export class TelnyxApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TelnyxApiError";
    this.status = status;
    this.details = details;
  }
}
