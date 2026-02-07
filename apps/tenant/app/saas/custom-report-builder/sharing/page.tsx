"use client";

export const dynamic = 'force-dynamic';

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { PlusIcon, PencilIcon, UserIcon, TrashIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface SharedReport {
  id: string;
  reportName: string;
  sharedWith: string[];
  permission: "view" | "edit";
  isPublic: boolean;
  shareLink?: string;
}

const sharedReports: SharedReport[] = [
  {
    id: "1",
    reportName: "Monthly User Growth",
    sharedWith: ["finance@example.com", "product@example.com"],
    permission: "view",
    isPublic: false,
  },
  {
    id: "2",
    reportName: "Revenue by Plan",
    sharedWith: ["ceo@example.com"],
    permission: "edit",
    isPublic: false,
  },
  {
    id: "3",
    reportName: "Public Dashboard",
    sharedWith: [],
    permission: "view",
    isPublic: true,
    shareLink: "https://reports.example.com/public/dashboard",
  },
];

export default function ReportSharingPage() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    report: "",
    email: "",
    permission: "view" as "view" | "edit",
  });

  return (
    <div>
      <PageBreadcrumb pageTitle="Report Sharing" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Report Sharing</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Manage sharing and permissions for custom reports
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <PlusIcon className="h-4 w-4" />
            Share Report
          </Button>
        </div>

        {showForm && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Share Report</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="share-report">Select Report</Label>
                <select
                  id="share-report"
                  value={formData.report}
                  onChange={(e) => setFormData({ ...formData, report: e.target.value })}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                >
                  <option value="">Select report</option>
                  <option value="monthly-growth">Monthly User Growth</option>
                  <option value="revenue-plan">Revenue by Plan</option>
                </select>
              </div>
              <div>
                <Label htmlFor="share-email">Email Address</Label>
                <Input
                  id="share-email"
                  type="email"
                  defaultValue={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <Label htmlFor="share-permission">Permission</Label>
                <select
                  id="share-permission"
                  value={formData.permission}
                  onChange={(e) =>
                    setFormData({ ...formData, permission: e.target.value as "view" | "edit" })
                  }
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                >
                  <option value="view">View Only</option>
                  <option value="edit">Can Edit</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button>Share Report</Button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Report Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Shared With
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Permission
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Public Link
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {sharedReports.map((report) => (
                  <tr key={report.id}>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {report.reportName}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {report.sharedWith.length > 0 ? (
                          report.sharedWith.map((email) => (
                            <span
                              key={email}
                              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                            >
                              <UserIcon className="h-3 w-3" />
                              {email}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-gray-500 dark:text-gray-400">Public</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-500/15 dark:text-blue-500">
                        {report.permission}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {report.isPublic && report.shareLink ? (
                        <a
                          href={report.shareLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-brand-600 hover:underline dark:text-brand-500"
                        >
                          View Link
                        </a>
                      ) : (
                        <span className="text-sm text-gray-500 dark:text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm">
                          <PencilIcon className="h-4 w-4" />
                        </Button>
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

