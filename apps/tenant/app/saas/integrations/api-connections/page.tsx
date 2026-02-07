"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { PlusIcon, PencilIcon, KeyIcon, TrashIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface APIConnection {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  status: "active" | "inactive";
  lastUsed?: string;
}

const apiConnections: APIConnection[] = [
  {
    id: "1",
    name: "Stripe API",
    baseUrl: "https://api.stripe.com",
    apiKey: "sk_live_abc123...",
    status: "active",
    lastUsed: "2025-01-16 10:30 AM",
  },
  {
    id: "2",
    name: "SendGrid API",
    baseUrl: "https://api.sendgrid.com",
    apiKey: "SG.xyz789...",
    status: "active",
    lastUsed: "2025-01-16 09:15 AM",
  },
];

export default function APIConnectionsPage() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    baseUrl: "",
    apiKey: "",
  });

  return (
    <div>
      <PageBreadcrumb pageTitle="API Connections" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">API Connections</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Manage API connections and credentials
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <PlusIcon className="h-4 w-4" />
            Add Connection
          </Button>
        </div>

        {showForm && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Add API Connection
            </h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="conn-name">Connection Name</Label>
                <Input
                  id="conn-name"
                  type="text"
                  defaultValue={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Stripe API"
                />
              </div>
              <div>
                <Label htmlFor="conn-url">Base URL</Label>
                <Input
                  id="conn-url"
                  type="url"
                  defaultValue={formData.baseUrl}
                  onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                  placeholder="https://api.example.com"
                />
              </div>
              <div>
                <Label htmlFor="conn-key">API Key</Label>
                <Input
                  id="conn-key"
                  type="password"
                  defaultValue={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="Enter API key"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button>Save Connection</Button>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {apiConnections.map((connection) => (
            <div
              key={connection.id}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-500/15">
                    <KeyIcon className="h-5 w-5 text-blue-600 dark:text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {connection.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{connection.baseUrl}</p>
                  </div>
                </div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    connection.status === "active"
                      ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500"
                      : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  {connection.status}
                </span>
              </div>
              <div className="mb-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">API Key</span>
                  <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
                    {connection.apiKey}
                  </span>
                </div>
                {connection.lastUsed && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Last Used</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {connection.lastUsed}
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
          ))}
        </div>
      </div>
    </div>
  );
}

