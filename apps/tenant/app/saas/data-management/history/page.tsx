"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { CheckIcon, XMarkIcon, ClockIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import React from "react";

interface DataOperation {
  id: string;
  type: "export" | "import";
  name: string;
  status: "completed" | "processing" | "failed";
  recordsProcessed: number;
  recordsTotal: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

const operations: DataOperation[] = [
  {
    id: "1",
    type: "export",
    name: "All Users Export",
    status: "completed",
    recordsProcessed: 12480,
    recordsTotal: 12480,
    startedAt: "2025-01-16 10:00 AM",
    completedAt: "2025-01-16 10:05 AM",
  },
  {
    id: "2",
    type: "import",
    name: "User Import - Batch 1",
    status: "completed",
    recordsProcessed: 500,
    recordsTotal: 500,
    startedAt: "2025-01-15 02:00 PM",
    completedAt: "2025-01-15 02:03 PM",
  },
  {
    id: "3",
    type: "import",
    name: "Subscription Import",
    status: "processing",
    recordsProcessed: 2340,
    recordsTotal: 5000,
    startedAt: "2025-01-16 11:00 AM",
  },
  {
    id: "4",
    type: "export",
    name: "Invoice Export",
    status: "failed",
    recordsProcessed: 0,
    recordsTotal: 1000,
    startedAt: "2025-01-14 09:00 AM",
    error: "Connection timeout",
  },
];

const statusIcons = {
  completed: CheckIcon,
  processing: ClockIcon,
  failed: XMarkIcon,
};

const statusColors = {
  completed: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-500",
  failed: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-500",
};

export default function DataManagementHistoryPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Data Management History" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
            Data Management History
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            View history of all data export and import operations
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Operation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Started At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Completed At
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {operations.map((op) => {
                  const Icon = statusIcons[op.status];
                  const progress = (op.recordsProcessed / op.recordsTotal) * 100;
                  return (
                    <tr key={op.id}>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{op.name}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            op.type === "export"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-500"
                              : "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-500"
                          }`}
                        >
                          {op.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[op.status]}`}
                        >
                          <Icon className="h-3 w-3" />
                          {op.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                            <div
                              className={`h-full ${
                                op.status === "failed"
                                  ? "bg-red-500"
                                  : op.status === "processing"
                                  ? "bg-blue-500"
                                  : "bg-green-500"
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {op.recordsProcessed.toLocaleString()} / {op.recordsTotal.toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {op.startedAt}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {op.completedAt || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end">
                          {op.status === "completed" && op.type === "export" && (
                            <Button variant="outline" size="sm">
                              <ArrowDownTrayIcon className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
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

