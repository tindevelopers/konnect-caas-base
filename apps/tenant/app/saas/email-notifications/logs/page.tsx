"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { CheckIcon, XMarkIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface EmailLog {
  id: string;
  recipient: string;
  subject: string;
  template: string;
  status: "sent" | "failed" | "bounced" | "delivered";
  sentAt: string;
  openedAt?: string;
  clickedAt?: string;
}

const emailLogs: EmailLog[] = [
  {
    id: "1",
    recipient: "user@example.com",
    subject: "Welcome to SaaS Platform!",
    template: "Welcome Email",
    status: "delivered",
    sentAt: "2025-01-16 10:30 AM",
    openedAt: "2025-01-16 10:35 AM",
    clickedAt: "2025-01-16 10:40 AM",
  },
  {
    id: "2",
    recipient: "customer@example.com",
    subject: "Your invoice #INV-2025-001",
    template: "Invoice Receipt",
    status: "sent",
    sentAt: "2025-01-16 09:15 AM",
  },
  {
    id: "3",
    recipient: "invalid@example.com",
    subject: "Password reset request",
    template: "Password Reset",
    status: "bounced",
    sentAt: "2025-01-16 08:00 AM",
  },
  {
    id: "4",
    recipient: "user2@example.com",
    subject: "Monthly Newsletter",
    template: "Monthly Newsletter",
    status: "failed",
    sentAt: "2025-01-15 02:30 PM",
  },
];

const statusIcons = {
  sent: CheckIcon,
  failed: XMarkIcon,
  bounced: XMarkIcon,
  delivered: CheckIcon,
};

const statusColors = {
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-500",
  failed: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-500",
  bounced: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-500",
  delivered: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500",
};

export default function EmailLogsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const filteredLogs = emailLogs.filter((log) => {
    const matchesSearch =
      log.recipient.toLowerCase().includes(search.toLowerCase()) ||
      log.subject.toLowerCase().includes(search.toLowerCase()) ||
      log.template.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || log.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div>
      <PageBreadcrumb pageTitle="Email Logs" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Email Logs</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Monitor email delivery and engagement metrics
            </p>
          </div>
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
            {["all", "sent", "delivered", "failed", "bounced"].map((status) => (
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
                    Recipient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Template
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Sent At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Opened
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredLogs.map((log) => {
                  const Icon = statusIcons[log.status];
                  return (
                    <tr key={log.id}>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                        {log.recipient}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{log.subject}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{log.template}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[log.status]}`}
                        >
                          <Icon className="h-3 w-3" />
                          {log.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {log.sentAt}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {log.openedAt || "—"}
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

