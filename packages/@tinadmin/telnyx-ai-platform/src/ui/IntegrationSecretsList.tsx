import React, { useState } from "react";
import {
  TelnyxCreateIntegrationSecretRequest,
  TelnyxIntegrationSecret,
} from "../types/integrationSecrets";
import {
  TelnyxIntegrationSecretsApi,
  useIntegrationSecrets,
} from "../headless/useIntegrationSecrets";

export interface IntegrationSecretsListProps {
  api: TelnyxIntegrationSecretsApi;
}

export function IntegrationSecretsList({ api }: IntegrationSecretsListProps) {
  const { data, isLoading, isSaving, error, create, refresh } =
    useIntegrationSecrets(api);
  const [form, setForm] = useState<TelnyxCreateIntegrationSecretRequest>({
    identifier: "",
    secret_value: "",
    description: "",
  });
  const [showForm, setShowForm] = useState(false);

  const handleCreate = async () => {
    if (!form.identifier || !form.secret_value) return;
    const created = await create(form);
    if (created) {
      setForm({ identifier: "", secret_value: "", description: "" });
      setShowForm(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Integration Secrets
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage Telnyx integration secrets for external providers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            New Secret
          </button>
          <button
            type="button"
            onClick={refresh}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Refresh
          </button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            New Integration Secret
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Identifier
              </label>
              <input
                value={form.identifier}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, identifier: e.target.value }))
                }
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Secret Value
              </label>
              <input
                type="password"
                value={form.secret_value}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, secret_value: e.target.value }))
                }
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Description (optional)
              </label>
              <input
                value={form.description ?? ""}
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
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-gray-200 text-xs uppercase text-gray-500 dark:border-gray-800">
            <tr>
              <th className="px-6 py-3 font-medium">Identifier</th>
              <th className="px-6 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="px-6 py-6 text-gray-500" colSpan={2}>
                  Loading secrets...
                </td>
              </tr>
            )}
            {!isLoading && error && (
              <tr>
                <td className="px-6 py-6 text-red-600" colSpan={2}>
                  {error}
                </td>
              </tr>
            )}
            {!isLoading && !error && data.length === 0 && (
              <tr>
                <td className="px-6 py-6 text-gray-500" colSpan={2}>
                  No integration secrets found.
                </td>
              </tr>
            )}
            {!isLoading &&
              !error &&
              data.map((secret: TelnyxIntegrationSecret, index) => (
                <tr
                  key={`${secret.identifier}-${index}`}
                  className="border-b border-gray-100 last:border-b-0 dark:border-gray-800"
                >
                  <td className="px-6 py-4 text-gray-900 dark:text-white">
                    {secret.identifier}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {secret.created_at
                      ? new Date(secret.created_at).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
