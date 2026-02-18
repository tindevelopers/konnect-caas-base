import { TelnyxApiError } from "@tinadmin/telnyx-ai-platform/server";

export type PublicSupportCode =
  | "KX-CTX-001"
  | "KX-INTEG-001"
  | "KX-INTEG-002"
  | "KX-INTEG-003"
  | "KX-NUM-001"
  | "KX-NUM-002"
  | "KX-NUM-003"
  | "KX-UP-001"
  | "KX-UNK-001";

export function createSupportRef() {
  const ref = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `ref_${String(ref).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 12)}`;
}

function extractProviderErrorDetails(details: unknown): {
  upstreamCode?: string;
  title?: string;
  detail?: string;
} {
  if (!details || typeof details !== "object") return {};
  const d = details as Record<string, unknown>;
  const errors = d.errors;
  if (!Array.isArray(errors) || errors.length === 0) return {};
  const first = errors[0];
  if (!first || typeof first !== "object") return {};
  const e = first as Record<string, unknown>;
  return {
    upstreamCode: typeof e.code === "string" ? e.code : undefined,
    title: typeof e.title === "string" ? e.title : undefined,
    detail: typeof e.detail === "string" ? e.detail : undefined,
  };
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.toLowerCase() : "";
}

export function toPublicProviderError(args: {
  error: unknown;
  supportRef: string;
  isPlatformAdmin: boolean;
  defaultCode?: PublicSupportCode;
}): Error {
  const { error, supportRef, isPlatformAdmin } = args;

  const generic = (code: PublicSupportCode, message: string, diagnostics?: string) => {
    const base = `${message} (Support code: ${code}, Ref: ${supportRef})`;
    if (!isPlatformAdmin) return new Error(base);
    return new Error(diagnostics ? `${base}\nDiagnostics: ${diagnostics}` : base);
  };

  if (error instanceof Error) {
    const msg = error.message ?? "";
    const lower = msg.toLowerCase();

    if (lower.includes("tenant context missing")) {
      return generic(
        "KX-CTX-001",
        "Tenant context missing. Please select a tenant and try again."
      );
    }

    if (lower.includes("not configured") || lower.includes("missing telephony api key") || lower.includes("missing credentials")) {
      return generic(
        "KX-INTEG-001",
        "Telephony integration is not configured for this organization."
      );
    }
  }

  if (error instanceof TelnyxApiError) {
    const { upstreamCode, title, detail } = extractProviderErrorDetails(error.details);
    const status = error.status;
    const detailLower = normalizeString(detail);
    const titleLower = normalizeString(title);

    if (status === 401 || status === 403) {
      return generic(
        "KX-INTEG-002",
        "Telephony provider authentication failed. Please verify the configured API key.",
        `http=${status} upstream_code=${upstreamCode ?? "-"} title=${title ?? "-"}`
      );
    }

    if (status === 429) {
      return generic(
        "KX-INTEG-003",
        "Telephony provider rate limit reached. Please retry in a minute.",
        `http=${status} upstream_code=${upstreamCode ?? "-"} title=${title ?? "-"}`
      );
    }

    // Telnyx upstream uses error code 1003 for "No numbers found" on available_phone_numbers.
    if (status === 400 && upstreamCode === "1003" && (detailLower.includes("no numbers found") || titleLower.includes("invalid request filter"))) {
      return generic(
        "KX-NUM-001",
        "No numbers matched your filters. Try broadening filters or enabling Best effort.",
        `http=${status} upstream_code=${upstreamCode} title=${title ?? "-"} detail=${detail ?? "-"}`
      );
    }

    if (status === 400) {
      return generic(
        "KX-NUM-002",
        "The provider rejected the request. Please review your filters and try again.",
        `http=${status} upstream_code=${upstreamCode ?? "-"} title=${title ?? "-"} detail=${detail ?? "-"}`
      );
    }

    if (status >= 500) {
      return generic(
        "KX-UP-001",
        "The telephony provider is temporarily unavailable. Please try again later.",
        `http=${status} upstream_code=${upstreamCode ?? "-"} title=${title ?? "-"}`
      );
    }

    return generic(
      args.defaultCode ?? "KX-UP-001",
      "The request failed. Please try again.",
      `http=${status} upstream_code=${upstreamCode ?? "-"} title=${title ?? "-"} detail=${detail ?? "-"}`
    );
  }

  return generic(args.defaultCode ?? "KX-UNK-001", "The request failed. Please try again.");
}

