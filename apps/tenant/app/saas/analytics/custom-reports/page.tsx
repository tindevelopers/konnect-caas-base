"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { PlusIcon, PencilIcon, ArrowDownTrayIcon, TrashIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface Report {
  id: string;
  name: string;
  description: string;
  schedule: "daily" | "weekly" | "monthly" | "manual";
  lastRun?: string;
  recipients: string[];
}

const reports: Report[] = [
  {
    id: "1",
    name: "Monthly Revenue Report",
    description: "Comprehensive revenue and subscription metrics",
    schedule: "monthly",
    lastRun: "2025-01-01",
    recipients: ["finance@example.com", "ceo@example.com"],
  },
  {
    id: "2",
    name: "Weekly User Activity",
    description: "User signups, activations, and engagement metrics",
    schedule: "weekly",
    lastRun: "2025-01-15",
    recipients: ["product@example.com"],
  },
  {
    id: "3",
    name: "Daily System Health",
    description: "System performance and error rates",
    schedule: "daily",
    lastRun: "2025-01-16",
    recipients: ["devops@example.com"],
  },
];

export default function CustomReportsPage() {
  const [reportList, setReportList] = useState<Report[]>(reports);
  const createModal = useModal();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    schedule: "manual" as "daily" | "weekly" | "monthly" | "manual",
    recipients: "",
  });

  const handleCreate = () => {
    const newReport: Report = {
      id: Date.now().toString(),
      name: formData.name,
      description: formData.description,
      schedule: formData.schedule,
      recipients: formData.recipients.split(",").map((r) => r.trim()),
    };
    setReportList([...reportList, newReport]);
    createModal.closeModal();
    setFormData({ name: "", description: "", schedule: "manual", recipients: "" });
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Custom Reports" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Custom Reports</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Create and schedule custom analytics reports
            </p>
          </div>
          <Button onClick={createModal.openModal}>
            <PlusIcon className="h-4 w-4" />
            Create Report
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {reportList.map((report) => (
            <div
              key={report.id}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{report.name}</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{report.description}</p>
                </div>
                <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-500/15 dark:text-blue-500">
                  {report.schedule}
                </span>
              </div>
              <div className="mb-4 space-y-2">
                {report.lastRun && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Last Run</span>
                    <span className="font-medium text-gray-900 dark:text-white">{report.lastRun}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Recipients</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {report.recipients.length}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  Export
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <PencilIcon className="h-4 w-4" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <TrashIcon className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Report Modal */}
      <Modal isOpen={createModal.isOpen} onClose={createModal.closeModal} className="max-w-[600px] m-4">
        <div className="p-6">
          <h3 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Create Report</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="report-name">Report Name</Label>
              <Input
                id="report-name"
                type="text"
                defaultValue={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Monthly Revenue Report"
              />
            </div>
            <div>
              <Label htmlFor="report-description">Description</Label>
              <textarea
                id="report-description"
                defaultValue={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                placeholder="Describe what this report contains"
              />
            </div>
            <div>
              <Label htmlFor="report-schedule">Schedule</Label>
              <select
                id="report-schedule"
                value={formData.schedule}
                onChange={(e) =>
                  setFormData({ ...formData, schedule: e.target.value as typeof formData.schedule })
                }
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
              >
                <option value="manual">Manual</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <Label htmlFor="report-recipients">Recipients (comma-separated emails)</Label>
              <Input
                id="report-recipients"
                type="text"
                defaultValue={formData.recipients}
                onChange={(e) => setFormData({ ...formData, recipients: e.target.value })}
                placeholder="email1@example.com, email2@example.com"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={createModal.closeModal} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleCreate} className="flex-1">
                Create Report
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

