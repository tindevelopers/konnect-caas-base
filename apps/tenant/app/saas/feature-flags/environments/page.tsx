"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { PlusIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface Environment {
  id: string;
  name: string;
  key: string;
  apiKey: string;
  isProduction: boolean;
  flagCount: number;
}

const environments: Environment[] = [
  {
    id: "1",
    name: "Production",
    key: "production",
    apiKey: "env_prod_abc123...",
    isProduction: true,
    flagCount: 12,
  },
  {
    id: "2",
    name: "Staging",
    key: "staging",
    apiKey: "env_staging_xyz789...",
    isProduction: false,
    flagCount: 8,
  },
  {
    id: "3",
    name: "Development",
    key: "development",
    apiKey: "env_dev_def456...",
    isProduction: false,
    flagCount: 15,
  },
];

export default function FeatureFlagEnvironmentsPage() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    key: "",
    isProduction: false,
  });

  return (
    <div>
      <PageBreadcrumb pageTitle="Feature Flag Environments" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Environments</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Manage environments for feature flags
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <PlusIcon className="h-4 w-4" />
            Add Environment
          </Button>
        </div>

        {showForm && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Add Environment
            </h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="env-name">Environment Name</Label>
                <Input
                  id="env-name"
                  type="text"
                  defaultValue={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Production"
                />
              </div>
              <div>
                <Label htmlFor="env-key">Environment Key</Label>
                <Input
                  id="env-key"
                  type="text"
                  defaultValue={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  placeholder="e.g., production"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button>Save Environment</Button>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {environments.map((env) => (
            <div
              key={env.id}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{env.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{env.key}</p>
                </div>
                {env.isProduction && (
                  <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-500/15 dark:text-green-500">
                    Production
                  </span>
                )}
              </div>
              <div className="mb-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">API Key</span>
                  <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
                    {env.apiKey}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Feature Flags</span>
                  <span className="font-medium text-gray-900 dark:text-white">{env.flagCount}</span>
                </div>
              </div>
              <div className="flex gap-2">
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

