import React from "react";
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            AI Assistants
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create and manage Telnyx AI assistants.
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
                  <td className="px-6 py-6 text-red-600" colSpan={5}>
                    {error}
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
                      <button
                        type="button"
                        onClick={() => onSelectAssistant?.(assistant)}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        View settings
                      </button>
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
