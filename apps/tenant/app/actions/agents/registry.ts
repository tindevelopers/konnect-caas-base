"use server";

import { createClient } from "@/core/database/server";
import { createAdminClient } from "@/core/database/admin-client";
import { ensureTenantId } from "@/core/multi-tenancy/validation";
import { requirePermission } from "@/core/permissions/middleware";
import { createDocument, createKnowledgeBase } from "@/core/chatbot";
import {
  bindAgentToListing,
  createAgentInstance,
  createAgentKnowledgeSource,
  getAgentInstanceById,
  getAgentUsageSummary,
  listAgentInstances,
  listAgentKnowledgeSources,
  listAgentListingBindings,
  promoteAgentInstance,
  updateAgentInstance,
} from "@/src/core/agents/registry";
import { syncAgentKnowledgeSource } from "@/src/core/agents/knowledge";
import {
  getSpeechProviderCapabilities,
  getVoiceProviderCapabilities,
} from "@/src/core/agents/providers/speech";
import type {
  CreateAgentInput,
  CreateAgentKnowledgeSourceInput,
  CreateAgentListingBindingInput,
  ListAgentsOptions,
  PromoteAgentInput,
  UpdateAgentInput,
} from "@/src/core/agents/types";

async function getTenantAndUser() {
  const tenantId = await ensureTenantId();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { tenantId, userId: user?.id ?? null };
}

function defaultProviderForTier(tier: CreateAgentInput["tier"]) {
  if (tier === "simple") return "telnyx";
  if (tier === "advanced") return "advanced";
  return "abacus";
}

async function maybeMapTelnyxAssistant(args: {
  tenantId: string;
  userId: string | null;
  provider: string;
  externalRef?: string | null;
}) {
  const externalRef = args.externalRef?.trim();
  if (args.provider !== "telnyx" || !externalRef) return;

  const admin = createAdminClient();
  await (admin.from("tenant_ai_assistants") as any).upsert(
    {
      tenant_id: args.tenantId,
      telnyx_assistant_id: externalRef,
      created_by: args.userId,
    },
    { onConflict: "tenant_id,telnyx_assistant_id" }
  );
}

export async function listAgentsAction(options?: ListAgentsOptions) {
  const { tenantId } = await getTenantAndUser();
  await requirePermission("integrations.read", { tenantId });
  return listAgentInstances(tenantId, options);
}

export async function getAgentAction(agentId: string) {
  const { tenantId } = await getTenantAndUser();
  await requirePermission("integrations.read", { tenantId });
  return getAgentInstanceById(tenantId, agentId);
}

export async function createAgentAction(input: CreateAgentInput) {
  const { tenantId, userId } = await getTenantAndUser();
  await requirePermission("integrations.write", { tenantId });

  const provider = input.provider || defaultProviderForTier(input.tier);
  let knowledgeProfile = input.knowledge_profile ?? {};

  // Automatically attach a dedicated tenant KB for advanced and third-party tiers.
  if (
    (input.tier === "advanced" || input.tier === "third_party") &&
    !knowledgeProfile.knowledgeBaseId
  ) {
    try {
      const kb = await createKnowledgeBase({
        tenantId,
        name: `${input.display_name} Knowledge`,
        description: `Auto-generated knowledge base for agent ${input.display_name}`,
        type: "tenant",
      });
      knowledgeProfile = {
        ...knowledgeProfile,
        knowledgeBaseId: kb.id,
      };
    } catch (error) {
      console.error("[createAgentAction] Failed to auto-create knowledge base:", error);
    }
  }

  const created = await createAgentInstance(tenantId, userId, {
    ...input,
    provider,
    knowledge_profile: knowledgeProfile,
  });

  await maybeMapTelnyxAssistant({
    tenantId,
    userId,
    provider,
    externalRef: created.external_ref,
  });

  return created;
}

export async function updateAgentAction(agentId: string, input: UpdateAgentInput) {
  const { tenantId, userId } = await getTenantAndUser();
  await requirePermission("integrations.write", { tenantId });

  const updated = await updateAgentInstance(tenantId, agentId, input);
  await maybeMapTelnyxAssistant({
    tenantId,
    userId,
    provider: updated.provider,
    externalRef: updated.external_ref,
  });
  return updated;
}

