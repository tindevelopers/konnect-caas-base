import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  TelnyxAssistant,
  TelnyxModelMetadata,
  TelnyxUpdateAssistantRequest,
} from "../types/assistants";
import { TelnyxAssistantsApi, useAssistantEditor } from "../headless/useAssistants";

type EditorTab =
  | "Agent"
  | "Voice"
  | "Integrations"
  | "Calling"
  | "Messaging"
  | "Widget"
  | "Advanced";

const editorTabs: EditorTab[] = [
  "Agent",
  "Voice",
  "Integrations",
  "Calling",
  "Messaging",
  "Widget",
  "Advanced",
];

const jsonIndent = 2;

function stringify(value: unknown) {
  return value ? JSON.stringify(value, null, jsonIndent) : "";
}

function parseJsonField(
  value: string,
  fieldName: string,
  expectArray = false
): { value?: unknown; error?: string } {
  if (!value.trim()) return { value: expectArray ? [] : {} };
  try {
    const parsed = JSON.parse(value);
    if (expectArray && !Array.isArray(parsed)) {
      return { error: `${fieldName} must be a JSON array.` };
    }
    if (!expectArray && Array.isArray(parsed)) {
      return { error: `${fieldName} must be a JSON object.` };
    }
    return { value: parsed };
  } catch {
    return { error: `${fieldName} contains invalid JSON.` };
  }
}

function toUpdatePayload(assistant: TelnyxAssistant): TelnyxUpdateAssistantRequest {
  const {
    name,
    model,
    instructions,
    description,
    tools,
    greeting,
    llm_api_key_ref,
    voice_settings,
    transcription,
    telephony_settings,
    messaging_settings,
    enabled_features,
    insight_settings,
    privacy_settings,
    dynamic_variables_webhook_url,
    dynamic_variables,
    widget_settings,
  } = assistant;

  return {
    name,
    model,
    instructions,
    description,
    tools,
    greeting,
    llm_api_key_ref,
    voice_settings,
    transcription,
    telephony_settings,
    messaging_settings,
    enabled_features,
    insight_settings,
    privacy_settings,
    dynamic_variables_webhook_url,
    dynamic_variables,
    widget_settings,
  };
}

export interface McpServerDescriptor {
  id?: string;
  name: string;
  server_url: string;
  secret_ref?: string | null;
  description?: string | null;
}

export interface AssistantEditorProps {
  api: TelnyxAssistantsApi;
  assistantId: string;
  onBack?: () => void;
  mcpServers?: McpServerDescriptor[];
  models?: TelnyxModelMetadata[];
}

