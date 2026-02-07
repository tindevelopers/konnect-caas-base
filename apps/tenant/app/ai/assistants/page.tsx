"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AssistantsList } from "@tinadmin/telnyx-ai-platform";
import { assistantsApi } from "../telnyxApis";

export default function AiAssistantsPage() {
  const router = useRouter();
  const [showImport, setShowImport] = useState(false);
  const [importPayload, setImportPayload] = useState({
    provider: "",
    api_key_ref: "",
    import_ids: "",
  });
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async () => {
    setImportError(null);
    if (!importPayload.provider || !importPayload.api_key_ref) {
      setImportError("Provider and API key reference are required.");
      return;
    }
    setIsImporting(true);
    try {
      await assistantsApi.importAssistants({
        provider: importPayload.provider,
        api_key_ref: importPayload.api_key_ref,
        import_ids: importPayload.import_ids
          ? importPayload.import_ids.split(",").map((id) => id.trim())
          : undefined,
      });
      setShowImport(false);
      setImportPayload({ provider: "", api_key_ref: "", import_ids: "" });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to import assistants.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <AssistantsList
        api={assistantsApi}
        onCreate={() => router.push("/ai/assistants/create")}
        onImport={() => setShowImport(true)}
        onSelectAssistant={(assistant) => router.push(`/ai/assistants/${assistant.id}`)}
      />

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Import assistants
            </h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Provider
                </label>
                <input
                  value={importPayload.provider}
                  onChange={(e) =>
                    setImportPayload((prev) => ({ ...prev, provider: e.target.value }))
                  }
                  placeholder="e.g. vapi"
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  API Key Reference
                </label>
                <input
                  value={importPayload.api_key_ref}
                  onChange={(e) =>
                    setImportPayload((prev) => ({ ...prev, api_key_ref: e.target.value }))
                  }
                  placeholder="integration secret identifier"
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Import IDs (optional)
                </label>
                <input
                  value={importPayload.import_ids}
                  onChange={(e) =>
                    setImportPayload((prev) => ({ ...prev, import_ids: e.target.value }))
                  }
                  placeholder="id1,id2,id3"
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                />
              </div>
              {importError && <p className="text-sm text-red-600">{importError}</p>}
            </div>
            <div className="mt-6 flex items-center gap-2">
              <button
                type="button"
                onClick={handleImport}
                disabled={isImporting}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                {isImporting ? "Importing..." : "Import"}
              </button>
              <button
                type="button"
                onClick={() => setShowImport(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
