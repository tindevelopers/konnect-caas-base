"use client";

export const dynamic = 'force-dynamic';

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { PlusIcon, PencilIcon, CheckIcon, TrashIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface DataSource {
  id: string;
  name: string;
  type: "database" | "api" | "file";
  connectionString?: string;
  apiEndpoint?: string;
  status: "connected" | "disconnected" | "error";
  lastSync?: string;
  fieldCount: number;
}

const dataSources: DataSource[] = [
  {
    id: "1",
    name: "Users Database",
    type: "database",
    connectionString: "postgresql://...",
    status: "connected",
    lastSync: "2025-01-16 10:00 AM",
    fieldCount: 25,
  },
  {
    id: "2",
    name: "Subscriptions API",
    type: "api",
    apiEndpoint: "https://api.example.com/subscriptions",
    status: "connected",
    lastSync: "2025-01-16 09:30 AM",
    fieldCount: 15,
  },
  {
    id: "3",
    name: "External CSV",
    type: "file",
    status: "disconnected",
    fieldCount: 0,
  },
];

const statusIcons = {
  connected: CheckIcon,
  disconnected: TrashIcon,
  error: TrashIcon,
};

const statusColors = {
  connected: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500",
  disconnected: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  error: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-500",
};

export default function DataSourcesPage() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "database" as "database" | "api" | "file",
    connectionString: "",
    apiEndpoint: "",
  });

  return (
    <div>
      <PageBreadcrumb pageTitle="Data Sources" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Data Sources</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Configure data sources for custom reports
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <PlusIcon className="h-4 w-4" />
            Add Data Source
          </Button>
        </div>

        {showForm && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Add Data Source
            </h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="source-name">Data Source Name</Label>
                <Input
                  id="source-name"
                  type="text"
                  defaultValue={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Users Database"
                />
              </div>
              <div>
                <Label htmlFor="source-type">Type</Label>
                <select
                  id="source-type"
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value as typeof formData.type })
                  }
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                >
                  <option value="database">Database</option>
                  <option value="api">API</option>
                  <option value="file">File Upload</option>
                </select>
              </div>
              {formData.type === "database" && (
                <div>
                  <Label htmlFor="connection-string">Connection String</Label>
                  <Input
                    id="connection-string"
                    type="text"
                    defaultValue={formData.connectionString}
                    onChange={(e) => setFormData({ ...formData, connectionString: e.target.value })}
                    placeholder="postgresql://..."
                  />
                </div>
              )}
              {formData.type === "api" && (
                <div>
                  <Label htmlFor="api-endpoint">API Endpoint</Label>
                  <Input
                    id="api-endpoint"
                    type="url"
                    defaultValue={formData.apiEndpoint}
                    onChange={(e) => setFormData({ ...formData, apiEndpoint: e.target.value })}
                    placeholder="https://api.example.com/endpoint"
                  />
                </div>
              )}
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button>Save Data Source</Button>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {dataSources.map((source) => {
            const Icon = statusIcons[source.status];
            return (
              <div
                key={source.id}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {source.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{source.type}</p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[source.status]}`}
                  >
                    <Icon className="h-3 w-3" />
                    {source.status}
                  </span>
                </div>
                <div className="mb-4 space-y-2">
                  {source.connectionString && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Connection</span>
                      <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
                        {source.connectionString.substring(0, 30)}...
                      </span>
                    </div>
                  )}
                  {source.apiEndpoint && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Endpoint</span>
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {source.apiEndpoint}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Fields</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {source.fieldCount}
                    </span>
                  </div>
                  {source.lastSync && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Last Sync</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {source.lastSync}
                      </span>
                    </div>
                  )}
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
            );
          })}
        </div>
      </div>
    </div>
  );
}

