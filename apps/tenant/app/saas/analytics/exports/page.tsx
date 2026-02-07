"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { ArrowDownTrayIcon, CheckIcon, ClockIcon } from "@heroicons/react/24/outline";
import React from "react";

interface Export {
  id: string;
  name: string;
  type: "csv" | "json" | "xlsx";
  status: "completed" | "processing" | "failed";
  createdAt: string;
  completedAt?: string;
  fileSize?: string;
  downloadUrl?: string;
}

const exports: Export[] = [
  {
    id: "1",
    name: "User Export - January 2025",
    type: "csv",
    status: "completed",
    createdAt: "2025-01-16 10:00 AM",
    completedAt: "2025-01-16 10:02 AM",
    fileSize: "2.5 MB",
    downloadUrl: "#",
  },
  {
    id: "2",
    name: "Subscription Data Export",
    type: "xlsx",
    status: "processing",
    createdAt: "2025-01-16 11:00 AM",
  },
  {
    id: "3",
    name: "Analytics Events - JSON",
    type: "json",
    status: "completed",
    createdAt: "2025-01-15 02:00 PM",
    completedAt: "2025-01-15 02:05 PM",
    fileSize: "15.3 MB",
    downloadUrl: "#",
  },
];

const statusIcons = {
  completed: CheckIcon,
  processing: ClockIcon,
  failed: CheckIcon,
};

const statusColors = {
  completed: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-500",
  failed: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-500",
};

export default function AnalyticsExportsPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Analytics Exports" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Analytics Exports</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              View and download exported analytics data
            </p>
          </div>
          <Button>
            <ArrowDownTrayIcon className="h-4 w-4" />
            New Export
          </Button>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Export Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Created At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    File Size
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {exports.map((exportItem) => {
                  const Icon = statusIcons[exportItem.status];
                  return (
                    <tr key={exportItem.id}>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                        {exportItem.name}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          {exportItem.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[exportItem.status]}`}
                        >
                          <Icon className="h-3 w-3" />
                          {exportItem.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {exportItem.createdAt}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {exportItem.fileSize || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end">
                          {exportItem.status === "completed" && exportItem.downloadUrl && (
                            <Button variant="outline" size="sm">
                              <ArrowDownTrayIcon className="h-4 w-4" />
                              Download
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

