"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import React from "react";

interface UsageMetric {
  plan: string;
  feature: string;
  current: number;
  limit: number;
  percentage: number;
}

const usageMetrics: UsageMetric[] = [
  { plan: "Starter", feature: "Monthly Orders", current: 8234, limit: 10000, percentage: 82.3 },
  { plan: "Professional", feature: "Monthly Orders", current: 15299, limit: 25500, percentage: 60.0 },
  { plan: "Pro", feature: "Monthly Orders", current: 31000, limit: 50000, percentage: 62.0 },
  { plan: "Starter", feature: "Storage", current: 3.2, limit: 5, percentage: 64.0 },
  { plan: "Professional", feature: "Storage", current: 7.8, limit: 10, percentage: 78.0 },
  { plan: "Pro", feature: "Storage", current: 32.5, limit: 50, percentage: 65.0 },
];

export default function UsageDashboardPage() {
  const getColor = (percentage: number) => {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 75) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Usage Dashboard" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Usage Dashboard</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Monitor usage across all plans and features
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Active Plans</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">418</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">Avg Usage</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">68.5%</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">Near Limit</p>
            <p className="mt-2 text-3xl font-semibold text-red-600 dark:text-red-500">12</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">Over Limit</p>
            <p className="mt-2 text-3xl font-semibold text-red-600 dark:text-red-500">3</p>
          </div>
        </div>

        {/* Usage Table */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Feature
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Usage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Limit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Percentage
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {usageMetrics.map((metric, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{metric.plan}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{metric.feature}</td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {metric.current.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                      {metric.limit.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                          <div
                            className={`h-full ${getColor(metric.percentage)}`}
                            style={{ width: `${metric.percentage}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {metric.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

