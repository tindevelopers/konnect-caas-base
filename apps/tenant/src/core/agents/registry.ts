import "server-only";

import { createAdminClient } from "@/core/database/admin-client";
import type {
  AgentInstance,
  AgentKnowledgeSource,
  AgentListingBinding,
  AgentUsageEvent,
  CreateAgentInput,
  CreateAgentKnowledgeSourceInput,
  CreateAgentListingBindingInput,
  ListAgentsOptions,
  PromoteAgentInput,
  RecordAgentUsageInput,
  UpdateAgentInput,
} from "./types";

type UnknownRow = Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function mapAgentRow(row: UnknownRow): AgentInstance {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    tier: String(row.tier) as AgentInstance["tier"],
    provider: String(row.provider),
    display_name: String(row.display_name),
    description: asString(row.description),
    status: String(row.status) as AgentInstance["status"],
    external_ref: asString(row.external_ref),
    public_key: String(row.public_key),
    channels_enabled: asRecord(row.channels_enabled),
    routing: asRecord(row.routing),
    knowledge_profile: asRecord(row.knowledge_profile),
    model_profile: asRecord(row.model_profile),
    voice_profile: asRecord(row.voice_profile),
    speech_profile: asRecord(row.speech_profile),
    metadata: asRecord(row.metadata),
    created_by: asString(row.created_by),
    last_active_at: asString(row.last_active_at),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapBindingRow(row: UnknownRow): AgentListingBinding {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    agent_id: String(row.agent_id),
    listing_external_id: String(row.listing_external_id),
    listing_slug: asString(row.listing_slug),
    is_primary: Boolean(row.is_primary),
    settings: asRecord(row.settings),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapKnowledgeSourceRow(row: UnknownRow): AgentKnowledgeSource {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    agent_id: String(row.agent_id),
    source_type: String(row.source_type),
    source_ref: asString(row.source_ref),
    status: String(row.status),
    config: asRecord(row.config),
    last_synced_at: asString(row.last_synced_at),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapUsageRow(row: UnknownRow): AgentUsageEvent {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    agent_id: String(row.agent_id),
    channel: String(row.channel),
    provider: String(row.provider),
    event_type: String(row.event_type),
    input_tokens: asNumber(row.input_tokens),
    output_tokens: asNumber(row.output_tokens),
    audio_seconds: asNumber(row.audio_seconds),
    transcription_seconds: asNumber(row.transcription_seconds),
    tool_calls: Math.round(asNumber(row.tool_calls)),
    estimated_cost: asNumber(row.estimated_cost),
    currency: String(row.currency ?? "USD"),
    trace_id: asString(row.trace_id),
    metadata: asRecord(row.metadata),
    created_at: String(row.created_at),
  };
}

export async function listAgentInstances(
  tenantId: string,
  options: ListAgentsOptions = {}
): Promise<AgentInstance[]> {
  const admin = createAdminClient();
  let query = (admin.from("agent_instances") as any)
    .select("*")
    .eq("tenant_id", tenantId);

  if (options.tier) query = query.eq("tier", options.tier);
  if (options.provider) query = query.eq("provider", options.provider);
  if (options.status) query = query.eq("status", options.status);
  if (options.search?.trim()) {
    const search = options.search.trim();
    query = query.or(
      `display_name.ilike.%${search}%,description.ilike.%${search}%,external_ref.ilike.%${search}%`
    );
  }

  const shouldSortByRelationship = options.sortBy === "tenant_relationship";
  if (!shouldSortByRelationship) {
    const sortBy = options.sortBy ?? "updated_at";
    const asc = options.sortDir === "asc";
    query = query.order(sortBy, { ascending: asc });
  }

  if (options.limit) query = query.limit(options.limit);
  if (typeof options.offset === "number" && options.limit) {
    query = query.range(options.offset, options.offset + options.limit - 1);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list agents: ${error.message}`);
  }

  const rows = (data ?? []) as UnknownRow[];
  const mapped = rows.map(mapAgentRow);
  if (!shouldSortByRelationship) {
    return mapped;
  }

  const { data: relationRows } = await (admin.from("tenant_ai_assistants") as any)
    .select("telnyx_assistant_id")
    .eq("tenant_id", tenantId);
  const relationSet = new Set(
    ((relationRows ?? []) as UnknownRow[]).map((row) =>
      String(row.telnyx_assistant_id)
    )
  );

  const relationRank = (agent: AgentInstance) => {
    if (agent.provider !== "telnyx") return 2;
    if (agent.external_ref && relationSet.has(agent.external_ref)) return 0;
    return 1;
  };

  const sorted: AgentInstance[] = mapped
    .map((agent): AgentInstance => {
      const rank = relationRank(agent);
      const tenant_relation: NonNullable<AgentInstance["tenant_relation"]> =
        rank === 0
          ? "mapped_shared"
          : rank === 1
            ? "tenant_owned_or_unmapped"
            : "internal";
      return { ...agent, tenant_relation };
    })
    .sort((a, b) => {
      const rankDiff = relationRank(a) - relationRank(b);
      if (rankDiff !== 0) return rankDiff;
      return a.display_name.localeCompare(b.display_name);
    });

  if (options.sortDir === "desc") {
    sorted.reverse();
  }

  return sorted;
}

export async function getAgentInstanceById(
  tenantId: string,
  agentId: string
): Promise<AgentInstance | null> {
  const admin = createAdminClient();
  const { data, error } = await (admin.from("agent_instances") as any)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", agentId)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to fetch agent: ${error.message}`);
  }
  if (!data) return null;
  return mapAgentRow(data as UnknownRow);
}

export async function getAgentInstanceByPublicKey(
  publicKey: string
): Promise<AgentInstance | null> {
  const admin = createAdminClient();
  const { data, error } = await (admin.from("agent_instances") as any)
    .select("*")
    .eq("public_key", publicKey)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to fetch public agent: ${error.message}`);
  }
  if (!data) return null;
  return mapAgentRow(data as UnknownRow);
}

export async function getAgentInstanceByExternalRef(
  externalRef: string
): Promise<AgentInstance | null> {
  const ref = externalRef.trim();
  if (!ref) return null;

  const admin = createAdminClient();
  const { data, error } = await (admin.from("agent_instances") as any)
    .select("*")
    .eq("external_ref", ref)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch external_ref agent: ${error.message}`);
  }
  const row = Array.isArray(data) ? (data[0] as UnknownRow | undefined) : undefined;
  if (!row) return null;
  return mapAgentRow(row);
}