export async function promoteAgentAction(agentId: string, input: PromoteAgentInput) {
  const { tenantId, userId } = await getTenantAndUser();
  await requirePermission("integrations.write", { tenantId });
  return promoteAgentInstance(tenantId, agentId, {
    ...input,
    promotedBy: userId,
  });
}

export async function bindAgentListingAction(
  agentId: string,
  input: CreateAgentListingBindingInput
) {
  const { tenantId } = await getTenantAndUser();
  await requirePermission("integrations.write", { tenantId });
  return bindAgentToListing(tenantId, agentId, input);
}

export async function listAgentBindingsAction(agentId: string) {
  const { tenantId } = await getTenantAndUser();
  await requirePermission("integrations.read", { tenantId });
  return listAgentListingBindings(tenantId, agentId);
}

export async function addAgentKnowledgeSourceAction(
  agentId: string,
  input: CreateAgentKnowledgeSourceInput & {
    seedDocumentTitle?: string;
    seedDocumentContent?: string;
    seedDocumentSource?: string;
  }
) {
  const { tenantId } = await getTenantAndUser();
  await requirePermission("integrations.write", { tenantId });

  const source = await createAgentKnowledgeSource(tenantId, agentId, input);

  if (input.seedDocumentContent?.trim()) {
    const agent = await getAgentInstanceById(tenantId, agentId);
    const knowledgeBaseId = agent?.knowledge_profile?.knowledgeBaseId as
      | string
      | undefined;
    if (knowledgeBaseId) {
      await createDocument({
        knowledgeBaseId,
        tenantId,
        title:
          input.seedDocumentTitle ??
          `${input.source_type} knowledge for ${agent?.display_name ?? "agent"}`,
        content: input.seedDocumentContent,
        source: input.seedDocumentSource ?? input.source_ref ?? "manual",
        sourceType: "manual",
        metadata: {
          source_type: input.source_type,
          source_id: source.id,
        },
      });
    }
  }

  return source;
}

export async function listAgentKnowledgeSourcesAction(agentId: string) {
  const { tenantId } = await getTenantAndUser();
  await requirePermission("integrations.read", { tenantId });
  return listAgentKnowledgeSources(tenantId, agentId);
}

export async function syncAgentKnowledgeSourceAction(
  agentId: string,
  sourceId: string
) {
  const { tenantId } = await getTenantAndUser();
  await requirePermission("integrations.write", { tenantId });
  return syncAgentKnowledgeSource({ tenantId, agentId, sourceId });
}

export async function ingestAgentKnowledgeTextAction(input: {
  agentId: string;
  title: string;
  content: string;
  source?: string;
  metadata?: Record<string, unknown>;
}) {
  const { tenantId } = await getTenantAndUser();
  await requirePermission("integrations.write", { tenantId });
  const agent = await getAgentInstanceById(tenantId, input.agentId);
  if (!agent) {
    throw new Error("Agent not found.");
  }

  const knowledgeBaseId = agent.knowledge_profile?.knowledgeBaseId as
    | string
    | undefined;
  if (!knowledgeBaseId) {
    throw new Error(
      "Agent has no knowledge base configured. Promote to Advanced or attach a KB first."
    );
  }

  return createDocument({
    knowledgeBaseId,
    tenantId,
    title: input.title,
    content: input.content,
    source: input.source ?? "manual",
    sourceType: "manual",
    metadata: {
      ...(input.metadata ?? {}),
      agent_id: input.agentId,
    },
  });
}

export async function getAgentUsageSummaryAction(input?: {
  startDate?: string;
  endDate?: string;
}) {
  const { tenantId } = await getTenantAndUser();
  await requirePermission("integrations.read", { tenantId });
  return getAgentUsageSummary(tenantId, input);
}

export async function getSpeechProviderCapabilityMatrixAction() {
  const { tenantId } = await getTenantAndUser();
  await requirePermission("integrations.read", { tenantId });
  return {
    stt: getSpeechProviderCapabilities(),
    tts: getVoiceProviderCapabilities(),
  };
}

