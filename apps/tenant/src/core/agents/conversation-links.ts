import "server-only";

import { createAdminClient } from "@/core/database/admin-client";

export interface PendingProductLink {
  url: string;
  title?: string;
}

interface ConversationMetadata {
  pending_product_links?: PendingProductLink[];
  pending_links_snippet?: string;
  [key: string]: unknown;
}

function asMetadata(value: unknown): ConversationMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as ConversationMetadata;
}

export async function storePendingProductLinks(
  conversationId: string,
  links: PendingProductLink[],
  responseSnippet?: string
): Promise<void> {
  if (!conversationId || links.length === 0) return;

  const admin = createAdminClient();
  const { data, error } = await (admin.from("chatbot_conversations") as any)
    .select("id, metadata")
    .eq("id", conversationId)
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) {
    throw new Error("Conversation not found while storing pending product links.");
  }

  const metadata = asMetadata(data.metadata);
  const mergedMetadata: ConversationMetadata = {
    ...metadata,
    pending_product_links: links,
    pending_links_snippet: responseSnippet?.trim() || metadata.pending_links_snippet,
  };

  const { error: updateError } = await (admin.from("chatbot_conversations") as any)
    .update({ metadata: mergedMetadata })
    .eq("id", conversationId);

  if (updateError) {
    throw new Error(`Failed to store pending product links: ${updateError.message}`);
  }
}

export async function consumePendingProductLinks(
  conversationId: string
): Promise<{ links: PendingProductLink[]; snippet?: string } | null> {
  if (!conversationId) return null;

  const admin = createAdminClient();
  const { data, error } = await (admin.from("chatbot_conversations") as any)
    .select("id, metadata")
    .eq("id", conversationId)
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) return null;

  const metadata = asMetadata(data.metadata);
  const links = Array.isArray(metadata.pending_product_links)
    ? metadata.pending_product_links
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const url = String((item as PendingProductLink).url ?? "").trim();
          const titleRaw = (item as PendingProductLink).title;
          const title = typeof titleRaw === "string" ? titleRaw.trim() : undefined;
          if (!/^https?:\/\//i.test(url)) return null;
          return { url, title };
        })
        .filter(Boolean) as PendingProductLink[]
    : [];

  if (links.length === 0) return null;

  const { pending_product_links: _unusedLinks, pending_links_snippet, ...rest } = metadata;
  const { error: updateError } = await (admin.from("chatbot_conversations") as any)
    .update({ metadata: rest })
    .eq("id", conversationId);

  if (updateError) {
    throw new Error(`Failed to consume pending product links: ${updateError.message}`);
  }

  return {
    links,
    snippet: typeof pending_links_snippet === "string" ? pending_links_snippet : undefined,
  };
}
