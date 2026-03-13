import React, { useState } from "react";
import {
  TelnyxCreateAssistantTestRequest,
  TelnyxAssistantTest,
} from "../types/tests";
import { TelnyxAssistantTestsApi, useAssistantTests } from "../headless/useAssistantTests";

export interface AssistantTestsListProps {
  api: TelnyxAssistantTestsApi;
}

const defaultRubric = JSON.stringify(
  [
    {
      name: "GoalCompletion",
      criteria: "Did the assistant complete the task successfully?",
    },
  ],
  null,
  2
);

export function AssistantTestsList({ api }: AssistantTestsListProps) {
  const { data, isLoading, isSaving, error, create, triggerRun, refresh } =
    useAssistantTests(api);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TelnyxCreateAssistantTestRequest>({
    name: "",
    destination: "",
    instructions: "",
    rubric: [],
    telnyx_conversation_channel: "web_chat",
  });
  const [rubricText, setRubricText] = useState(defaultRubric);

  const handleCreate = async () => {
    try {
      const rubric = JSON.parse(rubricText);
      const payload: TelnyxCreateAssistantTestRequest = {
        ...form,
        rubric,
      };
      const created = await create(payload);
      if (created) {
        setShowForm(false);
        setForm({
          name: "",
          destination: "",
          instructions: "",
          rubric: [],
          telnyx_conversation_channel: "web_chat",
        });
        setRubricText(defaultRubric);
      }
    } catch {
      // handled via error in hook
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            AI Tests
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create and run tests for AI assistants.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            New Test
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
            Create AI Test
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Test Name
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Destination
              </label>
              <input
                value={form.destination}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, destination: e.target.value }))
                }
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Channel
              </label>
              <select
                value={form.telnyx_conversation_channel}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    telnyx_conversation_channel: e.target.value,
                  }))
                }
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="web_chat">web_chat</option>
                <option value="sms">sms</option>
                <option value="phone_call">phone_call</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Instructions
              </label>
              <textarea
                value={form.instructions}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, instructions: e.target.value }))
                }
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                rows={4}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Rubric (JSON)
              </label>
              <textarea
                value={rubricText}
                onChange={(e) => setRubricText(e.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono dark:border-gray-700 dark:bg-gray-900"
                rows={6}
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
              {isSaving ? "Saving..." : "Create Test"}
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
              <th className="px-6 py-3 font-medium">Name</th>
              <th className="px-6 py-3 font-medium">Channel</th>
              <th className="px-6 py-3 font-medium">Created</th>
              <th className="px-6 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="px-6 py-6 text-gray-500" colSpan={4}>
                  Loading tests...
                </td>
              </tr>
            )}
            {!isLoading && error && (
              <tr>
                <td className="px-6 py-6 text-red-600" colSpan={4}>
                  {error}
                </td>
              </tr>
            )}
            {!isLoading && !error && data.length === 0 && (
              <tr>
                <td className="px-6 py-6 text-gray-500" colSpan={4}>
                  No tests found.
                </td>
              </tr>
            )}
            {!isLoading &&
              !error &&
              data.map((test: TelnyxAssistantTest) => (
                <tr
                  key={test.test_id}
                  className="border-b border-gray-100 last:border-b-0 dark:border-gray-800"
                >
                  <td className="px-6 py-4 text-gray-900 dark:text-white">
                    {test.name}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {test.telnyx_conversation_channel}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(test.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      type="button"
                      onClick={() => triggerRun(test.test_id)}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      Run test
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