export async function createAgentInstance(
  tenantId: string,
  createdBy: string | null,
  input: CreateAgentInput
): Promise<AgentInstance> {
  const admin = createAdminClient();
  const { data, error } = await (admin.from("agent_instances") as any)
    .insert({
      tenant_id: tenantId,
      tier: input.tier,
      provider: input.provider,
      display_name: input.display_name,
      description: input.description ?? null,
      status: input.status ?? "draft",
      external_ref: input.external_ref ?? null,
      channels_enabled: input.channels_enabled ?? {
        webchat: true,
        sms: false,
        voice: false,
      },
      routing: input.routing ?? {},
      knowledge_profile: input.knowledge_profile ?? {},
      model_profile: input.model_profile ?? {},
      voice_profile: input.voice_profile ?? {},
      speech_profile: input.speech_profile ?? {},
      metadata: input.metadata ?? {},
      created_by: createdBy,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create agent: ${error.message}`);
  }
  return mapAgentRow(data as UnknownRow);
}

export async function updateAgentInstance(
  tenantId: string,
  agentId: string,
  input: UpdateAgentInput
): Promise<AgentInstance> {
  const admin = createAdminClient();
  const patch: Record<string, unknown> = {};
  if (input.display_name !== undefined) patch.display_name = input.display_name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.status !== undefined) patch.status = input.status;
  if (input.external_ref !== undefined) patch.external_ref = input.external_ref;
  if (input.channels_enabled !== undefined) patch.channels_enabled = input.channels_enabled;
  if (input.routing !== undefined) patch.routing = input.routing;
  if (input.knowledge_profile !== undefined) patch.knowledge_profile = input.knowledge_profile;
  if (input.model_profile !== undefined) patch.model_profile = input.model_profile;
  if (input.voice_profile !== undefined) patch.voice_profile = input.voice_profile;
  if (input.speech_profile !== undefined) patch.speech_profile = input.speech_profile;
  if (input.metadata !== undefined) patch.metadata = input.metadata;

  const { data, error } = await (admin.from("agent_instances") as any)
    .update(patch)
    .eq("tenant_id", tenantId)
    .eq("id", agentId)
    .select("*")
    .single();
  if (error) {
    throw new Error(`Failed to update agent: ${error.message}`);
  }
  return mapAgentRow(data as UnknownRow);
}

export async function deleteAgentInstance(
  tenantId: string,
  agentId: string
): Promise<void> {
  const existing = await getAgentInstanceById(tenantId, agentId);
  if (!existing) {
    throw new Error("Agent not found.");
  }
  const admin = createAdminClient();
  const { error } = await (admin.from("agent_instances") as any)
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", agentId);
  if (error) {
    throw new Error(`Failed to delete agent: ${error.message}`);
  }
}

export async function promoteAgentInstance(
  tenantId: string,
  agentId: string,
  input: PromoteAgentInput
): Promise<AgentInstance> {
  const current = await getAgentInstanceById(tenantId, agentId);
  if (!current) throw new Error("Agent not found.");
  const metadata = {
    ...current.metadata,
    promoted_at: new Date().toISOString(),
    promoted_to_tier: input.toTier,
    promoted_to_provider: input.toProvider,
    promotion_reason: input.reason ?? null,
  };

  const admin = createAdminClient();
  const { error } = await (admin.from("agent_promotions") as any).insert({
    tenant_id: tenantId,
    agent_id: agentId,
    from_tier: current.tier,
    to_tier: input.toTier,
    from_provider: current.provider,
    to_provider: input.toProvider,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
    promoted_by: input.promotedBy ?? null,
  });
  if (error) {
    throw new Error(`Failed to write promotion record: ${error.message}`);
  }
  const { data, error: updateError } = await (admin.from("agent_instances") as any)
    .update({
      tier: input.toTier,
      provider: input.toProvider,
      status: current.status === "archived" ? "draft" : current.status,
      metadata,
    })
    .eq("tenant_id", tenantId)
    .eq("id", agentId)
    .select("*")
    .single();
  if (updateError) {
    throw new Error(`Failed to finalize promotion: ${updateError.message}`);
  }

  return mapAgentRow(data as UnknownRow);
}

export async function bindAgentToListing(
  tenantId: string,
  agentId: string,
  input: CreateAgentListingBindingInput
): Promise<AgentListingBinding> {
  const admin = createAdminClient();
  const { data, error } = await (admin.from("agent_listing_bindings") as any)
    .upsert(
      {
        tenant_id: tenantId,
        agent_id: agentId,
        listing_external_id: input.listing_external_id,
        listing_slug: input.listing_slug ?? null,
        is_primary: input.is_primary ?? true,
        settings: input.settings ?? {},
      },
      { onConflict: "tenant_id,agent_id,listing_external_id" }
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to bind listing: ${error.message}`);
  }
  return mapBindingRow(data as UnknownRow);
}

