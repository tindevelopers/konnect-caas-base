"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { PlusIcon, ArrowDownTrayIcon, CheckIcon, ClockIcon, XMarkIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface ExportJob {
  id: string;
  name: string;
  type: "users" | "subscriptions" | "invoices" | "custom";
  format: "csv" | "json" | "xlsx";
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: string;
  completedAt?: string;
  fileSize?: string;
  recordCount?: number;
}

const exportJobs: ExportJob[] = [
  {
    id: "1",
    name: "All Users Export",
    type: "users",
    format: "csv",
    status: "completed",
    createdAt: "2025-01-16 10:00 AM",
    completedAt: "2025-01-16 10:05 AM",
    fileSize: "5.2 MB",
    recordCount: 12480,
  },
  {
    id: "2",
    name: "Subscription Data",
    type: "subscriptions",
    format: "xlsx",
    status: "processing",
    createdAt: "2025-01-16 11:00 AM",
    recordCount: 8234,
  },
  {
    id: "3",
    name: "Invoice History",
    type: "invoices",
    format: "json",
    status: "failed",
    createdAt: "2025-01-15 02:00 PM",
  },
];

const statusIcons = {
  pending: ClockIcon,
  processing: ClockIcon,
  completed: CheckIcon,
  failed: XMarkIcon,
};

const statusColors = {
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-500",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-500",
  completed: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500",
  failed: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-500",
};

export default function ExportJobsPage() {
  const [jobs, setJobs] = useState<ExportJob[]>(exportJobs);
  const createModal = useModal();
  const [formData, setFormData] = useState({
    name: "",
    type: "users" as "users" | "subscriptions" | "invoices" | "custom",
    format: "csv" as "csv" | "json" | "xlsx",
  });

  const handleCreate = () => {
    const newJob: ExportJob = {
      id: Date.now().toString(),
      name: formData.name,
      type: formData.type,
      format: formData.format,
      status: "pending",
      createdAt: new Date().toLocaleString(),
    };
    setJobs([newJob, ...jobs]);
    createModal.closeModal();
    setFormData({ name: "", type: "users", format: "csv" });
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Export Jobs" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Export Jobs</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Create and manage data export jobs
            </p>
          </div>
          <Button onClick={createModal.openModal}>
            <PlusIcon className="h-4 w-4" />
            Create Export
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
                    Format
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Records
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Created At
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {jobs.map((job) => {
                  const Icon = statusIcons[job.status];
                  return (
                    <tr key={job.id}>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                        {job.name}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{job.type}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          {job.format.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[job.status]}`}
                        >
                          <Icon className="h-3 w-3" />
                          {job.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                        {job.recordCount?.toLocaleString() || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {job.createdAt}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end">
                          {job.status === "completed" && (
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

      {/* Create Export Modal */}
      <Modal isOpen={createModal.isOpen} onClose={createModal.closeModal} className="max-w-[600px] m-4">
        <div className="p-6">
          <h3 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Create Export</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="export-name">Export Name</Label>
              <Input
                id="export-name"
                type="text"
                defaultValue={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., All Users Export"
              />
            </div>
            <div>
              <Label htmlFor="export-type">Data Type</Label>
              <select
                id="export-type"
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as typeof formData.type })
                }
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
              >
                <option value="users">Users</option>
                <option value="subscriptions">Subscriptions</option>
                <option value="invoices">Invoices</option>
                <option value="custom">Custom Query</option>
              </select>
            </div>
            <div>
              <Label htmlFor="export-format">Export Format</Label>
              <select
                id="export-format"
                value={formData.format}
                onChange={(e) =>
                  setFormData({ ...formData, format: e.target.value as typeof formData.format })
                }
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
              >
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
                <option value="xlsx">Excel (XLSX)</option>
              </select>
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={createModal.closeModal} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleCreate} className="flex-1">
                Create Export
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

