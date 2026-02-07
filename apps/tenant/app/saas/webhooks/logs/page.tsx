"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { ArrowDownTrayIcon, MagnifyingGlassIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface WebhookLog {
  id: string;
  webhook: string;
  event: string;
  url: string;
  status: "success" | "failed";
  statusCode?: number;
  timestamp: string;
  responseTime: number;
  error?: string;
}

const webhookLogs: WebhookLog[] = [
  {
    id: "1",
    webhook: "Order Created",
    event: "order.created",
    url: "https://api.example.com/webhooks/orders",
    status: "success",
    statusCode: 200,
    timestamp: "2025-01-16 14:30:22",
    responseTime: 145,
  },
  {
    id: "2",
    webhook: "Payment Webhook",
    event: "payment.succeeded",
    url: "https://api.example.com/webhooks/payments",
    status: "success",
    statusCode: 200,
    timestamp: "2025-01-16 14:25:15",
    responseTime: 89,
  },
  {
    id: "3",
    webhook: "User Events",
    event: "user.created",
    url: "https://api.example.com/webhooks/users",
    status: "failed",
    statusCode: 500,
    timestamp: "2025-01-16 14:20:08",
    responseTime: 5234,
    error: "Connection timeout",
  },
];

const statusIcons = {
  success: CheckIcon,
  failed: XMarkIcon,
};

const statusColors = {
  success: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500",
  failed: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-500",
};

export default function WebhookLogsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "success" | "failed">("all");

  const filteredLogs = webhookLogs.filter((log) => {
    const matchesSearch =
      log.webhook.toLowerCase().includes(search.toLowerCase()) ||
      log.event.toLowerCase().includes(search.toLowerCase()) ||
      log.url.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || log.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div>
      <PageBreadcrumb pageTitle="Webhook Logs" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Webhook Logs</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Monitor webhook delivery and response logs
            </p>
          </div>
          <Button variant="outline">
            <ArrowDownTrayIcon className="h-4 w-4" />
            Export Logs
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
            />
          </div>
          <div className="flex gap-2">
            {(["all", "success", "failed"] as const).map((status) => (
              <Button
                key={status}
                variant={filter === status ? "primary" : "outline"}
                size="sm"
                onClick={() => setFilter(status)}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ))}
          </div>
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
                    Webhook
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    URL
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Status Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Response Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredLogs.map((log) => {
                  const Icon = statusIcons[log.status];
                  return (
                    <tr key={log.id}>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{log.timestamp}</td>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                        {log.webhook}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{log.event}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{log.url}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {log.statusCode || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {log.responseTime}ms
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[log.status]}`}
                        >
                          <Icon className="h-3 w-3" />
                          {log.status}
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

