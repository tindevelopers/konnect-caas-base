"use client";

import React, { useEffect, useMemo, useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import {
  EyeIcon,
  EyeSlashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  fetchPlatformIntegrationConfig,
  savePlatformIntegrationConfig,
} from "@/app/actions/integrations/platform-config";
import {
  integrationCategories,
  integrationsCatalog,
  type IntegrationCatalogItem,
} from "./integrationsCatalog";

type PlatformConfig = {
  status?: string | null;
  credentials?: Record<string, unknown> | null;
};

export default function SystemAdminIntegrationsPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [configs, setConfigs] = useState<Record<string, PlatformConfig>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<IntegrationCatalogItem | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const categories = useMemo(
    () => ["All", ...integrationCategories],
    []
  );

  const filteredIntegrations = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return integrationsCatalog.filter((item) => {
      const matchesCategory = category === "All" || item.category === category;
      const matchesQuery =
        !normalized ||
        item.displayName.toLowerCase().includes(normalized) ||
        item.description.toLowerCase().includes(normalized) ||
        item.provider.toLowerCase().includes(normalized);
      return matchesCategory && matchesQuery;
    });
  }, [query, category]);

  useEffect(() => {
    let mounted = true;
    async function loadConfigs() {
      setIsLoading(true);
      setLoadError(null);
      setAccessDenied(false);

      const results = await Promise.allSettled(
        integrationsCatalog.map(async (item) => {
          const config = await fetchPlatformIntegrationConfig(item.provider);
          return { provider: item.provider, config };
        })
      );

      if (!mounted) return;

      const denied = results.some(
        (result) =>
          result.status === "rejected" &&
          String(result.reason?.message || result.reason || "").includes(
            "Platform Admin"
          )
      );

      if (denied) {
        setAccessDenied(true);
        setIsLoading(false);
        return;
      }

      const nextConfigs: Record<string, PlatformConfig> = {};
      for (const result of results) {
        if (result.status === "fulfilled") {
          if (result.value.config) {
            nextConfigs[result.value.provider] = result.value.config as PlatformConfig;
          }
        }
      }

      setConfigs(nextConfigs);
      setIsLoading(false);
    }

    loadConfigs().catch((error) => {
      if (!mounted) return;
      setLoadError(
        error instanceof Error ? error.message : "Failed to load integrations."
      );
      setIsLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const configuredFor = (provider: string) => {
    const config = configs[provider];
    if (!config) return false;
    if (config.status === "connected") return true;
    const values = Object.values(config.credentials || {});
    return values.some((value) => String(value || "").trim().length > 0);
  };

  const openModal = (item: IntegrationCatalogItem) => {
    const config = configs[item.provider];
    const credentials = (config?.credentials ?? {}) as Record<string, unknown>;
    const initialValues: Record<string, string> = {};
    item.credentialSchema.forEach((field) => {
      initialValues[field.name] = (credentials[field.name] as string) || "";
    });
    setFormValues(initialValues);
    setShowSecrets({});
    setSaveError(null);
    setSelected(item);
  };

  const closeModal = () => {
    setSelected(null);
    setFormValues({});
    setShowSecrets({});
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!selected) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const credentials: Record<string, string> = {};
      selected.credentialSchema.forEach((field) => {
        credentials[field.name] = formValues[field.name] || "";
      });
      const hasAnyValue = Object.values(credentials).some(
        (value) => value.trim().length > 0
      );
      const status = hasAnyValue ? "connected" : "disconnected";

      await savePlatformIntegrationConfig({
        provider: selected.provider,
        category: selected.category,
        credentials,
        status,
      });

      setConfigs((prev) => ({
        ...prev,
        [selected.provider]: {
          status,
          credentials,
        },
      }));
      closeModal();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Failed to save integration."
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div>
        <PageBreadcrumb pageTitle="Integrations" />
        <div className="flex justify-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Loading…</p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div>
        <PageBreadcrumb pageTitle="Integrations" />
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-amber-800 dark:text-amber-200">
            Only Platform Admins can view and set system default integrations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageBreadcrumb pageTitle="Integrations" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
            Integrations
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Configure system-wide credentials used as defaults for new tenants.
          </p>
        </div>
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search integrations..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={`rounded-full px-4 py-1 text-sm font-medium ${
              category === item
                ? "bg-brand-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
          {loadError}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredIntegrations.map((integration) => {
          const configured = configuredFor(integration.provider);
          return (
            <div
              key={integration.provider}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl text-sm font-semibold ${integration.badgeClass}`}
                  >
                    {integration.logoText}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {integration.displayName}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {integration.category}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    configured
                      ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  {configured ? "Configured" : "Not set"}
                </span>
              </div>

              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                {integration.description}
              </p>

              <div className="mt-5 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {integration.connectType === "oauth"
                    ? "OAuth connection"
                    : "API key"}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openModal(integration)}
                >
                  {integration.connectType === "oauth" ? "Manage" : "Configure"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-lg dark:bg-gray-900">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {selected.displayName} (system default)
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selected.description}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {selected.connectType === "oauth" ? (
              <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                OAuth setup will be supported here in a later phase. For now, use
                tenant-level OAuth connections under Integrations, or contact
                the engineering team to enable system defaults.
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {selected.credentialSchema.map((field) => (
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
                            : "text"
                        }
                        placeholder={field.placeholder}
                        value={formValues[field.name] || ""}
                        onChange={(event) =>
                          setFormValues((prev) => ({
                            ...prev,
                            [field.name]: event.target.value,
                          }))
                        }
                      />
                      {field.type === "password" && (
                        <button
                          type="button"
                          onClick={() =>
                            setShowSecrets((prev) => ({
                              ...prev,
                              [field.name]: !prev[field.name],
                            }))
                          }
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
            )}

            {saveError && (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400">
                {saveError}
              </p>
            )}

            <div className="mt-6 flex items-center gap-3">
              <Button
                onClick={handleSave}
                disabled={isSaving || selected.connectType === "oauth"}
              >
                {isSaving ? "Saving…" : "Save default"}
              </Button>
              <Button variant="outline" onClick={closeModal}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