export function AssistantEditor({
  api,
  assistantId,
  onBack,
  mcpServers,
  models,
}: AssistantEditorProps) {
  const { assistant, setAssistant, isLoading, isSaving, error, save } =
    useAssistantEditor(api, assistantId);
  const [activeTab, setActiveTab] = useState<EditorTab>("Agent");
  const [draft, setDraft] = useState<TelnyxAssistant | null>(null);
  const [jsonFields, setJsonFields] = useState<Record<string, string>>({});
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [voiceSettings, setVoiceSettings] = useState({
    provider: "",
    model: "",
    voice: "",
    voice_speed: "",
  });
  const [transcriptionModel, setTranscriptionModel] = useState("");
  const [enabledFeatures, setEnabledFeatures] = useState({
    telephony: false,
    messaging: false,
  });
  const [dynamicVariables, setDynamicVariables] = useState<
    Array<{ key: string; value: string }>
  >([{ key: "", value: "" }]);

  useEffect(() => {
    if (assistant) {
      setDraft(assistant);
      setJsonFields({
        tools: stringify(assistant.tools),
        telephony_settings: stringify(assistant.telephony_settings),
        messaging_settings: stringify(assistant.messaging_settings),
        widget_settings: stringify(assistant.widget_settings),
        privacy_settings: stringify(assistant.privacy_settings),
        insight_settings: stringify(assistant.insight_settings),
      });

      const voice = (assistant.voice_settings ?? {}) as Record<string, unknown>;
      setVoiceSettings({
        provider: typeof voice.provider === "string" ? voice.provider : "",
        model: typeof voice.model === "string" ? voice.model : "",
        voice: typeof voice.voice === "string" ? voice.voice : "",
        voice_speed:
          typeof voice.voice_speed === "number" || typeof voice.voice_speed === "string"
            ? String(voice.voice_speed)
            : "",
      });

      const transcription = (assistant.transcription ?? {}) as Record<string, unknown>;
      setTranscriptionModel(
        typeof transcription.model === "string" ? transcription.model : ""
      );

      const enabled = assistant.enabled_features ?? [];
      setEnabledFeatures({
        telephony: enabled.includes("telephony"),
        messaging: enabled.includes("messaging"),
      });

      const dynVars = assistant.dynamic_variables ?? {};
      const entries = Object.entries(dynVars).map(([key, value]) => ({
        key,
        value: String(value ?? ""),
      }));
      setDynamicVariables(entries.length > 0 ? entries : [{ key: "", value: "" }]);
    }
  }, [assistant]);

  const updateDraft = useCallback(
    (field: keyof TelnyxAssistant, value: string) => {
      if (!draft) return;
      const updated = { ...draft, [field]: value };
      setDraft(updated);
      setAssistant?.(updated);
    },
    [draft, setAssistant]
  );

  const handleJsonChange = useCallback((field: string, value: string) => {
    setJsonFields((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!draft) return;
    setJsonError(null);
    setSuccessMessage(null);

    const toolsResult = parseJsonField(jsonFields.tools ?? "", "Tools", true);
    const telephonyResult = parseJsonField(
      jsonFields.telephony_settings ?? "",
      "Telephony settings"
    );
    const messagingResult = parseJsonField(
      jsonFields.messaging_settings ?? "",
      "Messaging settings"
    );
    const widgetResult = parseJsonField(
      jsonFields.widget_settings ?? "",
      "Widget settings"
    );
    const privacyResult = parseJsonField(
      jsonFields.privacy_settings ?? "",
      "Privacy settings"
    );
    const insightResult = parseJsonField(
      jsonFields.insight_settings ?? "",
      "Insight settings"
    );

    const errors = [
      toolsResult.error,
      telephonyResult.error,
      messagingResult.error,
      widgetResult.error,
      privacyResult.error,
      insightResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      setJsonError(errors[0] ?? "Please fix JSON errors before saving.");
      return;
    }

    const enabled: string[] = [];
    if (enabledFeatures.telephony) enabled.push("telephony");
    if (enabledFeatures.messaging) enabled.push("messaging");

    const dynamicVarsObject = dynamicVariables
      .filter((entry) => entry.key.trim().length > 0)
      .reduce<Record<string, unknown>>((acc, entry) => {
        acc[entry.key.trim()] = entry.value;
        return acc;
      }, {});

      const payload: TelnyxUpdateAssistantRequest = {
      ...toUpdatePayload(draft),
      tools: toolsResult.value as Record<string, unknown>[],
      voice_settings: {
        provider: voiceSettings.provider || undefined,
        model: voiceSettings.model || undefined,
        voice: voiceSettings.voice || undefined,
          voice_speed:
            voiceSettings.voice_speed !== ""
              ? Number(voiceSettings.voice_speed)
              : undefined,
      },
      transcription: transcriptionModel ? { model: transcriptionModel } : {},
      telephony_settings: telephonyResult.value as Record<string, unknown>,
      messaging_settings: messagingResult.value as Record<string, unknown>,
      widget_settings: widgetResult.value as Record<string, unknown>,
      dynamic_variables: dynamicVarsObject,
      privacy_settings: privacyResult.value as Record<string, unknown>,
      insight_settings: insightResult.value as Record<string, unknown>,
      enabled_features: enabled,
    };

    const updated = await save(payload);
    if (updated) {
      setSuccessMessage("Assistant updated.");
    }
  }, [draft, jsonFields, save]);

  const appendWebhookTool = useCallback(
    (server: McpServerDescriptor) => {
      const toolsResult = parseJsonField(jsonFields.tools ?? "", "Tools", true);
      if (toolsResult.error) {
        setJsonError(toolsResult.error);
        return;
      }

      const existing = (toolsResult.value as Record<string, unknown>[]) ?? [];
      const slug = server.name.toLowerCase().replace(/\s+/g, "_");
      const tool = {
        type: "webhook",
        name: `mcp_${slug}`,
        description: server.description || `Call MCP server ${server.name}`,
        url: server.server_url,
        method: "POST",
      };

      setJsonFields((prev) => ({
        ...prev,
        tools: stringify([...existing, tool]),
      }));
      setJsonError(null);
    },
    [jsonFields.tools]
  );

  const tabs = useMemo(
    () =>
      editorTabs.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => setActiveTab(tab)}
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            activeTab === tab
              ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          {tab}
        </button>
      )),
    [activeTab]
  );

  if (isLoading || !draft) {
    return <div className="text-sm text-gray-500">Loading assistant...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">AI Assistant</p>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {draft.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-800">
        <div className="flex flex-wrap gap-2">{tabs}</div>
      </div>

      {(error || jsonError || successMessage) && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-800 dark:bg-gray-900">
          {error && <p className="text-red-600">{error}</p>}
          {jsonError && <p className="text-red-600">{jsonError}</p>}
          {successMessage && <p className="text-green-600">{successMessage}</p>}
        </div>
      )}

      {activeTab === "Agent" && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Name
            </label>
            <input
              value={draft.name}
              onChange={(e) => updateDraft("name", e.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Model
            </label>
            {models && models.length > 0 ? (
              <select
                value={draft.model}
                onChange={(e) => updateDraft("model", e.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.id}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={draft.model}
                onChange={(e) => updateDraft("model", e.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Instructions
            </label>
            <textarea
              value={draft.instructions}
              onChange={(e) => updateDraft("instructions", e.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              rows={6}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Greeting
            </label>
            <textarea
              value={draft.greeting ?? ""}
              onChange={(e) => updateDraft("greeting", e.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              rows={3}
            />
          </div>
        </div>
      )}

      {activeTab === "Voice" && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Voice Provider
            </label>
            <input
              value={voiceSettings.provider}
              onChange={(e) =>
                setVoiceSettings((prev) => ({ ...prev, provider: e.target.value }))
              }
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="telnyx"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Voice Model
            </label>
            <input
              value={voiceSettings.model}
              onChange={(e) =>
                setVoiceSettings((prev) => ({ ...prev, model: e.target.value }))
              }
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="NaturalHD"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Voice
            </label>
            <input
              value={voiceSettings.voice}
              onChange={(e) =>
                setVoiceSettings((prev) => ({ ...prev, voice: e.target.value }))
              }
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="astra"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Voice Speed
            </label>
            <input
              value={voiceSettings.voice_speed}
              onChange={(e) =>
                setVoiceSettings((prev) => ({ ...prev, voice_speed: e.target.value }))
              }
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Transcription Model
            </label>
            <input
              value={transcriptionModel}
              onChange={(e) => setTranscriptionModel(e.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="deepgram/flux"
            />
          </div>
        </div>
      )}

      {activeTab === "Integrations" && (
        <div className="space-y-4">
          {mcpServers && mcpServers.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-800 dark:bg-gray-900">
              <p className="font-medium text-gray-700 dark:text-gray-200">
                MCP Servers
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Add a webhook tool for any registered MCP server.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {mcpServers.map((server) => (
                  <button
                    key={server.id ?? server.name}
                    type="button"
                    onClick={() => appendWebhookTool(server)}
                    className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-white dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    Add {server.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Tools (JSON Array)
            </label>
            <textarea
              value={jsonFields.tools ?? ""}
              onChange={(e) => handleJsonChange("tools", e.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono dark:border-gray-700 dark:bg-gray-900"
              rows={8}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              LLM API Key Reference
            </label>
            <input
              value={draft.llm_api_key_ref ?? ""}
              onChange={(e) => updateDraft("llm_api_key_ref", e.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
        </div>
      )}

      {activeTab === "Calling" && (
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Telephony Settings (JSON)
          </label>
          <textarea
            value={jsonFields.telephony_settings ?? ""}
            onChange={(e) => handleJsonChange("telephony_settings", e.target.value)}
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono dark:border-gray-700 dark:bg-gray-900"
            rows={10}
          />
        </div>
      )}

      {activeTab === "Messaging" && (
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Messaging Settings (JSON)
          </label>
          <textarea
            value={jsonFields.messaging_settings ?? ""}
            onChange={(e) => handleJsonChange("messaging_settings", e.target.value)}
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono dark:border-gray-700 dark:bg-gray-900"
            rows={10}
          />
        </div>
      )}

      {activeTab === "Widget" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/30">
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Widget for unauthenticated web calls
            </p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              Enables users to interact with your AI assistant directly from your
              website without authentication. Requires telephony and support for
              unauthenticated web calls.
            </p>
            <div className="mt-4 flex items-center gap-4">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={
                    enabledFeatures.telephony &&
                    (parseJsonField(
                      jsonFields.telephony_settings ?? "",
                      "telephony"
                    ).value as Record<string, unknown>)?.supports_unauthenticated_web_calls ===
                      true
                  }
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setEnabledFeatures((prev) => ({
                      ...prev,
                      telephony: checked || prev.telephony,
                    }));
                    const telephonyResult = parseJsonField(
                      jsonFields.telephony_settings ?? "",
                      "Telephony settings"
                    );
                    const current =
                      (telephonyResult.value as Record<string, unknown>) ?? {};
                    handleJsonChange(
                      "telephony_settings",
                      stringify({
                        ...current,
                        supports_unauthenticated_web_calls: checked,
                      })
                    );
                  }}
                />
                Enable widget for web calls
              </label>
              <button
                type="button"
                onClick={() => {
                  setEnabledFeatures((prev) => ({ ...prev, telephony: true }));
                  const telephonyResult = parseJsonField(
                    jsonFields.telephony_settings ?? "",
                    "Telephony settings"
                  );
                  const current =
                    (telephonyResult.value as Record<string, unknown>) ?? {};
                  handleJsonChange(
                    "telephony_settings",
                    stringify({
                      ...current,
                      supports_unauthenticated_web_calls: true,
                    })
                  );
                }}
                className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-100 dark:hover:bg-amber-900"
              >
                Enable now
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Widget Settings (JSON)
            </label>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Appearance and behavior (theme, start_call_text, default_state,
              etc.).
            </p>
            <textarea
              value={jsonFields.widget_settings ?? ""}
              onChange={(e) => handleJsonChange("widget_settings", e.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono dark:border-gray-700 dark:bg-gray-900"
              rows={10}
              placeholder='{"theme": "light", "default_state": "collapsed"}'
            />
          </div>
        </div>
      )}

      {activeTab === "Advanced" && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Enabled Features
            </label>
            <div className="mt-2 flex items-center gap-6 text-sm text-gray-600 dark:text-gray-300">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={enabledFeatures.telephony}
                  onChange={(e) =>
                    setEnabledFeatures((prev) => ({ ...prev, telephony: e.target.checked }))
                  }
                />
                Telephony
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={enabledFeatures.messaging}
                  onChange={(e) =>
                    setEnabledFeatures((prev) => ({
                      ...prev,
                      messaging: e.target.checked,
                    }))
                  }
                />
                Messaging
              </label>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Dynamic Variables Webhook URL
            </label>
            <input
              value={draft.dynamic_variables_webhook_url ?? ""}
              onChange={(e) => updateDraft("dynamic_variables_webhook_url", e.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Dynamic Variables
            </label>
            <div className="mt-2 space-y-2">
              {dynamicVariables.map((entry, index) => (
                <div key={`${entry.key}-${index}`} className="flex gap-2">
                  <input
                    value={entry.key}
                    onChange={(e) =>
                      setDynamicVariables((prev) =>
                        prev.map((item, idx) =>
                          idx === index ? { ...item, key: e.target.value } : item
                        )
                      )
                    }
                    placeholder="key"
                    className="w-1/3 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                  />
                  <input
                    value={entry.value}
                    onChange={(e) =>
                      setDynamicVariables((prev) =>
                        prev.map((item, idx) =>
                          idx === index ? { ...item, value: e.target.value } : item
                        )
                      )
                    }
                    placeholder="value"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setDynamicVariables((prev) =>
                        prev.filter((_, idx) => idx !== index)
                      )
                    }
                    className="rounded-lg border border-gray-200 px-2 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setDynamicVariables((prev) => [...prev, { key: "", value: "" }])
                }
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Add variable
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Privacy Settings (JSON)
            </label>
            <textarea
              value={jsonFields.privacy_settings ?? ""}
              onChange={(e) => handleJsonChange("privacy_settings", e.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono dark:border-gray-700 dark:bg-gray-900"
              rows={6}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Insight Settings (JSON)
            </label>
            <textarea
              value={jsonFields.insight_settings ?? ""}
              onChange={(e) => handleJsonChange("insight_settings", e.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono dark:border-gray-700 dark:bg-gray-900"
              rows={6}
            />
          </div>
        </div>
      )}
    </div>
  );
}
