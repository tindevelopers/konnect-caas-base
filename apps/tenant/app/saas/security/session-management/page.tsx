"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import React, { useState } from "react";
import { TrashIcon } from "@heroicons/react/24/outline";

interface Session {
  id: string;
  user: string;
  ipAddress: string;
  device: string;
  location: string;
  lastActivity: string;
  status: "active" | "expired";
}

const sessions: Session[] = [
  {
    id: "1",
    user: "jane.smith@example.com",
    ipAddress: "192.168.1.100",
    device: "Chrome on macOS",
    location: "San Francisco, CA",
    lastActivity: "2 minutes ago",
    status: "active",
  },
  {
    id: "2",
    user: "jane.smith@example.com",
    ipAddress: "192.168.1.105",
    device: "Safari on iPhone",
    location: "San Francisco, CA",
    lastActivity: "1 hour ago",
    status: "active",
  },
  {
    id: "3",
    user: "admin@example.com",
    ipAddress: "203.0.113.45",
    device: "Firefox on Windows",
    location: "New York, NY",
    lastActivity: "3 days ago",
    status: "expired",
  },
];

export default function SessionManagementPage() {
  const [filter, setFilter] = useState<"all" | "active" | "expired">("all");

  const filteredSessions =
    filter === "all"
      ? sessions
      : sessions.filter((session) => session.status === filter);

  return (
    <div>
      <PageBreadcrumb pageTitle="Session Management" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Session Management</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Monitor and manage user sessions
            </p>
          </div>
          <div className="flex gap-2">
            {(["all", "active", "expired"] as const).map((status) => (
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
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Device
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    IP Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Last Activity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredSessions.map((session) => (
                  <tr key={session.id}>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {session.user}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{session.device}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {session.ipAddress}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {session.location}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {session.lastActivity}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          session.status === "active"
                            ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                      >
                        {session.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end">
                        <Button variant="outline" size="sm">
                          <TrashIcon className="h-4 w-4" />
                        </Button>
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

