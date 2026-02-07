"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Switch from "@/components/form/switch/Switch";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import React, { useState, useEffect } from "react";
import { getCustomDomains, addCustomDomain, saveCustomDomains } from "@/app/actions/white-label";
import type { CustomDomain } from "@/app/actions/white-label";

interface Domain extends CustomDomain {
  id: string;
}

const statusIcons = {
  active: CheckIcon,
  pending: CheckIcon,
  failed: XMarkIcon,
};

const statusColors = {
  active: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500",
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-500",
  failed: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-500",
};

export default function DomainSettingsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    domain: "",
    type: "custom" as "primary" | "custom",
  });
  const [enableCustomDomain, setEnableCustomDomain] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadDomains();
  }, []);

  const loadDomains = async () => {
    try {
      setLoading(true);
      const customDomains = await getCustomDomains();
      setDomains(
        customDomains.map((d, idx) => ({
          ...d,
          id: `${idx}`,
        }))
      );
    } catch (error) {
      console.error("Error loading domains:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDomain = async () => {
    if (!formData.domain) {
      setMessage({ type: "error", text: "Please enter a domain name" });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);
      const result = await addCustomDomain({
        domain: formData.domain,
        type: formData.type,
        status: "pending",
        sslStatus: "pending",
      });

      if (result.success) {
        setMessage({ type: "success", text: "Domain added successfully!" });
        setFormData({ domain: "", type: "custom" });
        setShowForm(false);
        await loadDomains();
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: result.error || "Failed to add domain" });
      }
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to add domain" });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveDomain = async (index: number) => {
    if (!confirm("Are you sure you want to remove this domain?")) {
      return;
    }

    try {
      const updatedDomains = domains.filter((_, idx) => idx !== index);
      const result = await saveCustomDomains(updatedDomains.map(({ id, ...rest }) => rest));
      
      if (result.success) {
        await loadDomains();
        setMessage({ type: "success", text: "Domain removed successfully!" });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: result.error || "Failed to remove domain" });
      }
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to remove domain" });
    }
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Domain Settings" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Domain Settings</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Configure custom domains and SSL certificates
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} disabled={loading}>
            Add Domain
          </Button>
        </div>

        {message && (
          <div
            className={`rounded-lg p-4 ${
              message.type === "success"
                ? "bg-green-50 text-green-800 dark:bg-green-500/15 dark:text-green-300"
                : "bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-300"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Enable Custom Domain */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enable-custom">Enable Custom Domains</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Allow customers to use their own domains
              </p>
            </div>
            <Switch
              id="enable-custom"
              defaultChecked={enableCustomDomain}
              onChange={(checked) => setEnableCustomDomain(checked)}
            />
          </div>
        </div>

        {showForm && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Add Domain</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="domain-name">Domain Name</Label>
                <Input
                  id="domain-name"
                  type="text"
                  defaultValue={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  placeholder="example.com"
                />
              </div>
              <div>
                <Label htmlFor="domain-type">Domain Type</Label>
                <select
                  id="domain-type"
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value as "primary" | "custom" })
                  }
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                >
                  <option value="primary">Primary</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleAddDomain} disabled={saving}>
                {saving ? "Adding..." : "Add Domain"}
              </Button>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {domains.map((domain) => {
            const Icon = statusIcons[domain.status];
            return (
              <div
                key={domain.id}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {domain.domain}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{domain.type}</p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[domain.status]}`}
                  >
                    <Icon className="h-3 w-3" />
                    {domain.status}
                  </span>
                </div>
                <div className="mb-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">SSL Status</span>
                    <span
                      className={`font-medium ${
                        domain.sslStatus === "valid"
                          ? "text-green-600 dark:text-green-500"
                          : domain.sslStatus === "pending"
                          ? "text-yellow-600 dark:text-yellow-500"
                          : "text-red-600 dark:text-red-500"
                      }`}
                    >
                      {domain.sslStatus}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Verified</span>
                    {domain.verified ? (
                      <CheckIcon className="h-5 w-5 text-green-600 dark:text-green-500" />
                    ) : (
                      <XMarkIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </div>
                {!domain.verified && (
                  <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-500/10">
                    <p className="text-xs text-yellow-800 dark:text-yellow-300">
                      Add this CNAME record to your DNS: <code className="font-mono">app.example.com</code>
                    </p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    Configure DNS
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    Renew SSL
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    onClick={() => handleRemoveDomain(domains.findIndex((d) => d.domain === domain.domain))}
                  >
                    Remove
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

