"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import ProviderLogo from "@/components/integration/ProviderLogo";
import {
  CheckIcon,
  EyeIcon,
  EyeSlashIcon,
  SignalIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import {
  fetchIntegrationConfig,
  saveIntegrationConfig,
} from "@/app/actions/integrations/config";
import { connectGoHighLevelIntegration } from "@/app/actions/integrations/gohighlevel";
import { testIntegrationConnection } from "@/app/actions/integrations/health";
import { integrationsCatalog } from "@/app/saas/admin/system-admin/integrations/integrationsCatalog";

interface AdditionalSetting {
  name: string;
  label: string;
  type: "switch" | "select" | "text";
  options?: string[];
  placeholder?: string;
  required?: boolean;
}

interface IntegrationDefinition {
  provider: string;
  displayName: string;
  category: string;
  description: string;
  connectType: "apiKey" | "oauth";
  fields: Array<{
    name: string;
    label: string;
    type: "text" | "password" | "url";
    required: boolean;
    placeholder?: string;
  }>;
  additionalSettings: AdditionalSetting[];
}

interface HealthState {
  status: "active" | "error" | "unknown";
  message: string;
  checkedAt?: string;
}

const additionalSettingsByProvider: Record<string, AdditionalSetting[]> = {
  telnyx: [
    {
      name: "voiceRouting.inboundAssistantId",
      label: "Inbound Assistant ID",
      type: "text",
      placeholder: "asst_...",
      required: true,
    },
    {
      name: "voiceRouting.operatorSipUri",
      label: "Operator SIP URI",
      type: "text",
      placeholder: "sip:operator@pbx.example.com",
      required: false,
    },
    {
      name: "voiceRouting.escapeDigit",
      label: "Escape Digit",
      type: "text",
      placeholder: "0",
      required: false,
    },
  ],
};

function readPathValue(obj: unknown, path: string) {
  if (!obj || typeof obj !== "object") return undefined;
  const parts = path.split(".").filter(Boolean);
  let current: unknown = obj;

  for (const part of parts) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setPathValue(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) return;

  let current: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    const existing = current[key];
    if (!existing || typeof existing !== "object") {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

function hasCredentialValue(credentials: Record<string, unknown> | null | undefined) {
  if (!credentials) return false;
  return Object.values(credentials).some(
    (value) => String(value ?? "").trim().length > 0
  );
}

function buildDefinition(provider: string): IntegrationDefinition | null {
  const catalog = integrationsCatalog.find((item) => item.provider === provider);
  if (!catalog) return null;

  return {
    provider: catalog.provider,
    displayName: catalog.displayName,
    category: catalog.category,
    description: catalog.description,
    connectType: catalog.connectType,
    fields: catalog.credentialSchema.map((field) => ({
      ...field,
      required: field.required ?? false,
    })),
    additionalSettings: additionalSettingsByProvider[catalog.provider] ?? [],
  };
}

function normalizeHealth(settings: unknown): HealthState {
  const health = readPathValue(settings, "health");
  if (!health || typeof health !== "object") {
    return { status: "unknown", message: "Not tested yet." };
  }

  const rawStatus = String((health as Record<string, unknown>).status ?? "unknown");
  const normalizedStatus =
    rawStatus === "active" || rawStatus === "ok" || rawStatus === "connected"
      ? "active"
      : rawStatus === "error" || rawStatus === "failed" || rawStatus === "inactive"
        ? "error"
        : "unknown";

  return {
    status: normalizedStatus,
    message: String((health as Record<string, unknown>).message ?? "Not tested yet."),
    checkedAt: String((health as Record<string, unknown>).checkedAt ?? "") || undefined,
  };
}

export default function IntegrationDetailPage() {
  const params = useParams();
  const provider = ((params.integration as string) ?? "").toLowerCase();
  const definition = useMemo(() => buildDefinition(provider), [provider]);

  const [formData, setFormData] = useState<Record<string, string>>({});
  const [settingsData, setSettingsData] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthState>({
    status: "unknown",
    message: "Not tested yet.",
  });

  useEffect(() => {
    if (!definition) {
      setIsLoading(false);
      return;
    }
    const currentDefinition = definition;

    let mounted = true;
    async function loadConfig() {
      setIsLoading(true);
      setError(null);
      try {
        const existing = await fetchIntegrationConfig(provider);
        if (!mounted) return;

        const credentials =
          (existing?.credentials as Record<string, unknown> | null | undefined) ?? {};
        const nextFormData: Record<string, string> = {};
        for (const field of currentDefinition.fields) {
          nextFormData[field.name] = String(credentials[field.name] ?? "");
        }
        setFormData(nextFormData);

        const nextSettingsData: Record<string, string> = {};
        if (currentDefinition.additionalSettings.length > 0) {
          const existingSettings =
            (existing?.settings as Record<string, unknown> | null | undefined) ?? {};
          for (const setting of currentDefinition.additionalSettings) {
            const raw = readPathValue(existingSettings, setting.name);
            if (raw === undefined || raw === null) continue;
            nextSettingsData[setting.name] = String(raw);
          }
        }
        setSettingsData(nextSettingsData);

        const connected =
          existing?.status === "connected" || hasCredentialValue(credentials);
        setIsConnected(connected);
        setHealth(normalizeHealth(existing?.settings));
      } catch (loadError) {
        if (!mounted) return;
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load integration."
        );
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void loadConfig();
    return () => {
      mounted = false;
    };
  }, [definition, provider]);

  const toggleSecret = (fieldName: string) => {
    setShowSecrets((prev) => ({ ...prev, [fieldName]: !prev[fieldName] }));
  };

  const buildSettingsPayload = () => {
    if (!definition || definition.additionalSettings.length === 0) return null;

    const payload: Record<string, unknown> = {};
    for (const setting of definition.additionalSettings) {
      const raw = settingsData[setting.name] ?? "";
      if (setting.type === "switch") {
        setPathValue(payload, setting.name, raw === "true");
        continue;
      }

      const trimmed = String(raw).trim();
      if (setting.required && trimmed.length === 0) {
        throw new Error(`${setting.label} is required`);
      }
      if (trimmed.length > 0) {
        setPathValue(payload, setting.name, trimmed);
      }
    }
    return payload;
  };

  const saveConnection = async (status: "connected" | "disconnected") => {
    if (!definition) return;
    if (definition.connectType === "oauth") {
      setError("OAuth-based setup is not enabled yet for this integration.");
      return;
    }
    setError(null);
    setIsSaving(true);

    try {
      const credentials: Record<string, string> = {};
      for (const field of definition.fields) {
        const value = formData[field.name] ?? "";
        if (field.required && status === "connected" && value.trim().length === 0) {
          throw new Error(`${field.label} is required`);
        }
        if (value.trim().length > 0) {
          credentials[field.name] = value;
        }
      }

      const settings = buildSettingsPayload();
      const nextStatus =
        status === "connected" && Object.keys(credentials).length > 0
          ? "connected"
          : "disconnected";

      if (provider === "gohighlevel" && nextStatus === "connected") {
        await connectGoHighLevelIntegration({
          credentials: {
            apiKey: credentials.apiKey ?? "",
            locationId: credentials.locationId ?? "",
          },
        });

        if (settings && Object.keys(settings).length > 0) {
          await saveIntegrationConfig({
            provider,
            category: definition.category,
            credentials,
            settings,
            status: nextStatus,
          });
        }
      } else {
        await saveIntegrationConfig({
          provider,
          category: definition.category,
          credentials: nextStatus === "connected" ? credentials : {},
          settings: status === "connected" ? settings : null,
          status: nextStatus,
        });
      }

      setIsConnected(nextStatus === "connected");
      if (nextStatus !== "connected") {
        setHealth({ status: "unknown", message: "Disconnected." });
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save integration."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!definition) return;
    setError(null);
    setIsTesting(true);
    try {
      const result = await testIntegrationConnection(provider);
      setHealth({
        status: result.status,
        message: result.message,
        checkedAt: result.checkedAt,
      });
      if (result.ok) {
        setIsConnected(true);
        setError(null);
      } else {
        setError(result.message);
      }
    } catch (testError) {
      setHealth({
        status: "error",
        message:
          testError instanceof Error
            ? testError.message
            : "Integration test failed unexpectedly.",
      });
      setError(
        testError instanceof Error
          ? testError.message
          : "Integration test failed unexpectedly."
      );
    } finally {
      setIsTesting(false);
    }
  };

  if (!definition) {
    return (
      <div className="space-y-6">
        <PageBreadcrumb pageTitle="Integration" />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/20">
          <h1 className="text-xl font-semibold text-amber-900 dark:text-amber-100">
            Integration unavailable
          </h1>
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
            This integration is not in the platform catalog. Add it at the platform
            level first.
          </p>
        </div>
      </div>
    );
  }

  const healthBadgeClass =
    health.status === "active"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
      : health.status === "error"
        ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
        : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageBreadcrumb pageTitle={`${definition.displayName} Integration`} />
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageBreadcrumb pageTitle={`${definition.displayName} Integration`} />

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <ProviderLogo
              provider={definition.provider}
              displayName={definition.displayName}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
            />
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {definition.displayName}
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {definition.description}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Category: {definition.category}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                isConnected
                  ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300"
                  : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              {isConnected ? (
                <CheckIcon className="h-3.5 w-3.5" />
              ) : (
                <XMarkIcon className="h-3.5 w-3.5" />
              )}
              {isConnected ? "Connected" : "Disconnected"}
            </span>

            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${healthBadgeClass}`}
            >
              <SignalIcon className="h-3.5 w-3.5" />
              {health.status === "active"
                ? "Active"
                : health.status === "error"
                  ? "Needs test"
                  : "Not tested"}
            </span>
          </div>
        </div>

        <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">{health.message}</p>
        {health.checkedAt && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Last tested: {new Date(health.checkedAt).toLocaleString()}
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Connection Settings
        </h2>
        {definition.connectType === "oauth" && (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            This integration uses OAuth. OAuth setup flow will be enabled in a later
            phase.
          </p>
        )}
        <div className="mt-4 space-y-4">
          {definition.fields.map((field) => (
            <div key={field.name}>
              <Label htmlFor={field.name}>
                {field.label}
                {field.required && <span className="text-red-500">*</span>}
              </Label>
              <div className="relative mt-2">
                <Input
                  id={field.name}
                  type={
                    field.type === "password" && !showSecrets[field.name]
                      ? "password"
                      : field.type === "url"
                        ? "url"
                        : "text"
                  }
                  value={formData[field.name] ?? ""}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, [field.name]: event.target.value }))
                  }
                  placeholder={field.placeholder}
                />
                {field.type === "password" && (
                  <button
                    type="button"
                    onClick={() => toggleSecret(field.name)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showSecrets[field.name] ? (
                      <EyeSlashIcon className="h-5 w-5" />
                    ) : (
                      <EyeIcon className="h-5 w-5" />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {definition.additionalSettings.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Additional Settings
          </h2>
          <div className="mt-4 space-y-4">
            {definition.additionalSettings.map((setting) => (
              <div key={setting.name}>
                <Label htmlFor={setting.name}>
                  {setting.label}
                  {setting.required && <span className="text-red-500">*</span>}
                </Label>
                <div className="mt-2">
                  {setting.type === "select" ? (
                    <select
                      id={setting.name}
                      value={settingsData[setting.name] ?? ""}
                      onChange={(event) =>
                        setSettingsData((prev) => ({
                          ...prev,
                          [setting.name]: event.target.value,
                        }))
                      }
                      className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                    >
                      <option value="">Select {setting.label}</option>
                      {setting.options?.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : setting.type === "switch" ? (
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        id={setting.name}
                        type="checkbox"
                        checked={settingsData[setting.name] === "true"}
                        onChange={(event) =>
                          setSettingsData((prev) => ({
                            ...prev,
                            [setting.name]: String(event.target.checked),
                          }))
                        }
                      />
                      Enabled
                    </label>
                  ) : (
                    <Input
                      id={setting.name}
                      type="text"
                      value={settingsData[setting.name] ?? ""}
                      onChange={(event) =>
                        setSettingsData((prev) => ({
                          ...prev,
                          [setting.name]: event.target.value,
                        }))
                      }
                      placeholder={setting.placeholder}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => saveConnection("connected")}
          disabled={isSaving || isTesting || definition.connectType === "oauth"}
        >
          {isSaving ? "Saving..." : isConnected ? "Save" : "Save & Connect"}
        </Button>

        <Button
          variant="outline"
          onClick={handleTestConnection}
          disabled={
            isSaving ||
            isTesting ||
            !isConnected ||
            definition.connectType === "oauth"
          }
        >
          {isTesting ? "Testing..." : "Test Connection"}
        </Button>

        {isConnected && (
          <Button
            variant="outline"
            onClick={() => saveConnection("disconnected")}
            disabled={isSaving || isTesting}
          >
            Disconnect
          </Button>
        )}
      </div>
    </div>
  );
}
