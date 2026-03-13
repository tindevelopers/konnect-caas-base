export type VariantIdNormalization =
  | { normalized: string; source: "gid" | "numeric" | "path" | "storefront_base64" }
  | { normalized: string; source: "unknown" };

const GID_PREFIX = "gid://shopify/ProductVariant/";

export function isShopifyVariantGid(id: string): boolean {
  return /^gid:\/\/shopify\/ProductVariant\/\d+$/.test(id);
}

function tryDecodeBase64(input: string): string | null {
  try {
    // Buffer is available in Node runtimes (Next.js route handlers use nodejs runtime here)
    const out = Buffer.from(input, "base64").toString("utf8");
    return out && out !== input ? out : null;
  } catch {
    return null;
  }
}

/**
 * Normalize a Shopify variant ID into a canonical GraphQL GID string when possible.
 *
 * Accepts common forms:
 * - `gid://shopify/ProductVariant/123` (already canonical)
 * - `123` (numeric ID)
 * - `ProductVariant/123` or `shopify/ProductVariant/123` (path-like)
 * - Storefront API base64-encoded GID (decodes to the GID string)
 */
export function normalizeShopifyVariantId(raw: string): VariantIdNormalization {
  const input = (raw ?? "").trim();
  if (!input) return { normalized: "", source: "unknown" };

  if (input.startsWith(GID_PREFIX)) {
    return { normalized: input, source: "gid" };
  }

  if (/^\d+$/.test(input)) {
    return { normalized: `${GID_PREFIX}${input}`, source: "numeric" };
  }

  const pathMatch = input.match(/ProductVariant\/(\d+)/);
  if (pathMatch?.[1]) {
    return { normalized: `${GID_PREFIX}${pathMatch[1]}`, source: "path" };
  }

  const decoded = tryDecodeBase64(input);
  if (decoded && decoded.startsWith(GID_PREFIX)) {
    return { normalized: decoded, source: "storefront_base64" };
  }

  return { normalized: input, source: "unknown" };
}

