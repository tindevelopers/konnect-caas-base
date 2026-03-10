"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getAgentAction, updateAgentAction } from "@/app/actions/agents/registry";
import type { AgentInstance } from "@/src/core/agents/types";

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function routingBool(routing: Record<string, unknown>, key: string): boolean {
  const v = routing[key];
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.trim().toLowerCase() === "true" || v.trim() === "1";
  return false;
}

function routingString(routing: Record<string, unknown>, key: string): string {
  const v = routing[key];
  return typeof v === "string" ? v.trim() : "";
}

export default function AgentManagerSettingsPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const [agentId, setAgentId] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentInstance | null>(null);
  const [allAgents, setAllAgents] = useState<Array<{ id: string; display_name: string; provider?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [tieredChat, setTieredChat] = useState(false);
  const [level2AgentId, setLevel2AgentId] = useState("");
  const [proxyBrainDelegateAgentId, setProxyBrainDelegateAgentId] = useState("");

  useEffect(() => {
    params.then((p) => setAgentId(p.agentId));
  }, [params]);

  const load = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    setError(null);
    try {
      const [agentRes, listRes] = await Promise.all([
        getAgentAction(agentId),
        fetch("/api/agents?limit=100").then((r) => r.json()),
      ]);
      if (!agentRes) {
        setError("Agent not found.");
        setAgent(null);
        return;
      }
      setAgent(agentRes);
      const routing = asRecord(agentRes.routing);
      setTieredChat(routingBool(routing, "tieredChat"));
      setLevel2AgentId(routingString(routing, "level2AgentId"));
      setProxyBrainDelegateAgentId(routingString(routing, "proxyBrainDelegateAgentId"));

      const agents = (listRes.agents ?? []) as Array<{ id: string; display_name: string; provider?: string }>;
      setAllAgents(agents);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load agent.");
      setAgent(null);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = useCallback(async () => {
    if (!agentId) return;
    setSaving(true);
    setSaved(false);
    try {
      const currentRouting = asRecord(agent?.routing ?? {});
      await updateAgentAction(agentId, {
        routing: {
          ...currentRouting,
          tieredChat,
          level2AgentId: level2AgentId || undefined,
          proxyBrainDelegateAgentId: proxyBrainDelegateAgentId || undefined,
          level1AgentId: undefined,
          level3AgentId: undefined,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }, [agentId, agent?.routing, tieredChat, level2AgentId, proxyBrainDelegateAgentId]);

  if (!agentId) return null;
  if (loading) {
    return (
      <div className="p-6 text-sm text-gray-500 dark:text-gray-400">
        Loading agent…
      </div>
    );
  }
  if (error || !agent) {
    return (
      <div className="p-6">
        <p className="text-red-600 dark:text-red-400">{error ?? "Agent not found."}</p>
        <Link
          href="/ai/agent-manager"
          className="mt-4 inline-block text-indigo-600 hover:underline dark:text-indigo-400"
        >
          ← Back to Agent Manager
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/ai/agent-manager"
          className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
        >
          ← Agent Manager
        </Link>
      </div>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
        {agent.display_name}
      </h1>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        ID: {agent.id} · Provider: {agent.provider}
      </p>

      <section className="mt-8 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Tiered chat (L1 → L2 escalation)
        </h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          When enabled, L1 uses the same Telnyx assistant, and complex intents escalate to a
          single L2 strategic agent (e.g. Abacus). Use <strong>Proxy brain delegate</strong> to
          make Telnyx transport-only and send every proxy message to one agent (e.g. Abacus).
        </p>
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
          <strong>Checklist:</strong> Enable tiered chat → set Level 2 agent to a chat-capable agent (e.g. provider &quot;abacus&quot;). Use the Answer API (proxy webhook, <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">/api/public/agents/answer</code> or <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">/api/agents/[id]/answer</code>) and send the same <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">conversationId</code> on follow-up messages so the user stays on L2 after escalation.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
              Proxy brain delegate (transport-only → Abacus)
            </label>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              When the Telnyx proxy webhook is used, route every message to this agent. Telnyx handles only transport and delivery.
            </p>
            <select
              value={proxyBrainDelegateAgentId}
              onChange={(e) => setProxyBrainDelegateAgentId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="">— None (use tiered L1→L2) —</option>
              {allAgents
                .filter((a) => a.id !== agentId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.display_name} · {a.provider ?? "—"} ({a.id.slice(0, 8)}…)
                  </option>
                ))}
            </select>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={tieredChat}
              onChange={(e) => setTieredChat(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 dark:border-gray-600 dark:bg-gray-800"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Enable tiered chat (L1 → L2 escalation)</span>
          </label>
          {tieredChat && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                  Level 2 agent (strategic escalation, e.g. Abacus)
                </label>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  Use a platform agent that can handle chat (e.g. provider &quot;abacus&quot;).
                </p>
                <select
                  value={level2AgentId}
                  onChange={(e) => setLevel2AgentId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">— None —</option>
                  {allAgents
                    .filter((a) => a.id !== agentId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.display_name} · {a.provider ?? "—"} ({a.id.slice(0, 8)}…)
                      </option>
                    ))}
                </select>
              </div>
            </>
          )}
        </div>
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save routing"}
          </button>
          {saved && (
            <span className="text-sm text-green-600 dark:text-green-400">Saved.</span>
          )}
        </div>
      </section>
    </div>
  );
}
