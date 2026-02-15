"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Alert from "@/components/ui/alert/Alert";
import Label from "@/components/form/Label";
import {
  getTenantCostSummariesAction,
  listTenantUsageCostsAction,
  type UsageCostSummary,
  type TenantUsageCost,
  type CostType,
} from "@/app/actions/billing/usage-costs";
import { getPlatformPricingSettingsAction } from "@/app/actions/billing/pricing";
import { getAllTenants } from "@/app/actions/tenants";
import {
  CurrencyDollarIcon,
  PhoneIcon,
  CpuChipIcon,
  ArrowPathIcon,
  FunnelIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@heroicons/react/24/outline";

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const COST_TYPE_LABELS: Record<CostType, string> = {
  ai_minutes: "AI Minutes",
  number_upfront: "Number (Upfront)",
  number_monthly: "Number (Monthly)",
};

const COST_TYPE_COLORS: Record<CostType, string> = {
  ai_minutes: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  number_upfront: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  number_monthly: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

export default function TenantCostsPage() {
  const [summaries, setSummaries] = useState<UsageCostSummary[]>([]);
  const [details, setDetails] = useState<TenantUsageCost[]>([]);
  const [detailsTotal, setDetailsTotal] = useState(0);
  const [platformMarkup, setPlatformMarkup] = useState(25);
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);

  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  // Filters
  const [filterTenantId, setFilterTenantId] = useState("");
  const [filterCostType, setFilterCostType] = useState<CostType | "">("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  // Detail view
  const [expandedTenantId, setExpandedTenantId] = useState<string | null>(null);
  const [detailPage, setDetailPage] = useState(0);
  const PAGE_SIZE = 20;

  const loadSummaries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sums, platform, tenantList] = await Promise.all([
        getTenantCostSummariesAction({
          startDate: filterStartDate || undefined,
          endDate: filterEndDate || undefined,
        }),
        getPlatformPricingSettingsAction(),
        getAllTenants(),
      ]);
      setSummaries(sums);
      setPlatformMarkup(platform.markup_percent);
      setTenants(tenantList.map((t: any) => ({ id: t.id, name: t.name })));
    } catch (e: any) {
      if (e.message?.includes("Platform Admin")) {
        setAccessDenied(true);
      } else {
        setError(e.message ?? "Failed to load cost data");
      }
    } finally {
      setLoading(false);
    }
  }, [filterStartDate, filterEndDate]);

  useEffect(() => {
    void loadSummaries();
  }, [loadSummaries]);

  async function loadDetails(tenantId: string, page = 0) {
    setDetailsLoading(true);
    try {
      const res = await listTenantUsageCostsAction({
        tenantId,
        costType: filterCostType || undefined,
        startDate: filterStartDate || undefined,
        endDate: filterEndDate || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setDetails(res.data);
      setDetailsTotal(res.total);
      setDetailPage(page);
    } catch (e: any) {
      setError(e.message ?? "Failed to load details");
    } finally {
      setDetailsLoading(false);
    }
  }

  function handleExpandTenant(tenantId: string) {
    if (expandedTenantId === tenantId) {
      setExpandedTenantId(null);
      setDetails([]);
      return;
    }
    setExpandedTenantId(tenantId);
    void loadDetails(tenantId, 0);
  }

  // Totals
  const totals = useMemo(() => {
    return summaries.reduce(
      (acc, s) => ({
        totalCost: acc.totalCost + s.total_cost,
        totalBilled: acc.totalBilled + s.total_billed,
        aiCost: acc.aiCost + s.ai_minutes_cost,
        aiBilled: acc.aiBilled + s.ai_minutes_billed,
        numberCost: acc.numberCost + s.number_upfront_cost + s.number_monthly_cost,
        numberBilled: acc.numberBilled + s.number_upfront_billed + s.number_monthly_billed,
        events: acc.events + s.event_count,
      }),
      { totalCost: 0, totalBilled: 0, aiCost: 0, aiBilled: 0, numberCost: 0, numberBilled: 0, events: 0 }
    );
  }, [summaries]);

  const filteredSummaries = useMemo(() => {
    if (!filterTenantId) return summaries;
    return summaries.filter((s) => s.tenant_id === filterTenantId);
  }, [summaries, filterTenantId]);

  if (accessDenied) {
    return (
      <div className="p-8">
        <Alert variant="error" title="Access Denied" message="Only Platform Admins can access tenant costs." />
      </div>
    );
  }

  return (
    <div>
      <PageBreadcrumb pageTitle="Tenant Costs & Billing" />

      {error && (
        <div className="mb-4">
          <Alert variant="error" title="Error" message={error} />
        </div>
      )}

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3 mb-2">
            <CurrencyDollarIcon className="h-5 w-5 text-gray-400" />
            <span className="text-sm text-gray-500 dark:text-gray-400">Total Provider Cost</span>
          </div>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{formatCurrency(totals.totalCost)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3 mb-2">
            <CurrencyDollarIcon className="h-5 w-5 text-brand-500" />
            <span className="text-sm text-gray-500 dark:text-gray-400">Total Billed (with markup)</span>
          </div>
          <p className="text-2xl font-semibold text-brand-600 dark:text-brand-400">{formatCurrency(totals.totalBilled)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3 mb-2">
            <CpuChipIcon className="h-5 w-5 text-purple-500" />
            <span className="text-sm text-gray-500 dark:text-gray-400">AI Consumption</span>
          </div>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{formatCurrency(totals.aiCost)}</p>
          <p className="text-xs text-gray-400">Billed: {formatCurrency(totals.aiBilled)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3 mb-2">
            <PhoneIcon className="h-5 w-5 text-blue-500" />
            <span className="text-sm text-gray-500 dark:text-gray-400">Number Costs</span>
          </div>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{formatCurrency(totals.numberCost)}</p>
          <p className="text-xs text-gray-400">Billed: {formatCurrency(totals.numberBilled)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2 mb-3">
          <FunnelIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <Label htmlFor="filter-tenant">Tenant</Label>
            <select
              id="filter-tenant"
              value={filterTenantId}
              onChange={(e) => setFilterTenantId(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            >
              <option value="">All tenants</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-40">
            <Label htmlFor="filter-type">Cost Type</Label>
            <select
              id="filter-type"
              value={filterCostType}
              onChange={(e) => setFilterCostType(e.target.value as CostType | "")}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            >
              <option value="">All types</option>
              <option value="ai_minutes">AI Minutes</option>
              <option value="number_upfront">Number (Upfront)</option>
              <option value="number_monthly">Number (Monthly)</option>
            </select>
          </div>
          <div className="w-40">
            <Label htmlFor="filter-start">Start Date</Label>
            <input
              id="filter-start"
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            />
          </div>
          <div className="w-40">
            <Label htmlFor="filter-end">End Date</Label>
            <input
              id="filter-end"
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            />
          </div>
          <Button variant="outline" onClick={loadSummaries} disabled={loading}>
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Per-Tenant Summary Table */}
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 p-5 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">
            Cost Breakdown by Tenant
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Platform default markup: {platformMarkup}%. Click a tenant row to see individual cost events.
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : filteredSummaries.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No cost data recorded yet. Costs are tracked when AI calls end or phone numbers are ordered.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                  <th className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Tenant</th>
                  <th className="px-5 py-3 text-right font-medium text-gray-600 dark:text-gray-300">AI Cost</th>
                  <th className="px-5 py-3 text-right font-medium text-gray-600 dark:text-gray-300">Number Cost</th>
                  <th className="px-5 py-3 text-right font-medium text-gray-600 dark:text-gray-300">Total Cost</th>
                  <th className="px-5 py-3 text-right font-medium text-gray-600 dark:text-gray-300">Total Billed</th>
                  <th className="px-5 py-3 text-right font-medium text-gray-600 dark:text-gray-300">Margin</th>
                  <th className="px-5 py-3 text-center font-medium text-gray-600 dark:text-gray-300">Events</th>
                  <th className="px-5 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filteredSummaries.map((s) => {
                  const margin = s.total_billed - s.total_cost;
                  const isExpanded = expandedTenantId === s.tenant_id;
                  return (
                    <React.Fragment key={s.tenant_id}>
                      <tr
                        className="border-b border-gray-100 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/30 cursor-pointer"
                        onClick={() => handleExpandTenant(s.tenant_id)}
                      >
                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-white/90">
                          {s.tenant_name ?? s.tenant_id.slice(0, 8) + "..."}
                        </td>
                        <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-200">
                          {formatCurrency(s.ai_minutes_cost)}
                        </td>
                        <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-200">
                          {formatCurrency(s.number_upfront_cost + s.number_monthly_cost)}
                        </td>
                        <td className="px-5 py-3 text-right font-medium text-gray-900 dark:text-white">
                          {formatCurrency(s.total_cost)}
                        </td>
                        <td className="px-5 py-3 text-right font-medium text-brand-600 dark:text-brand-400">
                          {formatCurrency(s.total_billed)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className={margin >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                            {formatCurrency(margin)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center text-gray-500 dark:text-gray-400">
                          {s.event_count}
                        </td>
                        <td className="px-5 py-3 text-center">
                          {isExpanded ? (
                            <ChevronUpIcon className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                          )}
                        </td>
                      </tr>

                      {/* Expanded detail rows */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="bg-gray-50 px-5 py-4 dark:bg-gray-800/20">
                            {detailsLoading ? (
                              <p className="text-sm text-gray-400 text-center">Loading details...</p>
                            ) : details.length === 0 ? (
                              <p className="text-sm text-gray-400 text-center">No individual cost events.</p>
                            ) : (
                              <>
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                      <th className="py-2 pr-3 text-left font-medium text-gray-500">Date</th>
                                      <th className="py-2 pr-3 text-left font-medium text-gray-500">Type</th>
                                      <th className="py-2 pr-3 text-right font-medium text-gray-500">Provider Cost</th>
                                      <th className="py-2 pr-3 text-right font-medium text-gray-500">Markup</th>
                                      <th className="py-2 pr-3 text-right font-medium text-gray-500">Billed</th>
                                      <th className="py-2 pr-3 text-right font-medium text-gray-500">Units</th>
                                      <th className="py-2 pr-3 text-left font-medium text-gray-500">Source</th>
                                      <th className="py-2 text-left font-medium text-gray-500">Stripe</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {details.map((d) => (
                                      <tr key={d.id} className="border-b border-gray-100 dark:border-gray-800">
                                        <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">
                                          {formatDate(d.created_at)}
                                        </td>
                                        <td className="py-2 pr-3">
                                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${COST_TYPE_COLORS[d.cost_type]}`}>
                                            {COST_TYPE_LABELS[d.cost_type]}
                                          </span>
                                        </td>
                                        <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-200">
                                          {formatCurrency(d.cost_amount, d.currency)}
                                        </td>
                                        <td className="py-2 pr-3 text-right text-gray-500">
                                          {d.markup_percent}%
                                        </td>
                                        <td className="py-2 pr-3 text-right font-medium text-gray-900 dark:text-white">
                                          {formatCurrency(d.billed_amount, d.currency)}
                                        </td>
                                        <td className="py-2 pr-3 text-right text-gray-500">
                                          {d.units.toFixed(2)}
                                        </td>
                                        <td className="py-2 pr-3 text-gray-500 font-mono text-xs truncate max-w-[120px]">
                                          {d.source_id ? d.source_id.slice(0, 12) + "..." : "-"}
                                        </td>
                                        <td className="py-2 text-gray-400 text-xs">
                                          {d.stripe_usage_record_id ? (
                                            <span className="text-green-600 dark:text-green-400">Sent</span>
                                          ) : (
                                            <span className="text-gray-400">-</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>

                                {/* Pagination */}
                                {detailsTotal > PAGE_SIZE && (
                                  <div className="mt-3 flex items-center justify-between">
                                    <span className="text-xs text-gray-400">
                                      Showing {detailPage * PAGE_SIZE + 1}-{Math.min((detailPage + 1) * PAGE_SIZE, detailsTotal)} of {detailsTotal}
                                    </span>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void loadDetails(s.tenant_id, detailPage - 1);
                                        }}
                                        disabled={detailPage === 0}
                                        className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
                                      >
                                        Previous
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void loadDetails(s.tenant_id, detailPage + 1);
                                        }}
                                        disabled={(detailPage + 1) * PAGE_SIZE >= detailsTotal}
                                        className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
                                      >
                                        Next
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
