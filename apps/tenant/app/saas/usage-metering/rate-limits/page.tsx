"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { PlusIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface RateLimit {
  id: string;
  plan: string;
  endpoint: string;
  limit: number;
  window: string;
  isActive: boolean;
}

const rateLimits: RateLimit[] = [
  {
    id: "1",
    plan: "Starter",
    endpoint: "/api/v1/orders",
    limit: 100,
    window: "per minute",
    isActive: true,
  },
  {
    id: "2",
    plan: "Professional",
    endpoint: "/api/v1/orders",
    limit: 500,
    window: "per minute",
    isActive: true,
  },
  {
    id: "3",
    plan: "Pro",
    endpoint: "/api/v1/orders",
    limit: 2000,
    window: "per minute",
    isActive: true,
  },
];

export default function RateLimitsPage() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    plan: "",
    endpoint: "",
    limit: "",
    window: "per minute",
  });

  return (
    <div>
      <PageBreadcrumb pageTitle="Rate Limits" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Rate Limits</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Configure API rate limits for each plan
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <PlusIcon className="h-4 w-4" />
            Add Rate Limit
          </Button>
        </div>

        {showForm && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Add Rate Limit</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="plan">Plan</Label>
                <select
                  id="plan"
                  value={formData.plan}
                  onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                >
                  <option value="">Select plan</option>
                  <option value="starter">Starter</option>
                  <option value="professional">Professional</option>
                  <option value="pro">Pro</option>
                </select>
              </div>
              <div>
                <Label htmlFor="endpoint">Endpoint</Label>
                <Input
                  id="endpoint"
                  type="text"
                  defaultValue={formData.endpoint}
                  onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                  placeholder="/api/v1/orders"
                />
              </div>
              <div>
                <Label htmlFor="limit">Limit</Label>
                <Input
                  id="limit"
                  type="number"
                  defaultValue={formData.limit}
                  onChange={(e) => setFormData({ ...formData, limit: e.target.value })}
                  placeholder="100"
                />
              </div>
              <div>
                <Label htmlFor="window">Time Window</Label>
                <select
                  id="window"
                  value={formData.window}
                  onChange={(e) => setFormData({ ...formData, window: e.target.value })}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                >
                  <option value="per second">Per Second</option>
                  <option value="per minute">Per Minute</option>
                  <option value="per hour">Per Hour</option>
                  <option value="per day">Per Day</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button>Save Rate Limit</Button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Endpoint
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Limit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Time Window
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
                {rateLimits.map((limit) => (
                  <tr key={limit.id}>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{limit.plan}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{limit.endpoint}</td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{limit.limit}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{limit.window}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          limit.isActive
                            ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                      >
                        {limit.isActive ? "Active" : "Inactive"}
                      </span>
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

