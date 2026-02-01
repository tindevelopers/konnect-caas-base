"use client";

import React, { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { useTenant } from "@/core/multi-tenancy";

interface Agent {
  id: string;
  name: string;
  type: "voice" | "chat";
  is_active: boolean;
  description?: string;
  external_id?: string;
  configuration?: { model?: string; language?: string };
  created_at: string;
}

export default function ChatAgentList() {
  const { tenant } = useTenant();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ type: "chat" });
      const res = await fetch(`/api/agents?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents ?? []);
      } else {
        setAgents([]);
      }
    } catch {
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, [tenant?.id]);

  if (loading) {
    return (
      <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
        <p className="text-gray-500 dark:text-gray-400">Loading agents...</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
      <div className="mb-6 flex flex-col gap-4 border-b border-gray-200 px-6 py-4 dark:border-white/[0.05]">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Chat Agents
          </h2>
          <Button size="sm" disabled={!tenant?.id}>
            Create Agent
          </Button>
        </div>
      </div>

      <div className="max-w-full overflow-x-auto">
        <Table>
          <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
            <TableRow>
              <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                Agent Name
              </TableCell>
              <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                Description
              </TableCell>
              <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                Model & Language
              </TableCell>
              <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                Status
              </TableCell>
              <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                Created
              </TableCell>
              <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                Actions
              </TableCell>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
            {agents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-5 py-8 text-center">
                  <div className="space-y-3">
                    <p className="text-gray-500 dark:text-gray-400">
                      No chat agents yet. Connect Telnyx and create agents to get started.
                    </p>
                    <Button size="sm" disabled={!tenant?.id}>
                      Create New Agent
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              agents.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell className="px-5 py-4 text-start">
                    <span className="block font-medium text-gray-800 text-theme-sm dark:text-white/90">
                      {agent.name}
                    </span>
                    <span className="block text-gray-500 text-theme-xs dark:text-gray-400">
                      ID: {agent.external_id ?? agent.id.slice(0, 8)}...
                    </span>
                  </TableCell>
                  <TableCell className="px-5 py-4 text-start text-gray-500 text-theme-sm dark:text-gray-400">
                    {agent.description ?? "—"}
                  </TableCell>
                  <TableCell className="px-5 py-4 text-start">
                    <span className="block text-gray-800 text-theme-sm dark:text-white/90">
                      {agent.configuration?.model ?? "—"}
                    </span>
                    <span className="block text-gray-500 text-theme-xs dark:text-gray-400">
                      {agent.configuration?.language ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="px-5 py-4 text-start">
                    <Badge
                      size="sm"
                      color={agent.is_active ? "success" : "error"}
                    >
                      {agent.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-5 py-4 text-start text-gray-500 text-theme-sm dark:text-gray-400">
                    {new Date(agent.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="px-5 py-4 text-start">
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" title="Test">
                        Test
                      </Button>
                      <Button size="sm" variant="outline" title="Edit">
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" title="Delete">
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
