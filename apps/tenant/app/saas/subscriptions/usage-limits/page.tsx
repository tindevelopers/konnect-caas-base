"use client";

export const dynamic = 'force-dynamic';

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import { PencilIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface UsageLimit {
  plan: string;
  feature: string;
  limit: number;
  current: number;
  unit: string;
}

const usageLimits: UsageLimit[] = [
  { plan: "Starter", feature: "Monthly Orders", limit: 10000, current: 8234, unit: "orders" },
  { plan: "Starter", feature: "Storage", limit: 5, current: 3.2, unit: "GB" },
  { plan: "Professional", feature: "Monthly Orders", limit: 25500, current: 15299, unit: "orders" },
  { plan: "Professional", feature: "Storage", limit: 10, current: 7.8, unit: "GB" },
  { plan: "Pro", feature: "Monthly Orders", limit: 50000, current: 31000, unit: "orders" },
  { plan: "Pro", feature: "Storage", limit: 50, current: 32.5, unit: "GB" },
];

export default function UsageLimitsPage() {
  const [editingId, setEditingId] = useState<string | null>(null);

  const getUsagePercentage = (current: number, limit: number) => {
    return Math.min((current / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 75) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Usage Limits" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Usage Limits</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Configure and monitor usage limits for each plan and feature
          </p>
        </div>

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
                    Limit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Current Usage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Usage %
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {usageLimits.map((limit, idx) => {
                  const percentage = getUsagePercentage(limit.current, limit.limit);
                  const id = `${limit.plan}-${limit.feature}`;
                  return (
                    <tr key={idx}>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{limit.plan}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{limit.feature}</td>
                      <td className="px-6 py-4">
                        {editingId === id ? (
                          <Input
                            type="number"
                            defaultValue={limit.limit.toString()}
                            className="w-24"
                          />
                        ) : (
                          <span className="text-gray-900 dark:text-white">
                            {limit.limit} {limit.unit}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-900 dark:text-white">
                          {limit.current} {limit.unit}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                            <div
                              className={`h-full ${getUsageColor(percentage)}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingId(editingId === id ? null : id)}
                        >
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

