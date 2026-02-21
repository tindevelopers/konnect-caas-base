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

function copyToClipboard(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    });
    return;
  }

  // Fallback for older browsers/environments
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
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

export interface AssignedNumberRow {
  phone_number: string;
  status?: string;
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
  /** Numbers assigned to this assistant for voice (Calling tab). When provided, shows Assigned numbers section. */
  assignedNumbers?: AssignedNumberRow[];
  /** Called when user clicks "Assign numbers" in Calling tab. e.g. navigate to Manage Numbers. */
  onAssignNumbers?: () => void;
  /** Optional slot rendered in Calling tab under "Test this assistant" (e.g. Call Assistant, Webcall, Test Call, Receive Call buttons). */
  testAssistantSlot?: React.ReactNode;
  /** URL for Manage Numbers (used in Messaging profile callout). Default /rtc/numbers/manage-numbers. */
  manageNumbersHref?: string;
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
  assignedNumbers,
  onAssignNumbers,
  testAssistantSlot,
  manageNumbersHref = "/rtc/numbers/manage-numbers",
}: AssistantEditorProps) {
  const { assistant, setAssistant, isLoading, isSaving, error, save } =
    useAssistantEditor(api, assistantId);
  const [activeTab, setActiveTab] = useState<EditorTab>("Agent");
  const [draft, setDraft] = useState<TelnyxAssistant | null>(null);
  const [jsonFields, setJsonFields] = useState<Record<string, string>>({});
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
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

  const telnyxWidgetEmbedCode = useMemo(() => {
    return `<!-- Telnyx AI Agent widget: chat + voice -->
<telnyx-ai-agent
  agent-id="${assistantId}"
  environment="production">
</telnyx-ai-agent>
<script async src="https://unpkg.com/@telnyx/ai-agent-widget@next"></script>`;
  }, [assistantId]);

  const handleCopy = useCallback((text: string, label: string) => {
    copyToClipboard(text);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1500);
  }, []);

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

      {activeTab === "Calling" && (() => {
        const telephony = (parseJsonField(jsonFields.telephony_settings ?? "", "telephony").value ?? {}) as Record<string, unknown>;
        const recording = (telephony.recording_settings as Record<string, unknown>) ?? {};
        const updateTelephony = (patch: Record<string, unknown>) =>
          handleJsonChange("telephony_settings", stringify({ ...telephony, ...patch }));
        const updateRecording = (patch: Record<string, unknown>) =>
          updateTelephony({ recording_settings: { ...recording, ...patch } });
        return (
          <div className="space-y-8">
            {/* Test this assistant — prominent so user sees how to make a call */}
            <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/50 p-5 dark:border-indigo-800 dark:bg-indigo-950/30">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white/90">
                Test this assistant
              </h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                Call, receive calls, or run a test. Use <strong>Call Assistant</strong> for a real phone call (need numbers + Connection ID),{" "}
                <strong>Webcall</strong> for in-browser, <strong>Test Call</strong> for simulated, <strong>Receive Call</strong> for inbound setup.
              </p>
              {testAssistantSlot ? (
                <div className="mt-4">{testAssistantSlot}</div>
              ) : (
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                  Use the buttons below this form to make a call.
                </p>
              )}
            </div>

            {/* Assigned numbers (Telnyx-style) */}
            {typeof assignedNumbers !== "undefined" && (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Assigned numbers
                  </h3>
                  {onAssignNumbers && (
                    <button
                      type="button"
                      onClick={onAssignNumbers}
                      className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                    >
                      Assign numbers
                    </button>
                  )}
                </div>
                {!assignedNumbers?.length ? (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    You have no assigned phone numbers.{" "}
                    {onAssignNumbers ? (
                      <button type="button" onClick={onAssignNumbers} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                        Assign numbers
                      </button>
                    ) : (
                      "Assign numbers from Manage Numbers."
                    )}
                  </p>
                ) : (
                  <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        <tr>
                          <th className="px-4 py-3">Number</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {assignedNumbers.map((row) => (
                          <tr key={row.phone_number}>
                            <td className="px-4 py-3 font-medium">{row.phone_number}</td>
                            <td className="px-4 py-3">{row.status ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Settings (Telnyx-style) */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Settings</h3>
              <div className="mt-4 space-y-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={telephony.supports_unauthenticated_web_calls === true}
                    onChange={(e) => updateTelephony({ supports_unauthenticated_web_calls: e.target.checked })}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  Support unauthenticated web calls
                </label>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                      Assistant max call duration (seconds)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={typeof telephony.time_limit_secs === "number" ? telephony.time_limit_secs : ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        updateTelephony({ time_limit_secs: v === "" || Number.isNaN(Number(v)) ? undefined : Number(v) });
                      }}
                      placeholder="e.g. 1800"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                      User idle timeout (seconds)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={typeof telephony.user_idle_timeout_secs === "number" ? telephony.user_idle_timeout_secs : ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        updateTelephony({ user_idle_timeout_secs: v === "" || Number.isNaN(Number(v)) ? undefined : Number(v) });
                      }}
                      placeholder="Optional"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Voicemail Detection (Telnyx-style) */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Voicemail detection</h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Configure how the AI assistant handles voicemail detection for outgoing calls. AMD must be enabled on the call for this to work.
              </p>
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Action on voicemail detected</label>
                <select
                  value={typeof (telephony.voicemail_detection as Record<string, unknown>)?.action_on_voicemail === "string"
                    ? (telephony.voicemail_detection as Record<string, unknown>).action_on_voicemail as string
                    : "continue_assistant"}
                  onChange={(e) => updateTelephony({
                    voicemail_detection: {
                      ...((telephony.voicemail_detection as Record<string, unknown>) ?? {}),
                      action_on_voicemail: e.target.value,
                    },
                  })}
                  className="mt-1 w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                >
                  <option value="continue_assistant">Continue assistant</option>
                  <option value="hang_up">Hang up</option>
                </select>
              </div>
            </div>

            {/* Recording Settings (Telnyx-style) */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recording settings</h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Configure call recording for outbound calls.
              </p>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Record outbound calls</label>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {(["do_not_record", "record_all", "record_by_ani"] as const).map((opt) => (
                      <label key={opt} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="record_outbound"
                          checked={(recording.record_outbound_calls ?? "do_not_record") === opt}
                          onChange={() => updateRecording({ record_outbound_calls: opt })}
                          className="border-gray-300 dark:border-gray-600"
                        />
                        {opt === "do_not_record" && "Do not record"}
                        {opt === "record_all" && "Record all outbound calls"}
                        {opt === "record_by_ani" && "Record outbound calls by ANI"}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Audio format</label>
                    <select
                      value={(recording.audio_format as string) ?? "wav"}
                      onChange={(e) => updateRecording({ audio_format: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                    >
                      <option value="wav">WAV</option>
                      <option value="mp3">MP3</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Channels</label>
                    <select
                      value={(recording.channels as string) ?? "single"}
                      onChange={(e) => updateRecording({ channels: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                    >
                      <option value="single">Single channel</option>
                      <option value="dual">Dual (stereo)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* TeXML Application (Telnyx-style) */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">TeXML application settings</h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Links this assistant to your call control application. Required for inbound/outbound voice.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">TeXML Application ID</label>
                  <input
                    type="text"
                    value={(telephony.default_texml_app_id as string) ?? ""}
                    onChange={(e) => updateTelephony({ default_texml_app_id: e.target.value.trim() || undefined })}
                    placeholder="e.g. 289794722023604389"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Call progress events URL</label>
                  <input
                    type="url"
                    value={(telephony.call_progress_events_url as string) ?? ""}
                    onChange={(e) => updateTelephony({ call_progress_events_url: e.target.value.trim() || undefined })}
                    placeholder="https://example.com/webhook"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Inbound channel limit</label>
                  <input
                    type="number"
                    min={0}
                    value={(telephony.inbound_channel_limit as number) ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateTelephony({ inbound_channel_limit: v === "" || Number.isNaN(Number(v)) ? undefined : Number(v) });
                    }}
                    placeholder="Optional"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                  />
                </div>
              </div>
            </div>

            {/* Outbound Voice Profile (Telnyx-style) */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Outbound voice profile</h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Profile used for outbound calls (channel limit, spend limits).
              </p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Outbound Voice Profile ID</label>
                  <input
                    type="text"
                    value={(telephony.outbound_voice_profile_id as string) ?? ""}
                    onChange={(e) => updateTelephony({ outbound_voice_profile_id: e.target.value.trim() || undefined })}
                    placeholder="Optional"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Channel limit</label>
                  <input
                    type="number"
                    min={0}
                    value={(telephony.outbound_channel_limit as number) ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateTelephony({ outbound_channel_limit: v === "" || Number.isNaN(Number(v)) ? undefined : Number(v) });
                    }}
                    placeholder="e.g. 10"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                  />
                </div>
                <div className="sm:col-span-2 flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(telephony.daily_spend_limit_enabled)}
                      onChange={(e) => updateTelephony({ daily_spend_limit_enabled: e.target.checked })}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                    Enable daily spend limit
                  </label>
                  <input
                    type="text"
                    value={(telephony.daily_spend_limit as string) ?? ""}
                    onChange={(e) => updateTelephony({ daily_spend_limit: e.target.value.trim() || undefined })}
                    placeholder="$ 100"
                    className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                  />
                </div>
              </div>
            </div>

            {/* Messaging profile — clear callout */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 dark:border-amber-800 dark:bg-amber-950/30">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">Messaging profile</h3>
              <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                To send or receive <strong>SMS/MMS</strong> on numbers assigned to this assistant, assign a <strong>messaging profile</strong> to each number.
              </p>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Go to <strong>Manage Numbers</strong> → select the number → <strong>Messaging profile</strong> section → enter Messaging Profile ID and click Assign.
              </p>
              <a
                href={manageNumbersHref}
                className="mt-3 inline-block rounded-lg bg-amber-200 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-300 dark:bg-amber-800 dark:text-amber-100 dark:hover:bg-amber-700"
              >
                Open Manage Numbers →
              </a>
            </div>

            {/* Advanced: raw JSON */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Advanced telephony (JSON)</h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Edit raw JSON for noise_suppression, or other options not exposed above.
              </p>
              <textarea
                value={jsonFields.telephony_settings ?? ""}
                onChange={(e) => handleJsonChange("telephony_settings", e.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono dark:border-gray-700 dark:bg-gray-900"
                rows={6}
              />
            </div>
          </div>
        );
      })()}

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

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white/90">
                  Embed Code
                </h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Copy and paste this into any website to embed the official Telnyx
                  AI Agent widget for this assistant.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(telnyxWidgetEmbedCode, "telnyxWidget")}
                className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:hover:bg-gray-800"
              >
                {copied === "telnyxWidget" ? "Copied!" : "Copy Code"}
              </button>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-lg border border-gray-200 bg-white p-3 text-xs font-mono text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90">
              {telnyxWidgetEmbedCode}
            </pre>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Widget Settings (JSON)
            </label>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Appearance and behavior (theme, start_call_text, default_state, etc.).
              This JSON is configuration only — it is not the embed code. Use the
              Embed Code block above to add the widget to a website.
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
