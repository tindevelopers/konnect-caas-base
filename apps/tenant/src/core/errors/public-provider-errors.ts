import { TelnyxApiError } from "@tinadmin/telnyx-ai-platform/server";

export type PublicSupportCode =
  | "KX-CTX-001"
  | "KX-INTEG-001"
  | "KX-INTEG-002"
  | "KX-INTEG-003"
  | "KX-NUM-001"
  | "KX-NUM-002"
  | "KX-NUM-003"
  | "KX-NUM-004"
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

/** True if provider error suggests approval/eligibility/restriction (e.g. level 2, compliance). */
function suggestsApprovalRestriction(detail: string, title: string): boolean {
  const combined = `${detail} ${title}`;
  return (
    combined.includes("approval") ||
    combined.includes("approve") ||
    combined.includes("level 2") ||
    combined.includes("eligibility") ||
    combined.includes("restricted") ||
    combined.includes("compliance") ||
    combined.includes("requirement group") ||
    combined.includes("permission") ||
    combined.includes("not allowed") ||
    combined.includes("not permitted")
  );
}

export function toPublicProviderError(args: {
  error: unknown;
  supportRef: string;
  isPlatformAdmin: boolean;
  defaultCode?: PublicSupportCode;
  /** When true, 403 on provider is treated as approval-level restriction (e.g. number order). */
  numberOrderContext?: boolean;
}): Error {
  const { error, supportRef, isPlatformAdmin, numberOrderContext } = args;

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
    const isApprovalRestriction = suggestsApprovalRestriction(detailLower, titleLower);

    if (status === 403 && (isApprovalRestriction || numberOrderContext)) {
      return generic(
        "KX-NUM-004",
        "This tenant needs a higher approval level. We have sent a message to the platform administrator.",
        `http=${status} upstream_code=${upstreamCode ?? "-"} title=${title ?? "-"} detail=${detail ?? "-"}`
      );
    }

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

    // Telnyx 20003: API Key forbidden — account verification level restricts which numbers can be ordered (e.g. only local numbers in FR for L1).
    if (status === 400 && upstreamCode === "20003") {
      return generic(
        "KX-NUM-003",
        "Your Telnyx account verification level only allows ordering certain number types or regions. Try a number type and country your account allows, or upgrade your verification level in the Telnyx portal.",
        `http=${status} upstream_code=${upstreamCode} title=${title ?? "-"} detail=${detail ?? "-"}`
      );
    }

    if (status === 400 && isApprovalRestriction) {
      return generic(
        "KX-NUM-004",
        "This tenant needs a higher approval level. We have sent a message to the platform administrator.",
        `http=${status} upstream_code=${upstreamCode ?? "-"} title=${title ?? "-"} detail=${detail ?? "-"}`
      );
    }

    if (status === 400) {
      return generic(
        "KX-NUM-002",
        "The provider rejected the request. Please review your filters and try again.",
        `http=${status} upstream_code=${upstreamCode ?? "-"} title=${title ?? "-"} detail=${detail ?? "-"}`
      );
    }

    if (status >= 400 && status < 500 && isApprovalRestriction) {
      return generic(
        "KX-NUM-004",
        "This tenant needs a higher approval level. We have sent a message to the platform administrator.",
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

    // For 4xx fallback, surface the provider's message when present so users see actionable errors (e.g. "Connection is required", "Reservation expired").
    const fromDetails = [detail, title].find((s) => typeof s === "string" && s.length > 0 && s.length <= 280);
    const rawMsg = typeof error.message === "string" ? error.message.trim() : "";
    const bareFallback = `Telnyx API request failed (${status})`;
    const clientMsg =
      rawMsg.length > bareFallback.length + 1 && rawMsg.length <= 320 ? rawMsg : "";
    const fallbackMessage =
      (fromDetails?.trim() ?? clientMsg) || "The request failed. Please try again.";

    return generic(
      args.defaultCode ?? "KX-UP-001",
      fallbackMessage,
      `http=${status} upstream_code=${upstreamCode ?? "-"} title=${title ?? "-"} detail=${detail ?? "-"}`
    );
  }

  return generic(args.defaultCode ?? "KX-UNK-001", "The request failed. Please try again.");
}

