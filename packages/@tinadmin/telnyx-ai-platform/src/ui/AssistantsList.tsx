import React, { useState } from "react";
import { useAssistantsList, TelnyxAssistantsApi } from "../headless/useAssistants";
import { TelnyxAssistant } from "../types/assistants";

export interface AssistantsListProps {
  api: TelnyxAssistantsApi;
  onCreate?: () => void;
  onImport?: () => void;
  onSelectAssistant?: (assistant: TelnyxAssistant) => void;
}

export function AssistantsList({
  api,
  onCreate,
  onImport,
  onSelectAssistant,
}: AssistantsListProps) {
  const { data, isLoading, error, refresh } = useAssistantsList(api);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async (assistant: TelnyxAssistant) => {
    if (
      !window.confirm(
        `Delete "${assistant.name}"? This assistant will be removed and cannot be undone.`
      )
    ) {
      return;
    }
    setDeleteError(null);
    setDeletingId(assistant.id);
    try {
      await api.deleteAssistant(assistant.id);
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete assistant.";
      setDeleteError(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            AI Assistants
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create and manage AI assistants.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onImport && (
            <button
              type="button"
              onClick={onImport}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Import Assistants
            </button>
          )}
          {onCreate && (
            <button
              type="button"
              onClick={onCreate}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Create New Assistant
            </button>
          )}
          <button
            type="button"
            onClick={refresh}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Refresh
          </button>
        </div>
      </div>

      {deleteError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400"
        >
          {deleteError}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-xs uppercase text-gray-500 dark:border-gray-800">
              <tr>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">ID</th>
                <th className="px-6 py-3 font-medium">Model</th>
                <th className="px-6 py-3 font-medium">Created</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td className="px-6 py-6 text-gray-500" colSpan={5}>
                    Loading assistants...
                  </td>
                </tr>
              )}
              {!isLoading && error && (
                <tr>
                  <td className="px-6 py-6 text-red-600 dark:text-red-400" colSpan={5}>
                    <div className="space-y-1">
                      <div className="font-medium">Error loading assistants:</div>
                      <div className="text-sm">{error}</div>
                    </div>
                  </td>
                </tr>
              )}
              {!isLoading && !error && data.length === 0 && (
                <tr>
                  <td className="px-6 py-6 text-gray-500" colSpan={5}>
                    No assistants found yet.
                  </td>
                </tr>
              )}
              {!isLoading &&
                !error &&
                data.map((assistant) => (
                  <tr
                    key={assistant.id}
                    className="border-b border-gray-100 last:border-b-0 dark:border-gray-800"
                  >
                    <td className="px-6 py-4 text-gray-900 dark:text-white">
                      {assistant.name}
                    </td>
                    <td className="px-6 py-4 text-gray-500">{assistant.id}</td>
                    <td className="px-6 py-4 text-gray-500">{assistant.model}</td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(assistant.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => onSelectAssistant?.(assistant)}
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          View settings
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(assistant)}
                          disabled={deletingId === assistant.id}
                          className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                        >
                          {deletingId === assistant.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
