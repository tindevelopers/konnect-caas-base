"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { listTenantAssistantsForVoiceAction } from "@/app/actions/telnyx/assistants";

type Agent = {
  id: string;
  display_name: string;
  tier: "simple" | "advanced" | "third_party";
  provider: string;
  status: "draft" | "active" | "paused" | "archived";
  external_ref: string | null;
  public_key: string;
  tenant_relation?: "mapped_shared" | "tenant_owned_or_unmapped" | "internal";
  updated_at: string;
};

type UsageSummary = {
  totals: {
    total_events: number;
    input_tokens: number;
    output_tokens: number;
    audio_seconds: number;
    transcription_seconds: number;
    tool_calls: number;
    estimated_cost: number;
    billed_cost?: number;
    source_cost?: number;
  };
  byAgent: Array<{
    agent_id: string;
    display_name: string;
    total_events: number;
    input_tokens: number;
    output_tokens: number;
    audio_seconds: number;
    transcription_seconds: number;
    tool_calls: number;
    estimated_cost: number;
    billed_cost?: number;
    source_cost?: number;
  }>;
};

const defaultUsage: UsageSummary = {
  totals: {
    total_events: 0,
    input_tokens: 0,
    output_tokens: 0,
    audio_seconds: 0,
    transcription_seconds: 0,
    tool_calls: 0,
    estimated_cost: 0,
    billed_cost: 0,
    source_cost: 0,
  },
  byAgent: [],
};

const relationLabel: Record<string, string> = {
  mapped_shared: "Premium integration (shared)",
  tenant_owned_or_unmapped: "Enterprise integration (tenant-owned)",
  internal: "Base (internal)",
};

function agentIntegrationLabel(agent: Agent): string {
  if (agent.provider === "telnyx") {
    if (agent.tenant_relation === "tenant_owned_or_unmapped") return "Enterprise Agent";
    return "Premium Agent";
  }
  if (agent.provider === "advanced") return "Base Agent";
  if (agent.provider === "abacus") return "Enterprise Agent";
  return agent.provider;
}

function providerUiLabel(provider: string): string {
  if (provider === "telnyx") return "Premium / Enterprise Agent";
  if (provider === "advanced") return "Base Agent";
  if (provider === "abacus") return "Enterprise Agent";
  return provider;
}

