"use client";

export const dynamic = "force-dynamic";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ProviderLogo from "@/components/integration/ProviderLogo";
import {
  integrationsCatalog,
  integrationCategories,
} from "@/app/saas/admin/system-admin/integrations/integrationsCatalog";
import { fetchIntegrationConfigs } from "@/app/actions/integrations/config";
import {
  CheckCircleIcon,
  MagnifyingGlassIcon,
  SignalIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";

type IntegrationRuntimeConfig = {
  status?: string | null;
  settings?: Record<string, unknown> | null;
  credentials?: Record<string, unknown> | null;
};

const statusFilterValues = ["all", "connected", "disconnected"] as const;
type StatusFilter = (typeof statusFilterValues)[number];

function slugifyCategory(category: string) {
  return category.toLowerCase().replace(/\s*\/\s*/g, "-").replace(/\s+/g, "-");
}

function hasCredentialValue(credentials: Record<string, unknown> | null | undefined) {
  if (!credentials) return false;
  return Object.values(credentials).some(
    (value) => String(value ?? "").trim().length > 0
  );
}

function getHealthState(config?: IntegrationRuntimeConfig) {
  const health = config?.settings?.health as
    | { status?: string; checkedAt?: string }
    | undefined;
  const status = (health?.status ?? "unknown").toLowerCase();

  if (status === "active" || status === "ok" || status === "connected") {
    return { active: true, label: "Active", checkedAt: health?.checkedAt };
  }
  if (status === "error" || status === "failed" || status === "inactive") {
    return { active: false, label: "Needs test", checkedAt: health?.checkedAt };
  }
  return { active: false, label: "Not tested", checkedAt: health?.checkedAt };
}

export default function IntegrationsListPage() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [configs, setConfigs] = useState<Record<string, IntegrationRuntimeConfig>>({});

  useEffect(() => {
    let mounted = true;
    async function loadConfigs() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const rows = await fetchIntegrationConfigs();
        if (!mounted) return;
        const next: Record<string, IntegrationRuntimeConfig> = {};
        for (const row of rows ?? []) {
          const provider = String((row as { provider?: unknown }).provider ?? "");
          if (!provider) continue;
          next[provider] = row as IntegrationRuntimeConfig;
        }
        setConfigs(next);
      } catch (error) {
        if (!mounted) return;
        setLoadError(
          error instanceof Error ? error.message : "Failed to load integrations."
        );
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void loadConfigs();
    return () => {
      mounted = false;
    };
  }, []);

  const categories = useMemo(() => ["All", ...integrationCategories], []);

  useEffect(() => {
    const categoryParam = searchParams.get("category");
    if (!categoryParam) return;
    const matched = categories.find(
      (item) => item.toLowerCase() === categoryParam.toLowerCase()
    );
    if (matched) {
      setSelectedCategory(matched);
    }
  }, [categories, searchParams]);

  const filteredCatalog = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return integrationsCatalog.filter((item) => {
      const matchesCategory =
        selectedCategory === "All" || item.category === selectedCategory;
      const cfg = configs[item.provider];
      const isConnected =
        cfg?.status === "connected" || hasCredentialValue(cfg?.credentials);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "connected" && isConnected) ||
        (statusFilter === "disconnected" && !isConnected);
      const matchesSearch =
        !normalized ||
        item.displayName.toLowerCase().includes(normalized) ||
        item.provider.toLowerCase().includes(normalized) ||
        item.description.toLowerCase().includes(normalized);

      return matchesCategory && matchesStatus && matchesSearch;
    });
  }, [configs, search, selectedCategory, statusFilter]);

  const connectedIntegrations = useMemo(
    () =>
      filteredCatalog.filter((item) => {
        const cfg = configs[item.provider];
        return cfg?.status === "connected" || hasCredentialValue(cfg?.credentials);
      }),
    [configs, filteredCatalog]
  );

  return (
    <div className="space-y-6">
      <PageBreadcrumb pageTitle="Integrations" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
            Integrations
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Connect products for CRM, scheduling, messaging, voice, billing, and AI.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search integrations..."
            className="h-11 w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {statusFilterValues.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                statusFilter === status
                  ? "bg-brand-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {status === "all"
                ? "All"
                : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setSelectedCategory(category)}
            className={`rounded-full px-4 py-1 text-sm font-medium ${
              selectedCategory === category
                ? "bg-brand-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
          {loadError}
        </div>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Connected Integrations
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          These integrations have credentials saved for your organization.
        </p>

        {isLoading ? (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        ) : connectedIntegrations.length === 0 ? (
          <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">
            There are no integrations connected yet.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {connectedIntegrations.map((item) => {
              const config = configs[item.provider];
              const health = getHealthState(config);
              return (
                <Link
                  key={`connected-${item.provider}`}
                  href={`/saas/integrations/${slugifyCategory(item.category)}/${item.provider}`}
                  className="rounded-xl border border-gray-200 p-4 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <ProviderLogo provider={item.provider} displayName={item.displayName} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                          {item.displayName}
                        </p>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                          {item.category}
                        </p>
                      </div>
                    </div>
                    <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-500/15 dark:text-green-300">
                      Connected
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        health.active
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                    >
                      <SignalIcon className="h-3 w-3" />
                      {health.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Add Integration
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Choose an integration to connect and test.
        </p>

        {isLoading ? (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        ) : filteredCatalog.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            No integrations match your filters.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredCatalog.map((item) => {
              const config = configs[item.provider];
              const connected =
                config?.status === "connected" || hasCredentialValue(config?.credentials);
              const health = getHealthState(config);

              return (
                <Link
                  key={item.provider}
                  href={`/saas/integrations/${slugifyCategory(item.category)}/${item.provider}`}
                  className="rounded-xl border border-gray-200 p-4 transition-shadow hover:shadow-sm dark:border-gray-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <ProviderLogo provider={item.provider} displayName={item.displayName} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                          {item.displayName}
                        </p>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                          {item.category}
                        </p>
                      </div>
                    </div>
                    {connected ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <XCircleIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    )}
                  </div>

                  <p className="mt-3 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                    {item.description}
                  </p>

                  <div className="mt-3 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        connected
                          ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                    >
                      {connected ? "Connected" : "Not connected"}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        health.active
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                    >
                      {health.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
