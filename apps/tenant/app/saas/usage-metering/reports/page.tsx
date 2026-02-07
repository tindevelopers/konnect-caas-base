"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { ArrowDownTrayIcon, CalendarIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface UsageReport {
  id: string;
  customer: string;
  plan: string;
  feature: string;
  usage: number;
  limit: number;
  period: string;
  status: "within_limit" | "near_limit" | "over_limit";
}

const reports: UsageReport[] = [
  {
    id: "1",
    customer: "Acme Corp",
    plan: "Professional",
    feature: "Monthly Orders",
    usage: 15299,
    limit: 25500,
    period: "January",
    status: "within_limit",
  },
  {
    id: "2",
    customer: "TechStart Inc",
    plan: "Pro",
    feature: "Storage",
    usage: 48.5,
    limit: 50,
    period: "2025-01",
    status: "near_limit",
  },
  {
    id: "3",
    customer: "Global Solutions",
    plan: "Starter",
    feature: "Monthly Orders",
    usage: 10234,
    limit: 10000,
    period: "2025-01",
    status: "over_limit",
  },
];

export default function UsageReportsPage() {
  const [dateRange, setDateRange] = useState("2025-01");

  return (
    <div>
      <PageBreadcrumb pageTitle="Usage Reports" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Usage Reports</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Generate and export detailed usage reports
            </p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <input
                type="month"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="h-11 rounded-lg border border-gray-300 bg-transparent px-4 pr-10 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
              />
              <CalendarIcon className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            </div>
            <Button variant="outline">
              <ArrowDownTrayIcon className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Customer
                  </th>
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
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {reports.map((report) => {
                  const percentage = (report.usage / report.limit) * 100;
                  const statusColor =
                    report.status === "over_limit"
                      ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-500"
                      : report.status === "near_limit"
                      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-500"
                      : "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500";
                  return (
                    <tr key={report.id}>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                        {report.customer}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{report.plan}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{report.feature}</td>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                        {report.usage.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                        {report.limit.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
                          {percentage.toFixed(1)}%
                        </span>
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