export async function listAgentListingBindings(
  tenantId: string,
  agentId: string
): Promise<AgentListingBinding[]> {
  const admin = createAdminClient();
  const { data, error } = await (admin.from("agent_listing_bindings") as any)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`Failed to list listing bindings: ${error.message}`);
  }
  return ((data ?? []) as UnknownRow[]).map(mapBindingRow);
}

export async function getPrimaryListingAgent(
  tenantId: string,
  listingExternalId: string
): Promise<AgentInstance | null> {
  const admin = createAdminClient();
  const { data, error } = await (admin.from("agent_listing_bindings") as any)
    .select("agent_id")
    .eq("tenant_id", tenantId)
    .eq("listing_external_id", listingExternalId)
    .eq("is_primary", true)
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to resolve listing agent: ${error.message}`);
  }
  if (!data?.agent_id) return null;
  return getAgentInstanceById(tenantId, String(data.agent_id));
}

export async function createAgentKnowledgeSource(
  tenantId: string,
  agentId: string,
  input: CreateAgentKnowledgeSourceInput
): Promise<AgentKnowledgeSource> {
  const admin = createAdminClient();
  const { data, error } = await (admin.from("agent_knowledge_sources") as any)
    .insert({
      tenant_id: tenantId,
      agent_id: agentId,
      source_type: input.source_type,
      source_ref: input.source_ref ?? null,
      status: input.status ?? "active",
      config: input.config ?? {},
    })
    .select("*")
    .single();
  if (error) {
    throw new Error(`Failed to create knowledge source: ${error.message}`);
  }
  return mapKnowledgeSourceRow(data as UnknownRow);
}

export async function listAgentKnowledgeSources(
  tenantId: string,
  agentId: string
): Promise<AgentKnowledgeSource[]> {
  const admin = createAdminClient();
  const { data, error } = await (admin.from("agent_knowledge_sources") as any)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`Failed to list knowledge sources: ${error.message}`);
  }
  return ((data ?? []) as UnknownRow[]).map(mapKnowledgeSourceRow);
}

export async function touchAgentKnowledgeSourceSync(
  tenantId: string,
  sourceId: string
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await (admin.from("agent_knowledge_sources") as any)
    .update({
      last_synced_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("id", sourceId);
  if (error) {
    throw new Error(`Failed to update knowledge sync status: ${error.message}`);
  }
}

export async function recordAgentUsageEvent(
  tenantId: string,
  agentId: string,
  usage: RecordAgentUsageInput
): Promise<AgentUsageEvent> {
  const admin = createAdminClient();
  const { data, error } = await (admin.from("agent_usage_events") as any)
    .insert({
      tenant_id: tenantId,
      agent_id: agentId,
      channel: usage.channel,
      provider: usage.provider,
      event_type: usage.event_type,
      input_tokens: usage.input_tokens ?? 0,
      output_tokens: usage.output_tokens ?? 0,
      audio_seconds: usage.audio_seconds ?? 0,
      transcription_seconds: usage.transcription_seconds ?? 0,
      tool_calls: usage.tool_calls ?? 0,
      estimated_cost: usage.estimated_cost ?? 0,
      currency: usage.currency ?? "USD",
      trace_id: usage.trace_id ?? null,
      metadata: usage.metadata ?? {},
    })
    .select("*")
    .single();
  if (error) {
    throw new Error(`Failed to record agent usage: ${error.message}`);
  }
  return mapUsageRow(data as UnknownRow);
}

export async function getAgentUsageSummary(
  tenantId: string,
  options?: { startDate?: string; endDate?: string }
) {
  const admin = createAdminClient();
  let query = (admin.from("agent_usage_events") as any)
    .select("*")
    .eq("tenant_id", tenantId);
  if (options?.startDate) query = query.gte("created_at", options.startDate);
  if (options?.endDate) query = query.lte("created_at", options.endDate);
  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load usage summary: ${error.message}`);
  }

  const usageRows = ((data ?? []) as UnknownRow[]).map(mapUsageRow);
  const byAgent = new Map<
    string,
    {
      agent_id: string;
      total_events: number;
      input_tokens: number;
      output_tokens: number;
      audio_seconds: number;
      transcription_seconds: number;
      tool_calls: number;
      estimated_cost: number;
      billed_cost: number;
      source_cost: number;
    }
  >();

  for (const row of usageRows) {
    const bucket = byAgent.get(row.agent_id) ?? {
      agent_id: row.agent_id,
      total_events: 0,
      input_tokens: 0,
      output_tokens: 0,
      audio_seconds: 0,
      transcription_seconds: 0,
      tool_calls: 0,
      estimated_cost: 0,
      billed_cost: 0,
      source_cost: 0,
    };
    bucket.total_events += 1;
    bucket.input_tokens += row.input_tokens;
    bucket.output_tokens += row.output_tokens;
    bucket.audio_seconds += row.audio_seconds;
    bucket.transcription_seconds += row.transcription_seconds;
    bucket.tool_calls += row.tool_calls;
    bucket.estimated_cost += row.estimated_cost;
    byAgent.set(row.agent_id, bucket);
  }

  let costQuery = (admin.from("tenant_usage_costs") as any)
    .select("cost_amount, billed_amount, metadata, created_at")
    .eq("tenant_id", tenantId)
    .eq("cost_type", "ai_minutes");
  if (options?.startDate) costQuery = costQuery.gte("created_at", options.startDate);
  if (options?.endDate) costQuery = costQuery.lte("created_at", options.endDate);
  const { data: costRows } = await costQuery;
  for (const row of (costRows ?? []) as UnknownRow[]) {
    const metadata = asRecord(row.metadata);
    const agentId = typeof metadata.agent_id === "string" ? metadata.agent_id : null;
    if (!agentId) continue;
    const bucket = byAgent.get(agentId) ?? {
      agent_id: agentId,
      total_events: 0,
      input_tokens: 0,
      output_tokens: 0,
      audio_seconds: 0,
      transcription_seconds: 0,
      tool_calls: 0,
      estimated_cost: 0,
      billed_cost: 0,
      source_cost: 0,
    };
    bucket.source_cost += asNumber(row.cost_amount);
    bucket.billed_cost += asNumber(row.billed_amount);
    byAgent.set(agentId, bucket);
  }

  const agentIds = Array.from(byAgent.keys());
  let agentNameMap = new Map<string, string>();
  if (agentIds.length > 0) {
    const { data: agentRows } = await (admin.from("agent_instances") as any)
      .select("id, display_name")
      .eq("tenant_id", tenantId)
      .in("id", agentIds);
    agentNameMap = new Map(
      ((agentRows ?? []) as UnknownRow[]).map((row) => [
        String(row.id),
        String(row.display_name ?? row.id),
      ])
    );
  }

  const totals = {
    total_events: 0,
    input_tokens: 0,
    output_tokens: 0,
    audio_seconds: 0,
    transcription_seconds: 0,
    tool_calls: 0,
    estimated_cost: 0,
    billed_cost: 0,
    source_cost: 0,
  };

  const byAgentRows = Array.from(byAgent.values())
    .map((row) => ({
      ...row,
      display_name: agentNameMap.get(row.agent_id) ?? row.agent_id,
    }))
    .sort((a, b) => b.estimated_cost - a.estimated_cost);

  for (const row of byAgentRows) {
    totals.total_events += row.total_events;
    totals.input_tokens += row.input_tokens;
    totals.output_tokens += row.output_tokens;
    totals.audio_seconds += row.audio_seconds;
    totals.transcription_seconds += row.transcription_seconds;
    totals.tool_calls += row.tool_calls;
    totals.estimated_cost += row.estimated_cost;
    totals.billed_cost += row.billed_cost;
    totals.source_cost += row.source_cost;
  }

  return { totals, byAgent: byAgentRows };
}

