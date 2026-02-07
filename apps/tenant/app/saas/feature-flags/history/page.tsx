"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import React from "react";

interface FlagHistory {
  id: string;
  flag: string;
  action: "created" | "enabled" | "disabled" | "updated" | "deleted";
  user: string;
  timestamp: string;
  changes?: string;
}

const history: FlagHistory[] = [
  {
    id: "1",
    flag: "New Dashboard UI",
    action: "enabled",
    user: "admin@example.com",
    timestamp: "2025-01-16 10:30 AM",
    changes: "Enabled for 50% of users",
  },
  {
    id: "2",
    flag: "Beta Features",
    action: "created",
    user: "admin@example.com",
    timestamp: "2025-01-15 02:15 PM",
  },
  {
    id: "3",
    flag: "Advanced Analytics",
    action: "updated",
    user: "admin@example.com",
    timestamp: "2025-01-14 09:00 AM",
    changes: "Changed targeting from 'all' to 'enterprise_customers'",
  },
];

const actionColors = {
  created: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-500",
  enabled: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500",
  disabled: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-500",
  updated: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-500",
  deleted: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export default function FeatureFlagHistoryPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Feature Flag History" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Flag History</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Track all changes to feature flags
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Feature Flag
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Changes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {history.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                      {item.timestamp}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{item.flag}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${actionColors[item.action]}`}
                      >
                        {item.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{item.user}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {item.changes || "—"}
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

