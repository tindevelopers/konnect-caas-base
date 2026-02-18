"use client";

import React, { useEffect, useState } from "react";
import {
  createMcpServerAction,
  deleteMcpServerAction,
  listMcpServersAction,
  McpServerRecord,
} from "@/app/actions/telnyx/mcpServers";

export default function McpServersPage() {
  const [servers, setServers] = useState<McpServerRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    server_url: "",
    secret_ref: "",
    description: "",
  });

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listMcpServersAction();
      setServers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load MCP servers.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreate = async () => {
    if (!form.name || !form.server_url) {
      setError("Name and server URL are required.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const created = await createMcpServerAction({
        name: form.name,
        server_url: form.server_url,
        secret_ref: form.secret_ref || null,
        description: form.description || null,
      });
      setServers((prev) => [created, ...prev]);
      setForm({ name: "", server_url: "", secret_ref: "", description: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create MCP server.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsSaving(true);
    setError(null);
    try {
      await deleteMcpServerAction(id);
      setServers((prev) => prev.filter((server) => server.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete MCP server.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          MCP Servers
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Register MCP endpoints and attach them to assistants using agent tools.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Add MCP Server
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Name
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Server URL
            </label>
            <input
              value={form.server_url}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, server_url: e.target.value }))
              }
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Secret Ref (optional)
            </label>
            <input
              value={form.secret_ref}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, secret_ref: e.target.value }))
              }
              placeholder="integration secret identifier"
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Description (optional)
            </label>
            <input
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={handleCreate}
            disabled={isSaving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Refresh
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-gray-200 text-xs uppercase text-gray-500 dark:border-gray-800">
            <tr>
              <th className="px-6 py-3 font-medium">Name</th>
              <th className="px-6 py-3 font-medium">Server URL</th>
              <th className="px-6 py-3 font-medium">Secret Ref</th>
              <th className="px-6 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="px-6 py-6 text-gray-500" colSpan={4}>
                  Loading MCP servers...
                </td>
              </tr>
            )}
            {!isLoading && !error && servers.length === 0 && (
              <tr>
                <td className="px-6 py-6 text-gray-500" colSpan={4}>
                  No MCP servers registered yet.
                </td>
              </tr>
            )}
            {!isLoading &&
              servers.map((server) => (
                <tr
                  key={server.id}
                  className="border-b border-gray-100 last:border-b-0 dark:border-gray-800"
                >
                  <td className="px-6 py-4 text-gray-900 dark:text-white">
                    {server.name}
                  </td>
                  <td className="px-6 py-4 text-gray-500">{server.server_url}</td>
                  <td className="px-6 py-4 text-gray-500">
                    {server.secret_ref || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      type="button"
                      onClick={() => handleDelete(server.id)}
                      className="text-sm font-medium text-red-600 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
