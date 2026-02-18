import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  TelnyxAssistant,
  TelnyxModelMetadata,
  TelnyxUpdateAssistantRequest,
} from "../types/assistants";
import { TelnyxAssistantsApi, useAssistantEditor } from "../headless/useAssistants";
import type { TelnyxIntegration } from "../types/integrations";
import type { TelnyxCreateIntegrationSecretRequest } from "../types/integrationSecrets";

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

type IntegrationProviderKey = "shopify" | "notion" | "microsoft_teams";

type IntegrationConnectDraft = {
  provider: IntegrationProviderKey;
  step: "credentials" | "tools";
  shopDomain?: string;
  accessToken?: string;
  allowedTools: string[];
  error?: string | null;
  isSaving?: boolean;
};

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
  integrations?: TelnyxIntegration[];
  createIntegrationSecret?: (
    payload: TelnyxCreateIntegrationSecretRequest
  ) => Promise<unknown>;
  testAssistantTool?: (params: { assistantId: string; toolId: string }) => Promise<unknown>;
}

export function AssistantEditor({
  api,
  assistantId,
  onBack,
  mcpServers,
  models,
  integrations,
  createIntegrationSecret,
  testAssistantTool,
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
  const [integrationDraft, setIntegrationDraft] = useState<IntegrationConnectDraft | null>(
    null
  );
  const [toolTestResult, setToolTestResult] = useState<string | null>(null);

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

  const availableIntegrations = useMemo(() => {
    const fromTelnyx = integrations ?? [];
    // If Telnyx API doesn't return these providers yet, keep a minimal fallback list.
    const fallback: TelnyxIntegration[] = [
      {
        id: "shopify",
        name: "shopify",
        display_name: "Shopify",
        description: "E-commerce operations (orders, customers, products).",
        logo_url: "",
        status: "disconnected",
        available_tools: [],
      },
      {
        id: "notion",
        name: "notion",
        display_name: "Notion",
        description: "Knowledge and workspace documents (pages, databases).",
        logo_url: "",
        status: "disconnected",
        available_tools: [],
      },
      {
        id: "microsoft_teams",
        name: "microsoft_teams",
        display_name: "Microsoft Teams",
        description: "Team collaboration and messaging.",
        logo_url: "",
        status: "disconnected",
        available_tools: [],
      },
    ];

    const merged = [...fromTelnyx];
    for (const item of fallback) {
      if (!merged.some((x) => x.name === item.name)) merged.push(item);
    }

    const supported = new Set<IntegrationProviderKey>([
      "shopify",
      "notion",
      "microsoft_teams",
    ]);
    return merged.filter((x) => supported.has(x.name as IntegrationProviderKey));
  }, [integrations]);

  const detectedIntegrationTools = useMemo(() => {
    const tools = (draft?.tools ?? []) as Array<Record<string, unknown>>;
    const matches = tools
      .map((tool) => {
        const provider =
          (typeof tool.provider === "string" && tool.provider) ||
          (typeof tool.integration === "string" && tool.integration) ||
          (typeof tool.name === "string" && tool.name) ||
          "";
        const normalized = provider.toLowerCase();
        const detected: IntegrationProviderKey | null =
          normalized.includes("shopify")
            ? "shopify"
            : normalized.includes("notion")
              ? "notion"
              : normalized.includes("microsoft") || normalized.includes("teams")
                ? "microsoft_teams"
                : null;
        if (!detected) return null;
        const toolId =
          (typeof tool.tool_id === "string" && tool.tool_id) ||
          (typeof tool.id === "string" && tool.id) ||
          (typeof tool.toolId === "string" && tool.toolId) ||
          null;
        return { provider: detected, tool, toolId };
      })
      .filter(Boolean) as Array<{
      provider: IntegrationProviderKey;
      tool: Record<string, unknown>;
      toolId: string | null;
    }>;

    const byProvider = new Map<IntegrationProviderKey, (typeof matches)[number]>();
    for (const match of matches) {
      if (!byProvider.has(match.provider)) byProvider.set(match.provider, match);
    }
    return byProvider;
  }, [draft?.tools]);

  const startConnectIntegration = useCallback(
    (provider: IntegrationProviderKey) => {
      const candidate = availableIntegrations.find((i) => i.name === provider);
      const tools = candidate?.available_tools ?? [];
      setIntegrationDraft({
        provider,
        step: "credentials",
        allowedTools: tools.length > 0 ? tools.slice(0, 10) : [],
        error: null,
        isSaving: false,
      });
      setToolTestResult(null);
    },
    [availableIntegrations]
  );

  const disconnectIntegration = useCallback(
    async (provider: IntegrationProviderKey) => {
      if (!draft) return;
      setJsonError(null);
      setSuccessMessage(null);
      setToolTestResult(null);

      const currentTools = (draft.tools ?? []) as Array<Record<string, unknown>>;
      const nextTools = currentTools.filter((tool) => {
        const haystack = JSON.stringify(tool).toLowerCase();
        if (provider === "microsoft_teams") {
          return !(haystack.includes("microsoft") || haystack.includes("teams"));
        }
        return !haystack.includes(provider);
      });

      const payload: TelnyxUpdateAssistantRequest = {
        ...toUpdatePayload(draft),
        tools: nextTools,
      };
      const updated = await save(payload);
      if (updated) {
        setSuccessMessage(`${provider} disconnected.`);
      }
    },
    [draft, save]
  );

  const runToolTest = useCallback(
    async (provider: IntegrationProviderKey) => {
      if (!testAssistantTool) {
        setToolTestResult("Tool test is not configured in this deployment.");
        return;
      }
      const match = detectedIntegrationTools.get(provider);
      const toolId = match?.toolId;
      if (!toolId) {
        setToolTestResult(
          "No tool ID found for this integration on the assistant. Save and refresh, or connect in the provider portal once to establish the tool."
        );
        return;
      }
      setToolTestResult(null);
      try {
        await testAssistantTool({ assistantId, toolId });
        setToolTestResult("Success: tool test request accepted.");
      } catch (err) {
        setToolTestResult(err instanceof Error ? err.message : "Tool test failed.");
      }
    },
    [assistantId, detectedIntegrationTools, testAssistantTool]
  );

  const finishIntegrationConnect = useCallback(async () => {
    if (!draft || !integrationDraft) return;
    if (!createIntegrationSecret) {
      setIntegrationDraft((prev) =>
        prev ? { ...prev, error: "Integration secrets API is not configured." } : prev
      );
      return;
    }

    const provider = integrationDraft.provider;
    if (provider === "microsoft_teams") {
      setIntegrationDraft((prev) =>
        prev
          ? {
              ...prev,
              error: "Microsoft Teams connection requires OAuth and is not enabled yet.",
            }
          : prev
      );
      return;
    }

    const shopDomain = (integrationDraft.shopDomain ?? "").trim();
    const accessToken = (integrationDraft.accessToken ?? "").trim();

    if (provider === "shopify" && !shopDomain) {
      setIntegrationDraft((prev) => (prev ? { ...prev, error: "Shop domain is required." } : prev));
      return;
    }
    if (!accessToken) {
      setIntegrationDraft((prev) => (prev ? { ...prev, error: "Access token is required." } : prev));
      return;
    }

    setIntegrationDraft((prev) => (prev ? { ...prev, isSaving: true, error: null } : prev));
    setJsonError(null);
    setSuccessMessage(null);
    setToolTestResult(null);

    try {
      const identifier = `${provider}_${assistantId}_${Date.now()}`;
      await createIntegrationSecret({
        identifier,
        secret_value: accessToken,
        description: `Assistant ${assistantId} ${provider} token`,
      });

      // NOTE: This tool object shape is provisional. We will align it to the exact
      // shape returned by Telnyx once we inspect `assistant.tools` after a portal connect.
      const tool: Record<string, unknown> = {
        type: "integration",
        provider,
        secret_identifier: identifier,
        allowed_tools: integrationDraft.allowedTools,
        ...(provider === "shopify" ? { shop_domain: shopDomain } : {}),
      };

      const currentTools = (draft.tools ?? []) as Array<Record<string, unknown>>;
      const withoutProvider = currentTools.filter((t) => {
        const haystack = JSON.stringify(t).toLowerCase();
        return provider === "shopify"
          ? !haystack.includes("shopify")
          : provider === "notion"
            ? !haystack.includes("notion")
            : true;
      });
      const nextTools = [...withoutProvider, tool];

      const payload: TelnyxUpdateAssistantRequest = {
        ...toUpdatePayload(draft),
        tools: nextTools,
      };
      const updated = await save(payload);
      if (updated) {
        setSuccessMessage(`${provider} connected (saved to assistant tools).`);
        setIntegrationDraft(null);
      } else {
        setIntegrationDraft((prev) =>
          prev ? { ...prev, error: "Failed to save assistant." } : prev
        );
      }
    } catch (err) {
      setIntegrationDraft((prev) =>
        prev ? { ...prev, error: err instanceof Error ? err.message : "Failed to connect." } : prev
      );
    } finally {
      setIntegrationDraft((prev) => (prev ? { ...prev, isSaving: false } : prev));
    }
  }, [assistantId, createIntegrationSecret, draft, integrationDraft, save]);


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

      const voice =
        voiceSettings.voice?.trim() ||
        (draft.voice_settings as Record<string, unknown>)?.voice;
      const payload: TelnyxUpdateAssistantRequest = {
      ...toUpdatePayload(draft),
      tools: toolsResult.value as Record<string, unknown>[],
      voice_settings:
        typeof voice === "string" && voice
          ? {
              provider: voiceSettings.provider || undefined,
              model: voiceSettings.model || undefined,
              voice,
              voice_speed:
                voiceSettings.voice_speed !== ""
                  ? Number(voiceSettings.voice_speed)
                  : undefined,
            }
          : (draft.voice_settings as Record<string, unknown>),
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
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  Connected Integrations
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Tools attached to this assistant (provider-managed).
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(["shopify", "notion", "microsoft_teams"] as IntegrationProviderKey[]).map(
                (provider) => {
                  const connected = detectedIntegrationTools.has(provider);
                  const meta = availableIntegrations.find((i) => i.name === provider);
                  return (
                    <div
                      key={`connected-${provider}`}
                      className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                            {meta?.display_name ?? provider}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                            {meta?.description ?? ""}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            connected
                              ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          }`}
                        >
                          {connected ? "Connected" : "Not connected"}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={!connected}
                          onClick={() => runToolTest(provider)}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                          Test tools
                        </button>
                        {connected ? (
                          <button
                            type="button"
                            onClick={() => disconnectIntegration(provider)}
                            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-900/20"
                          >
                            Disconnect
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startConnectIntegration(provider)}
                            className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                          >
                            Connect
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>

            {toolTestResult && (
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
                {toolTestResult}
              </p>
            )}
          </div>

          {mcpServers && mcpServers.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm dark:border-gray-800 dark:bg-gray-900">
              <p className="font-semibold text-gray-900 dark:text-white">MCP Servers</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Optional: add webhook tools for any registered MCP server.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {mcpServers.map((server) => (
                  <button
                    key={server.id ?? server.name}
                    type="button"
                    onClick={() => appendWebhookTool(server)}
                    className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    Add {server.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <details className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <summary className="cursor-pointer text-sm font-semibold text-gray-900 dark:text-white">
              Advanced: Tools JSON
            </summary>
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:border-gray-800 dark:bg-gray-950/20 dark:text-gray-300">
                <p className="font-semibold">Detected integration tool IDs</p>
                <ul className="mt-1 space-y-1">
                  {(["shopify", "notion", "microsoft_teams"] as IntegrationProviderKey[]).map(
                    (provider) => {
                      const match = detectedIntegrationTools.get(provider);
                      return (
                        <li key={`detected-${provider}`}>
                          <span className="font-mono">{provider}</span>:{" "}
                          <span className="font-mono">
                            {match?.toolId ?? "—"}
                          </span>
                        </li>
                      );
                    }
                  )}
                </ul>
                <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                  If tool IDs are missing, connect once in the provider portal and refresh.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tools (JSON Array)
                </label>
                <textarea
                  value={jsonFields.tools ?? ""}
                  onChange={(e) => handleJsonChange("tools", e.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono dark:border-gray-700 dark:bg-gray-900"
                  rows={10}
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
          </details>

          {integrationDraft && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
              <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-lg dark:bg-gray-900">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Connect {integrationDraft.provider}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Enter your account details and choose allowed tools.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIntegrationDraft(null)}
                    className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    ×
                  </button>
                </div>

                <div className="mt-6 space-y-4">
                  {integrationDraft.provider === "shopify" && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Shop domain
                        </label>
                        <input
                          value={integrationDraft.shopDomain ?? ""}
                          onChange={(e) =>
                            setIntegrationDraft((prev) =>
                              prev ? { ...prev, shopDomain: e.target.value } : prev
                            )
                          }
                          placeholder="example.myshopify.com"
                          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Access token
                        </label>
                        <input
                          type="password"
                          value={integrationDraft.accessToken ?? ""}
                          onChange={(e) =>
                            setIntegrationDraft((prev) =>
                              prev ? { ...prev, accessToken: e.target.value } : prev
                            )
                          }
                          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                        />
                      </div>
                    </div>
                  )}

                  {integrationDraft.provider === "notion" && (
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Notion integration token
                      </label>
                      <input
                        type="password"
                        value={integrationDraft.accessToken ?? ""}
                        onChange={(e) =>
                          setIntegrationDraft((prev) =>
                            prev ? { ...prev, accessToken: e.target.value } : prev
                          )
                        }
                        className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                      />
                    </div>
                  )}

                  {integrationDraft.provider === "microsoft_teams" && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                      Microsoft Teams requires an OAuth flow and is not enabled yet in this UI.
                      For now, connect it in the provider portal and we will display it here.
                    </div>
                  )}

                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/20">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      Allowed tools
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Select which tool calls this assistant can use for this integration.
                    </p>
                    <div className="mt-3 max-h-64 space-y-2 overflow-auto rounded-lg border border-gray-200 bg-white p-3 text-sm dark:border-gray-800 dark:bg-gray-900">
                      {(availableIntegrations.find((i) => i.name === integrationDraft.provider)
                        ?.available_tools ?? []
                      ).map((toolName) => {
                        const checked = integrationDraft.allowedTools.includes(toolName);
                        return (
                          <label key={toolName} className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...integrationDraft.allowedTools, toolName]
                                  : integrationDraft.allowedTools.filter((t) => t !== toolName);
                                setIntegrationDraft((prev) =>
                                  prev ? { ...prev, allowedTools: next } : prev
                                );
                              }}
                            />
                            <span className="font-mono">{toolName}</span>
                          </label>
                        );
                      })}
                      {(availableIntegrations.find((i) => i.name === integrationDraft.provider)
                        ?.available_tools ?? []
                      ).length === 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          No tools list returned by the provider yet. You can still connect; we’ll refine this once we inspect the tool schema from the provider.
                        </p>
                      )}
                    </div>
                  </div>

                  {integrationDraft.error && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {integrationDraft.error}
                    </p>
                  )}
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={finishIntegrationConnect}
                    disabled={integrationDraft.isSaving || integrationDraft.provider === "microsoft_teams"}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {integrationDraft.isSaving ? "Saving..." : "Connect"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIntegrationDraft(null)}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
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
              {(() => {
                const isWidgetEnabled =
                  enabledFeatures.telephony &&
                  (parseJsonField(
                    jsonFields.telephony_settings ?? "",
                    "telephony"
                  ).value as Record<string, unknown>)
                    ?.supports_unauthenticated_web_calls === true;
                return (
              <button
                type="button"
                onClick={async () => {
                  setEnabledFeatures((prev) => ({ ...prev, telephony: true }));
                  const telephonyResult = parseJsonField(
                    jsonFields.telephony_settings ?? "",
                    "Telephony settings"
                  );
                  const current =
                    (telephonyResult.value as Record<string, unknown>) ?? {};
                  const updatedTelephony = {
                    ...current,
                    supports_unauthenticated_web_calls: true,
                  };
                  handleJsonChange(
                    "telephony_settings",
                    stringify(updatedTelephony)
                  );
                  // Persist immediately so org admins see the change without extra Save click
                  setJsonError(null);
                  setSuccessMessage(null);
                  const voice =
                    voiceSettings.voice?.trim() ||
                    (draft!.voice_settings as Record<string, unknown>)?.voice;
                  const payload: TelnyxUpdateAssistantRequest = {
                    ...toUpdatePayload(draft!),
                    tools: parseJsonField(jsonFields.tools ?? "", "Tools", true)
                      .value as Record<string, unknown>[],
                    voice_settings:
                      typeof voice === "string" && voice
                        ? {
                            provider: voiceSettings.provider || undefined,
                            model: voiceSettings.model || undefined,
                            voice,
                            voice_speed:
                              voiceSettings.voice_speed !== ""
                                ? Number(voiceSettings.voice_speed)
                                : undefined,
                          }
                        : (draft!.voice_settings as Record<string, unknown>),
                    transcription: transcriptionModel
                      ? { model: transcriptionModel }
                      : {},
                    telephony_settings: updatedTelephony,
                    messaging_settings: (parseJsonField(
                      jsonFields.messaging_settings ?? "",
                      "Messaging settings"
                    ).value as Record<string, unknown>) ?? {},
                    widget_settings: (parseJsonField(
                      jsonFields.widget_settings ?? "",
                      "Widget settings"
                    ).value as Record<string, unknown>) ?? {},
                    dynamic_variables: dynamicVariables
                      .filter((e) => e.key.trim().length > 0)
                      .reduce<Record<string, unknown>>(
                        (acc, e) => {
                          acc[e.key.trim()] = e.value;
                          return acc;
                        },
                        {}
                      ),
                    privacy_settings: (parseJsonField(
                      jsonFields.privacy_settings ?? "",
                      "Privacy settings"
                    ).value as Record<string, unknown>) ?? {},
                    insight_settings: (parseJsonField(
                      jsonFields.insight_settings ?? "",
                      "Insight settings"
                    ).value as Record<string, unknown>) ?? {},
                    enabled_features: [
                      ...(enabledFeatures.messaging ? ["messaging"] : []),
                      "telephony",
                    ],
                  };
                  const updated = await save(payload);
                  if (updated) {
                    setSuccessMessage("Widget enabled for web calls.");
                  }
                }}
                disabled={isSaving || isWidgetEnabled}
                className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-200 disabled:opacity-60 dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-100 dark:hover:bg-amber-900"
              >
                {isSaving
                  ? "Saving..."
                  : isWidgetEnabled
                    ? "Enabled"
                    : "Enable now"}
              </button>
                );
              })()}
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
