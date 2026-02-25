/**
 * Parse support code and ref from error message (e.g. "... (Support code: KX-NUM-004, Ref: ref_xxx)").
 * Safe to use on client and server.
 */
export function parseSupportCodeAndRef(errorMessage: string): {
  supportCode: string | null;
  supportRef: string | null;
} {
  const codeMatch = errorMessage.match(/Support code:\s*([A-Z0-9-]+)/i);
  const refMatch = errorMessage.match(/Ref:\s*(ref_[A-Za-z0-9_-]+)/i);
  return {
    supportCode: codeMatch?.[1] ?? null,
    supportRef: refMatch?.[1] ?? null,
  };
}
