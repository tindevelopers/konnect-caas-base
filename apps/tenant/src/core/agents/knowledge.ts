import "server-only";

import { createAdminClient } from "@/core/database/admin-client";
import { createDocument } from "@/core/chatbot";
import { getAgentInstanceById, touchAgentKnowledgeSourceSync } from "./registry";

type UnknownRow = Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toText(value: unknown) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return JSON.stringify(value);
}

async function fetchUrlText(url: string): Promise<string> {
  const response = await fetch(url, {
    method: "GET",
    headers: { "User-Agent": "Tinadmin-Agent-KnowledgeIngest/1.0" },
  });
  if (!response.ok) {
    throw new Error(`URL fetch failed (${response.status}): ${url}`);
  }
  const html = await response.text();
  // Keep ingestion lightweight and deterministic.
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 80000);
}

export async function syncAgentKnowledgeSource(input: {
  tenantId: string;
  agentId: string;
  sourceId: string;
}) {
  const admin = createAdminClient();
  const { data: sourceRow, error } = await (admin.from("agent_knowledge_sources") as any)
    .select("*")
    .eq("tenant_id", input.tenantId)
    .eq("agent_id", input.agentId)
    .eq("id", input.sourceId)
    .single();
  if (error) {
    throw new Error(`Failed to load knowledge source: ${error.message}`);
  }

  const source = sourceRow as UnknownRow;
  const sourceType = String(source.source_type);
  const sourceRef = String(source.source_ref ?? "");
  const config = asRecord(source.config);

  const agent = await getAgentInstanceById(input.tenantId, input.agentId);
  if (!agent) throw new Error("Agent not found.");
  const knowledgeBaseId = agent.knowledge_profile?.knowledgeBaseId as
    | string
    | undefined;
  if (!knowledgeBaseId) {
    throw new Error(
      "Agent has no knowledgeBaseId in knowledge_profile. Add/attach KB first."
    );
  }

  const docs: Array<{ title: string; content: string; source: string; sourceType: "manual" | "url" | "file" }> = [];

  if (sourceType === "url" || sourceType === "sitemap") {
    if (!sourceRef) {
      throw new Error(`${sourceType} source requires source_ref URL.`);
    }
    const content = await fetchUrlText(sourceRef);
    docs.push({
      title: config.title ? String(config.title) : `Imported from ${sourceRef}`,
      content,
      source: sourceRef,
      sourceType: "url",
    });
  } else if (sourceType === "external_bucket") {
    const entries = Array.isArray(config.documents)
      ? (config.documents as Array<Record<string, unknown>>)
      : [];
    if (entries.length === 0) {
      docs.push({
        title: `External bucket source ${sourceRef || input.sourceId}`,
        content:
          toText(config.sampleContent) ||
          "External bucket source connected. Add `config.documents[]` entries to ingest concrete files.",
        source: sourceRef || "external_bucket",
        sourceType: "manual",
      });
    } else {
      for (const entry of entries) {
        docs.push({
          title: String(entry.title ?? "Bucket document"),
          content: toText(entry.content ?? entry.text ?? ""),
          source: String(entry.source ?? sourceRef ?? "external_bucket"),
          sourceType: "file",
        });
      }
    }
  } else {
    // file_upload, ticket, email_vault, manual_qa, call_transcript fallback.
    docs.push({
      title: config.title
        ? String(config.title)
        : `${sourceType} ${sourceRef || input.sourceId}`,
      content:
        toText(config.content) ||
        toText(config.text) ||
        `Knowledge source ${sourceType} connected (${sourceRef || "n/a"}).`,
      source: sourceRef || sourceType,
      sourceType: "manual",
    });
  }

  const createdDocs = [];
  for (const doc of docs) {
    const created = await createDocument({
      knowledgeBaseId,
      tenantId: input.tenantId,
      title: doc.title,
      content: doc.content,
      source: doc.source,
      sourceType: doc.sourceType,
      metadata: {
        source_id: input.sourceId,
        source_type: sourceType,
        agent_id: input.agentId,
      },
    });
    createdDocs.push(created);
  }

  await touchAgentKnowledgeSourceSync(input.tenantId, input.sourceId);

  return {
    sourceId: input.sourceId,
    importedDocuments: createdDocs.length,
    documentIds: createdDocs.map((d) => d.id),
  };
}