export default function AgentManagerPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [usage, setUsage] = useState<UsageSummary>(defaultUsage);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [sortBy, setSortBy] = useState<
    "updated_at" | "display_name" | "tenant_relationship"
  >("tenant_relationship");

  const [createPayload, setCreatePayload] = useState({
    display_name: "",
    tier: "simple",
    provider: "telnyx",
    external_ref: "",
  });
  const [isCreating, setIsCreating] = useState(false);

  /** Tenant-available agents with an external_ref, for the Agent ID dropdown */
  const agentsWithExternalRef = useMemo(
    () => agents.filter((a) => a.external_ref?.trim()),
    [agents]
  );

  /** Tenant-scoped Telnyx assistants (id + name) for Agent ID dropdown */
  const [tenantAssistants, setTenantAssistants] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [assistantsLoading, setAssistantsLoading] = useState(false);

  /** Combined options for Agent ID: Telnyx assistants + already-registered platform agents (deduped) */
  const agentIdOptions = useMemo(() => {
    const byValue = new Map<string, string>();
    for (const a of tenantAssistants) {
      if (a.id.trim()) byValue.set(a.id.trim(), a.name.trim() || a.id);
    }
    for (const a of agentsWithExternalRef) {
      const ref = (a.external_ref ?? "").trim();
      if (ref) byValue.set(ref, `${a.display_name} (registered)`);
    }
    return Array.from(byValue.entries()).map(([value, label]) => ({
      value,
      label,
    }));
  }, [tenantAssistants, agentsWithExternalRef]);

  const fetchTenantAssistants = useCallback(async () => {
    setAssistantsLoading(true);
    try {
      const result = await listTenantAssistantsForVoiceAction();
      if ("error" in result && result.error) {
        setTenantAssistants([]);
        return;
      }
      setTenantAssistants(result.data ?? []);
    } catch {
      setTenantAssistants([]);
    } finally {
      setAssistantsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (createPayload.provider === "telnyx") {
      void fetchTenantAssistants();
    } else {
      setTenantAssistants([]);
    }
  }, [createPayload.provider, fetchTenantAssistants]);

  const [bindingAgentId, setBindingAgentId] = useState<string | null>(null);
  const [listingExternalId, setListingExternalId] = useState("");
  const [isBinding, setIsBinding] = useState(false);

  async function loadData() {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("sortBy", sortBy);
      params.set("sortDir", "asc");
      if (search.trim()) params.set("search", search.trim());
      if (tierFilter !== "all") params.set("tier", tierFilter);
      if (providerFilter !== "all") params.set("provider", providerFilter);

      const [agentsRes, usageRes] = await Promise.all([
        fetch(`/api/agents?${params.toString()}`),
        fetch("/api/agents/usage"),
      ]);
      const agentsJson = await agentsRes.json();
      const usageJson = await usageRes.json();

      if (!agentsRes.ok) {
        throw new Error(agentsJson.error || "Failed to load agents.");
      }
      if (!usageRes.ok) {
        throw new Error(usageJson.error || "Failed to load usage summary.");
      }

      setAgents((agentsJson.agents ?? []) as Agent[]);
      setUsage((usageJson ?? defaultUsage) as UsageSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [sortBy]);

  const providers = useMemo(() => {
    const set = new Set<string>();
    for (const agent of agents) {
      set.add(agent.provider);
    }
    return ["all", ...Array.from(set).sort()];
  }, [agents]);

  const usageByAgent = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of usage.byAgent) {
      map.set(
        row.agent_id,
        (row.billed_cost ?? row.estimated_cost ?? 0) > 0
          ? (row.billed_cost ?? row.estimated_cost ?? 0)
          : row.estimated_cost ?? 0
      );
    }
    return map;
  }, [usage]);

  async function handleSearchRefresh(event: React.FormEvent) {
    event.preventDefault();
    await loadData();
  }

  async function handleCreateAgent(event: React.FormEvent) {
    event.preventDefault();
    if (!createPayload.display_name.trim()) return;
    setIsCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createPayload,
          display_name: createPayload.display_name.trim(),
          external_ref: createPayload.external_ref.trim() || undefined,
          status: "active",
          channels_enabled: { webchat: true, sms: false, voice: false },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create agent.");
      setCreatePayload({
        display_name: "",
        tier: "simple",
        provider: "telnyx",
        external_ref: "",
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent.");
    } finally {
      setIsCreating(false);
    }
  }

  async function patchAgent(agentId: string, payload: Record<string, unknown>) {
    const res = await fetch(`/api/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || "Failed to update agent.");
    }
    return json;
  }

  async function handlePromote(
    agentId: string,
    toTier: "advanced" | "third_party",
    toProvider: "advanced" | "abacus"
  ) {
    setError(null);
    try {
      await patchAgent(agentId, {
        action: "promote",
        toTier,
        toProvider,
        reason: `Promoted via Agent Manager to ${toTier}/${toProvider}.`,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to promote agent.");
    }
  }

  async function handleBindListing(agentId: string) {
    if (!listingExternalId.trim()) return;
    setIsBinding(true);
    setError(null);
    try {
      await patchAgent(agentId, {
        action: "bind_listing",
        listing_external_id: listingExternalId.trim(),
        is_primary: true,
      });
      setListingExternalId("");
      setBindingAgentId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to bind listing.");
    } finally {
      setIsBinding(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Agent Manager
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage Simple, Advanced, and Third-party agents with tier promotion,
          listing binding, and tenant usage visibility.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs uppercase text-gray-500 dark:text-gray-400">
            Total Events
          </p>
          <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
            {usage.totals.total_events}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs uppercase text-gray-500 dark:text-gray-400">
            Total Tokens
          </p>
          <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
            {Math.round(usage.totals.input_tokens + usage.totals.output_tokens)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs uppercase text-gray-500 dark:text-gray-400">
            Audio Seconds
          </p>
          <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
            {Math.round(usage.totals.audio_seconds)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs uppercase text-gray-500 dark:text-gray-400">
            Estimated Cost
          </p>
          <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
            ${usage.totals.estimated_cost.toFixed(4)}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Billed: ${(usage.totals.billed_cost ?? 0).toFixed(4)}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleCreateAgent}
        className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 lg:grid-cols-5"
      >
        <input
          value={createPayload.display_name}
          onChange={(e) =>
            setCreatePayload((prev) => ({ ...prev, display_name: e.target.value }))
          }
          placeholder="Agent name"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
        />
        <select
          value={createPayload.tier}
          onChange={(e) =>
            setCreatePayload((prev) => ({ ...prev, tier: e.target.value }))
          }
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <option value="simple">Simple</option>
          <option value="advanced">Advanced</option>
          <option value="third_party">Third Party</option>
        </select>
        <select
          value={createPayload.provider}
          onChange={(e) =>
            setCreatePayload((prev) => ({ ...prev, provider: e.target.value }))
          }
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <option value="advanced">Base Agent</option>
          <option value="telnyx">Premium / Enterprise Agent</option>
          <option value="abacus">Enterprise Agent</option>
        </select>
        <div className="flex flex-col gap-1 lg:col-span-1">
          <select
            aria-label="Agent ID (external ref)"
            value={
              agentIdOptions.some((o) => o.value === createPayload.external_ref)
                ? createPayload.external_ref
                : ""
            }
            onChange={(e) =>
              setCreatePayload((prev) => ({
                ...prev,
                external_ref: e.target.value,
              }))
            }
            disabled={assistantsLoading && createPayload.provider === "telnyx"}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <option value="">
              {createPayload.provider === "telnyx" && assistantsLoading
                ? "Loading assistants..."
                : "Select agent or enter below"}
            </option>
            {agentIdOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            value={createPayload.external_ref}
            onChange={(e) =>
              setCreatePayload((prev) => ({
                ...prev,
                external_ref: e.target.value,
              }))
            }
            placeholder="Or type external ref (assistant_id/deployment_id)"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
          />
        </div>
        <button
          type="submit"
          disabled={isCreating}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isCreating ? "Creating..." : "Create Agent"}
        </button>
      </form>

      <form
        onSubmit={handleSearchRefresh}
        className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 lg:grid-cols-5"
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, description, external ref"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 lg:col-span-2"
        />
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <option value="all">All tiers</option>
          <option value="simple">Simple</option>
          <option value="advanced">Advanced</option>
          <option value="third_party">Third Party</option>
        </select>
        <select
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
        >
          {providers.map((provider) => (
            <option key={provider} value={provider}>
              {provider === "all" ? "All integrations" : providerUiLabel(provider)}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(
                e.target.value as "updated_at" | "display_name" | "tenant_relationship"
              )
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <option value="tenant_relationship">Sort: Tenant Relationship</option>
            <option value="updated_at">Sort: Recently Updated</option>
            <option value="display_name">Sort: Name</option>
          </select>
          <button
            type="submit"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            Apply
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-gray-200 text-xs uppercase text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Integration Level</th>
              <th className="px-4 py-3">Tenant Relation</th>
              <th className="px-4 py-3">Usage Cost</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={6}>
                  Loading agents...
                </td>
              </tr>
            )}
            {!isLoading && agents.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={6}>
                  No agents found.
                </td>
              </tr>
            )}
            {!isLoading &&
              agents.map((agent) => (
                <tr key={agent.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {agent.display_name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {agent.external_ref || "No external ref"} · {agent.status}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-400">
                      Widget:{" "}
                      {`<script src="/api/public/agents/widget?publicKey=${agent.public_key}"></script>`}
                    </div>
                  </td>
                  <td className="px-4 py-3">{agent.tier}</td>
                  <td className="px-4 py-3">{agentIntegrationLabel(agent)}</td>
                  <td className="px-4 py-3">
                    {relationLabel[agent.tenant_relation ?? "internal"] ??
                      agent.tenant_relation ??
                      "internal"}
                  </td>
                  <td className="px-4 py-3">
                    ${(usageByAgent.get(agent.id) ?? 0).toFixed(4)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {agent.tier !== "advanced" && (
                        <button
                          type="button"
                          onClick={() =>
                            handlePromote(agent.id, "advanced", "advanced")
                          }
                          className="rounded-lg border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                        >
                          Promote to Advanced
                        </button>
                      )}
                      {agent.tier !== "third_party" && (
                        <button
                          type="button"
                          onClick={() =>
                            handlePromote(agent.id, "third_party", "abacus")
                          }
                          className="rounded-lg border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                        >
                          Promote to Abacus
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setBindingAgentId((prev) =>
                            prev === agent.id ? null : agent.id
                          )
                        }
                        className="rounded-lg border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                      >
                        Bind Listing
                      </button>
                    </div>
                    {bindingAgentId === agent.id && (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          value={listingExternalId}
                          onChange={(e) => setListingExternalId(e.target.value)}
                          placeholder="listing_external_id"
                          className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800"
                        />
                        <button
                          type="button"
                          disabled={isBinding}
                          onClick={() => handleBindListing(agent.id)}
                          className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700 disabled:opacity-60"
                        >
                          {isBinding ? "Saving..." : "Save"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

