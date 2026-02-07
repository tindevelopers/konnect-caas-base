"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { PlusIcon, PencilIcon, BellIcon, TrashIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface UsageAlert {
  id: string;
  name: string;
  feature: string;
  threshold: number;
  plan?: string;
  notificationChannels: string[];
  isActive: boolean;
}

const alerts: UsageAlert[] = [
  {
    id: "1",
    name: "High Storage Usage",
    feature: "Storage",
    threshold: 80,
    plan: "All Plans",
    notificationChannels: ["Email", "In-app"],
    isActive: true,
  },
  {
    id: "2",
    name: "Order Limit Warning",
    feature: "Monthly Orders",
    threshold: 90,
    plan: "Starter",
    notificationChannels: ["Email"],
    isActive: true,
  },
];

export default function UsageAlertsPage() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    feature: "",
    threshold: "",
    plan: "",
    channels: [] as string[],
  });

  return (
    <div>
      <PageBreadcrumb pageTitle="Usage Alerts" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Usage Alerts</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Configure alerts for usage thresholds
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <PlusIcon className="h-4 w-4" />
            Create Alert
          </Button>
        </div>

        {showForm && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Create Alert</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="alert-name">Alert Name</Label>
                <Input
                  id="alert-name"
                  type="text"
                  defaultValue={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., High Storage Usage"
                />
              </div>
              <div>
                <Label htmlFor="feature">Feature</Label>
                <Input
                  id="feature"
                  type="text"
                  defaultValue={formData.feature}
                  onChange={(e) => setFormData({ ...formData, feature: e.target.value })}
                  placeholder="e.g., Storage"
                />
              </div>
              <div>
                <Label htmlFor="threshold">Threshold (%)</Label>
                <Input
                  id="threshold"
                  type="number"
                  defaultValue={formData.threshold}
                  onChange={(e) => setFormData({ ...formData, threshold: e.target.value })}
                  placeholder="80"
                />
              </div>
              <div>
                <Label htmlFor="plan">Plan (Optional)</Label>
                <Input
                  id="plan"
                  type="text"
                  defaultValue={formData.plan}
                  onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                  placeholder="Leave empty for all plans"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button>Create Alert</Button>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-500/15">
                    <BellIcon className="h-5 w-5 text-blue-600 dark:text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{alert.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{alert.feature}</p>
                  </div>
                </div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    alert.isActive
                      ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500"
                      : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  {alert.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Threshold</span>
                  <span className="font-medium text-gray-900 dark:text-white">{alert.threshold}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Plan</span>
                  <span className="font-medium text-gray-900 dark:text-white">{alert.plan}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Channels</span>
                  <div className="flex gap-1">
                    {alert.notificationChannels.map((channel) => (
                      <span
                        key={channel}
                        className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      >
                        {channel}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
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
    </div>
  );
}

