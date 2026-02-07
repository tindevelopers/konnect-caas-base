"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { PlusIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface SSOProvider {
  id: string;
  name: string;
  type: "SAML" | "OAuth" | "OIDC";
  isActive: boolean;
  domain?: string;
}

const ssoProviders: SSOProvider[] = [
  {
    id: "1",
    name: "Google Workspace",
    type: "OAuth",
    isActive: true,
    domain: "example.com",
  },
  {
    id: "2",
    name: "Microsoft Azure AD",
    type: "SAML",
    isActive: true,
    domain: "company.com",
  },
];

export default function SSOConfigurationPage() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "SAML" as "SAML" | "OAuth" | "OIDC",
    domain: "",
  });

  return (
    <div>
      <PageBreadcrumb pageTitle="SSO Configuration" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">SSO Configuration</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Configure Single Sign-On providers for your organization
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <PlusIcon className="h-4 w-4" />
            Add SSO Provider
          </Button>
        </div>

        {showForm && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Add SSO Provider
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="provider-name">Provider Name</Label>
                <Input
                  id="provider-name"
                  type="text"
                  defaultValue={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Google Workspace"
                />
              </div>
              <div>
                <Label htmlFor="sso-type">SSO Type</Label>
                <select
                  id="sso-type"
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value as "SAML" | "OAuth" | "OIDC" })
                  }
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                >
                  <option value="SAML">SAML 2.0</option>
                  <option value="OAuth">OAuth 2.0</option>
                  <option value="OIDC">OpenID Connect</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="domain">Domain (Optional)</Label>
                <Input
                  id="domain"
                  type="text"
                  defaultValue={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  placeholder="example.com"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button>Save Provider</Button>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {ssoProviders.map((provider) => (
            <div
              key={provider.id}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {provider.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{provider.type}</p>
                  {provider.domain && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      Domain: {provider.domain}
                    </p>
                  )}
                </div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    provider.isActive
                      ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500"
                      : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  {provider.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <PencilIcon className="h-4 w-4" />
                  Configure
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <TrashIcon className="h-4 w-4" />
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

