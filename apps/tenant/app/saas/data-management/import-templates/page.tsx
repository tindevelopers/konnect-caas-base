"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { PlusIcon, PencilIcon, ArrowUpTrayIcon, TrashIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface ImportTemplate {
  id: string;
  name: string;
  type: "users" | "subscriptions" | "products";
  fields: string[];
  lastUsed?: string;
}

const templates: ImportTemplate[] = [
  {
    id: "1",
    name: "User Import Template",
    type: "users",
    fields: ["email", "name", "role", "status"],
    lastUsed: "2025-01-15",
  },
  {
    id: "2",
    name: "Subscription Import",
    type: "subscriptions",
    fields: ["user_id", "plan", "start_date", "end_date"],
    lastUsed: "2025-01-10",
  },
];

export default function ImportTemplatesPage() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "users" as "users" | "subscriptions" | "products",
    fields: [] as string[],
  });

  return (
    <div>
      <PageBreadcrumb pageTitle="Import Templates" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Import Templates</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Create and manage data import templates
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <PlusIcon className="h-4 w-4" />
            Create Template
          </Button>
        </div>

        {showForm && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Create Import Template
            </h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="template-name">Template Name</Label>
                <Input
                  id="template-name"
                  type="text"
                  defaultValue={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., User Import Template"
                />
              </div>
              <div>
                <Label htmlFor="template-type">Data Type</Label>
                <select
                  id="template-type"
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value as typeof formData.type })
                  }
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                >
                  <option value="users">Users</option>
                  <option value="subscriptions">Subscriptions</option>
                  <option value="products">Products</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button>Save Template</Button>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {templates.map((template) => (
            <div
              key={template.id}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {template.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{template.type}</p>
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
                  {template.fields.map((field) => (
                    <span
                      key={field}
                      className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs text-blue-700 dark:bg-blue-500/15 dark:text-blue-500"
                    >
                      {field}
                    </span>
                  ))}
                </div>
              </div>
              {template.lastUsed && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Last used: {template.lastUsed}
                </p>
              )}
              <div className="mt-4">
                <Button variant="outline" size="sm" className="w-full">
                  <ArrowUpTrayIcon className="h-4 w-4" />
                  Use Template
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

