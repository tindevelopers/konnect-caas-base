"use client";

export const dynamic = 'force-dynamic';

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { PencilIcon, ArrowDownTrayIcon, EyeIcon } from "@heroicons/react/24/outline";
import { TrashIcon } from "@heroicons/react/24/outline";
import React from "react";

interface SavedReport {
  id: string;
  name: string;
  description: string;
  fields: string[];
  lastRun?: string;
  createdBy: string;
  createdAt: string;
}

const savedReports: SavedReport[] = [
  {
    id: "1",
    name: "Monthly User Growth",
    description: "Track user signups and growth over time",
    fields: ["User Count", "Signup Date", "Plan Type"],
    lastRun: "2025-01-16 10:00 AM",
    createdBy: "admin@example.com",
    createdAt: "2025-01-01",
  },
  {
    id: "2",
    name: "Revenue by Plan",
    description: "Revenue breakdown by subscription plan",
    fields: ["Revenue", "Plan Type"],
    lastRun: "2025-01-15 02:00 PM",
    createdBy: "finance@example.com",
    createdAt: "2024-12-15",
  },
];

export default function SavedReportsPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Saved Reports" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Saved Reports</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            View and manage your saved custom reports
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {savedReports.map((report) => (
            <div
              key={report.id}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{report.name}</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{report.description}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <PencilIcon className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mb-4">
                <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Fields</p>
                <div className="flex flex-wrap gap-2">
                  {report.fields.map((field) => (
                    <span
                      key={field}
                      className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs text-blue-700 dark:bg-blue-500/15 dark:text-blue-500"
                    >
                      {field}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mb-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Created by</span>
                  <span className="text-gray-900 dark:text-white">{report.createdBy}</span>
                </div>
                {report.lastRun && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Last run</span>
                    <span className="text-gray-900 dark:text-white">{report.lastRun}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <EyeIcon className="h-4 w-4" />
                  View
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  Export
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

