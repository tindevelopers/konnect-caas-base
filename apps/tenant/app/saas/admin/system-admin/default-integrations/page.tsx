"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import {
  fetchPlatformIntegrationConfig,
  savePlatformIntegrationConfig,
} from "@/app/actions/integrations/platform-config";
import { CheckIcon, XMarkIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import React, { useState, useEffect } from "react";

const TELNYX_PROVIDER = "telnyx";

export default function DefaultIntegrationsPage() {
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    async function load() {
      setError(null);
      setAccessDenied(false);
      try {
        const config = await fetchPlatformIntegrationConfig(TELNYX_PROVIDER);
        if (config?.credentials && typeof config.credentials === "object") {
          const creds = config.credentials as Record<string, string>;
          setApiKey(creds.apiKey ?? creds.api_key ?? "");
        }
        if (config?.status === "connected") {
          setIsConnected(true);
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes("Platform Admin")) {
          setAccessDenied(true);
        } else {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async () => {
    setError(null);
    setIsSaving(true);
    try {
      await savePlatformIntegrationConfig({
        provider: TELNYX_PROVIDER,
        category: "Telephony",
        credentials: { apiKey: apiKey.trim() },
        status: apiKey.trim() ? "connected" : "disconnected",
      });
      setIsConnected(!!apiKey.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div>
        <PageBreadcrumb pageTitle="Default Integrations" />
        <div className="flex justify-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Loading…</p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div>
        <PageBreadcrumb pageTitle="Default Integrations" />
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-amber-800 dark:text-amber-200">
            Only Platform Admins can view and set system default integrations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageBreadcrumb pageTitle="Default Integrations" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
            Default Integrations
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Set system-wide credentials used when an organization has not configured its own. New
            users and tenants will use this default provider account until they set organization-level
            credentials under Integrations → Telephony.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Premium Telephony (system default)
          </h2>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Used for AI Assistants and telephony APIs when the current organization has no telephony
            provider integration. Organizations can override this by connecting a telephony provider
            under Integrations → Telephony.
          </p>
          <div className="space-y-4">
            <div>
              <Label htmlFor="telnyx-api-key">API Key</Label>
              <div className="relative mt-2">
                <Input
                  id="telnyx-api-key"
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Key live_… or Key test_…"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showApiKey ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving…" : "Save default"}
              </Button>
              {isConnected && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-sm font-medium text-green-700 dark:bg-green-500/15 dark:text-green-500">
                  <CheckIcon className="h-4 w-4" />
                  Default set
                </span>
              )}
              {!isConnected && apiKey === "" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                  <XMarkIcon className="h-4 w-4" />
                  No default (use environment configuration or org integration)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
