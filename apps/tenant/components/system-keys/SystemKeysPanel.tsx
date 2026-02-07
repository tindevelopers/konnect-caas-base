"use client";

import React, { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import {
  fetchPlatformIntegrationConfig,
  savePlatformIntegrationConfig,
} from "@/app/actions/integrations/platform-config";
import {
  CheckIcon,
  EyeIcon,
  EyeSlashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

type ProviderState = {
  isLoading: boolean;
  isSaving: boolean;
  isConnected: boolean;
  error: string | null;
  showSecrets: Record<string, boolean>;
  credentials: Record<string, string>;
  settings: Record<string, string>;
};

const TELNYX_PROVIDER = "telnyx";
const AI_GATEWAY_PROVIDER = "ai_gateway";
const GOHIGHLEVEL_PROVIDER = "gohighlevel";

const DEFAULT_AI_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1";

function defaultProviderState(): ProviderState {
  return {
    isLoading: true,
    isSaving: false,
    isConnected: false,
    error: null,
    showSecrets: {},
    credentials: {},
    settings: {},
  };
}

function extractString(obj: unknown, key: string): string {
  if (!obj || typeof obj !== "object") return "";
  const val = (obj as Record<string, unknown>)[key];
  return typeof val === "string" ? val : "";
}

export default function SystemKeysPanel() {
  const [accessDenied, setAccessDenied] = useState(false);

  const [telnyx, setTelnyx] = useState<ProviderState>(() => defaultProviderState());
  const [aiGateway, setAiGateway] = useState<ProviderState>(() => defaultProviderState());
  const [ghl, setGhl] = useState<ProviderState>(() => defaultProviderState());

  const anyLoading = telnyx.isLoading || aiGateway.isLoading || ghl.isLoading;

  useEffect(() => {
    async function load() {
      setAccessDenied(false);
      await Promise.all([
        (async () => {
          try {
            const config = await fetchPlatformIntegrationConfig(TELNYX_PROVIDER);
            const creds = (config?.credentials ?? {}) as Record<string, unknown>;
            // Extract API key - check both apiKey and api_key fields
            const apiKey = extractString(creds, "apiKey") || extractString(creds, "api_key");
            // Only set apiKey if it's not the placeholder text "Messaging Profile ID"
            const validApiKey = apiKey && apiKey !== "Messaging Profile ID" ? apiKey : "";
            setTelnyx((s) => ({
              ...s,
              isLoading: false,
              isConnected: config?.status === "connected",
              credentials: {
                apiKey: validApiKey,
                messagingProfileId: extractString(creds, "messagingProfileId") || extractString(creds, "messaging_profile_id"),
              },
              settings: {},
              error: null,
            }));
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to load Telnyx keys";
            if (msg.includes("Platform Admin")) setAccessDenied(true);
            setTelnyx((s) => ({ ...s, isLoading: false, error: msg }));
          }
        })(),
        (async () => {
          try {
            const config = await fetchPlatformIntegrationConfig(AI_GATEWAY_PROVIDER);
            const creds = (config?.credentials ?? {}) as Record<string, unknown>;
            const settings = (config?.settings ?? {}) as Record<string, unknown>;
            setAiGateway((s) => ({
              ...s,
              isLoading: false,
              isConnected: config?.status === "connected",
              credentials: {
                apiKey: extractString(creds, "apiKey"),
              },
              settings: {
                baseUrl: extractString(settings, "baseUrl") || DEFAULT_AI_GATEWAY_BASE_URL,
              },
              error: null,
            }));
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to load AI Gateway keys";
            if (msg.includes("Platform Admin")) setAccessDenied(true);
            setAiGateway((s) => ({ ...s, isLoading: false, error: msg }));
          }
        })(),
        (async () => {
          try {
            const config = await fetchPlatformIntegrationConfig(GOHIGHLEVEL_PROVIDER);
            const creds = (config?.credentials ?? {}) as Record<string, unknown>;
            setGhl((s) => ({
              ...s,
              isLoading: false,
              isConnected: config?.status === "connected",
              credentials: {
                apiKey: extractString(creds, "apiKey"),
                locationId: extractString(creds, "locationId"),
              },
              settings: {},
              error: null,
            }));
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to load GoHighLevel keys";
            if (msg.includes("Platform Admin")) setAccessDenied(true);
            setGhl((s) => ({ ...s, isLoading: false, error: msg }));
          }
        })(),
      ]);
    }
    load();
  }, []);

  const providers = useMemo(
    () => [
      {
        key: "telnyx",
        title: "Telnyx (system-wide)",
        description:
          "Default Telnyx credentials used when an organization has not connected Telnyx under Integrations → Telephony → Telnyx.",
        state: telnyx,
        setState: setTelnyx,
        provider: TELNYX_PROVIDER,
        category: "Telephony",
        fields: [
          {
            name: "apiKey",
            label: "API Key",
            secret: true,
            placeholder: "Key live_… or Key test_…",
          },
          {
            name: "messagingProfileId",
            label: "Messaging Profile ID (optional)",
            secret: false,
            placeholder: "Optional",
          },
        ],
        settingsFields: [],
      },
      {
        key: "ai-gateway",
        title: "Vercel AI Gateway (system-wide)",
        description:
          "System-wide AI key for the Vercel AI Gateway (OpenAI-compatible). Used by the chatbot/embeddings when configured.",
        state: aiGateway,
        setState: setAiGateway,
        provider: AI_GATEWAY_PROVIDER,
        category: "AI",
        fields: [
          {
            name: "apiKey",
            label: "AI Gateway API Key",
            secret: true,
            placeholder: "agw_…",
          },
        ],
        settingsFields: [
          {
            name: "baseUrl",
            label: "Base URL",
            placeholder: DEFAULT_AI_GATEWAY_BASE_URL,
          },
        ],
      },
      {
        key: "gohighlevel",
        title: "GoHighLevel (system-wide)",
        description:
          "Default GoHighLevel credentials used when an organization has not connected GoHighLevel under Integrations → CRM → GoHighLevel.",
        state: ghl,
        setState: setGhl,
        provider: GOHIGHLEVEL_PROVIDER,
        category: "CRM",
        fields: [
          {
            name: "apiKey",
            label: "API Key",
            secret: true,
            placeholder: "ghl_…",
          },
          {
            name: "locationId",
            label: "Location ID",
            secret: false,
            placeholder: "Location ID",
          },
        ],
        settingsFields: [],
      },
    ],
    [aiGateway, ghl, telnyx]
  );

  if (anyLoading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            System-wide Keys
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/30">
        <p className="text-amber-800 dark:text-amber-200">
          Only Platform Admins can view and set system-wide keys.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          System-wide Keys
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage platform-level credentials (used as defaults when a tenant has no organization-level
          integration configured).
        </p>
      </div>

      {providers.map((p) => {
        const { state, setState } = p;

        const toggleSecret = (fieldName: string) => {
          setState((s) => ({
            ...s,
            showSecrets: { ...s.showSecrets, [fieldName]: !s.showSecrets[fieldName] },
          }));
        };

        const onCredentialChange = (name: string, value: string) => {
          setState((s) => ({ ...s, credentials: { ...s.credentials, [name]: value } }));
        };

        const onSettingChange = (name: string, value: string) => {
          setState((s) => ({ ...s, settings: { ...s.settings, [name]: value } }));
        };

        const hasAnyCreds = Object.values(state.credentials).some((v) => (v ?? "").trim() !== "");

        const handleSave = async () => {
          setState((s) => ({ ...s, isSaving: true, error: null }));
          try {
            const credentials: Record<string, unknown> = {};
            for (const f of p.fields) {
              const v = state.credentials[f.name];
              if (typeof v === "string" && v.trim() !== "") {
                // Prevent saving placeholder text as API key
                if (f.name === "apiKey" && v.trim() === "Messaging Profile ID") {
                  setState((s) => ({
                    ...s,
                    isSaving: false,
                    error: "Please enter a valid API Key. 'Messaging Profile ID' is not a valid API key.",
                  }));
                  return;
                }
                credentials[f.name] = v.trim();
              }
            }

            const settings: Record<string, unknown> = {};
            for (const f of p.settingsFields) {
              const v = state.settings[f.name];
              if (typeof v === "string" && v.trim() !== "") settings[f.name] = v.trim();
            }

            await savePlatformIntegrationConfig({
              provider: p.provider,
              category: p.category,
              credentials,
              settings: Object.keys(settings).length ? settings : null,
              status: hasAnyCreds ? "connected" : "disconnected",
            });

            setState((s) => ({ ...s, isConnected: hasAnyCreds }));
          } catch (e) {
            setState((s) => ({
              ...s,
              error: e instanceof Error ? e.message : "Failed to save",
            }));
          } finally {
            setState((s) => ({ ...s, isSaving: false }));
          }
        };

        return (
          <div
            key={p.key}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {p.title}
                </h4>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {p.description}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {state.isConnected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-sm font-medium text-green-700 dark:bg-green-500/15 dark:text-green-500">
                    <CheckIcon className="h-4 w-4" />
                    Set
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    <XMarkIcon className="h-4 w-4" />
                    Not set
                  </span>
                )}
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {p.fields.map((field) => (
                <div key={field.name}>
                  <Label htmlFor={`${p.provider}-${field.name}`}>{field.label}</Label>
                  <div className="relative mt-2">
                    <Input
                      id={`${p.provider}-${field.name}`}
                      type={
                        field.secret
                          ? state.showSecrets[field.name]
                            ? "text"
                            : "password"
                          : "text"
                      }
                      value={state.credentials[field.name] || ""}
                      onChange={(e) => onCredentialChange(field.name, e.target.value)}
                      placeholder={field.placeholder}
                    />
                    {field.secret && (
                      <button
                        type="button"
                        onClick={() => toggleSecret(field.name)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        {state.showSecrets[field.name] ? (
                          <EyeSlashIcon className="h-5 w-5" />
                        ) : (
                          <EyeIcon className="h-5 w-5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {p.settingsFields.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {p.settingsFields.map((field) => (
                    <div key={field.name}>
                      <Label htmlFor={`${p.provider}-settings-${field.name}`}>{field.label}</Label>
                      <div className="mt-2">
                        <Input
                          id={`${p.provider}-settings-${field.name}`}
                          type="text"
                          value={state.settings[field.name] || ""}
                          onChange={(e) => onSettingChange(field.name, e.target.value)}
                          placeholder={field.placeholder}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {state.error && (
                <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleSave} disabled={state.isSaving}>
                  {state.isSaving ? "Saving…" : "Save"}
                </Button>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Stored in `platform_integration_configs` (encrypted if `INTEGRATION_CREDENTIALS_KEY`
                  is set).
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

