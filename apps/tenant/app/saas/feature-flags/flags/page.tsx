"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Switch from "@/components/form/switch/Switch";
import { PlusIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface FeatureFlag {
  id: string;
  name: string;
  key: string;
  description: string;
  enabled: boolean;
  environment: string;
  targeting: "all" | "percentage" | "specific";
  percentage?: number;
}

const featureFlags: FeatureFlag[] = [
  {
    id: "1",
    name: "New Dashboard UI",
    key: "new-dashboard-ui",
    description: "Enable the new dashboard interface",
    enabled: true,
    environment: "production",
    targeting: "percentage",
    percentage: 50,
  },
  {
    id: "2",
    name: "Beta Features",
    key: "beta-features",
    description: "Access to beta features",
    enabled: false,
    environment: "production",
    targeting: "specific",
  },
  {
    id: "3",
    name: "Advanced Analytics",
    key: "advanced-analytics",
    description: "Enable advanced analytics features",
    enabled: true,
    environment: "staging",
    targeting: "all",
  },
];

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>(featureFlags);
  const createModal = useModal();
  const [formData, setFormData] = useState({
    name: "",
    key: "",
    description: "",
    environment: "production",
    targeting: "all" as "all" | "percentage" | "specific",
    percentage: 0,
  });

  const handleCreate = () => {
    const newFlag: FeatureFlag = {
      id: Date.now().toString(),
      name: formData.name,
      key: formData.key,
      description: formData.description,
      enabled: false,
      environment: formData.environment,
      targeting: formData.targeting,
      percentage: formData.targeting === "percentage" ? formData.percentage : undefined,
    };
    setFlags([...flags, newFlag]);
    createModal.closeModal();
    setFormData({
      name: "",
      key: "",
      description: "",
      environment: "production",
      targeting: "all",
      percentage: 0,
    });
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Feature Flags" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Feature Flags</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Manage feature flags and gradual rollouts
            </p>
          </div>
          <Button onClick={createModal.openModal}>
            <PlusIcon className="h-4 w-4" />
            Create Flag
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {flags.map((flag) => (
            <div
              key={flag.id}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{flag.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{flag.key}</p>
                </div>
                <Switch
                  checked={flag.enabled}
                  onChange={(checked) => {
                    setFlags(flags.map((f) => (f.id === flag.id ? { ...f, enabled: checked } : f)));
                  }}
                />
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">{flag.description}</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Environment</span>
                  <span className="font-medium text-gray-900 dark:text-white">{flag.environment}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Targeting</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {flag.targeting === "all"
                      ? "All Users"
                      : flag.targeting === "percentage"
                      ? `${flag.percentage}% of Users`
                      : "Specific Users"}
                  </span>
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

      {/* Create Flag Modal */}
      <Modal isOpen={createModal.isOpen} onClose={createModal.closeModal} className="max-w-[600px] m-4">
        <div className="p-6">
          <h3 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Create Feature Flag</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="flag-name">Flag Name</Label>
              <Input
                id="flag-name"
                type="text"
                defaultValue={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., New Dashboard UI"
              />
            </div>
            <div>
              <Label htmlFor="flag-key">Flag Key</Label>
              <Input
                id="flag-key"
                type="text"
                defaultValue={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                placeholder="e.g., new-dashboard-ui"
              />
            </div>
            <div>
              <Label htmlFor="flag-description">Description</Label>
              <textarea
                id="flag-description"
                defaultValue={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                placeholder="Describe what this feature flag controls"
              />
            </div>
            <div>
              <Label htmlFor="flag-environment">Environment</Label>
              <select
                id="flag-environment"
                value={formData.environment}
                onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
              >
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="development">Development</option>
              </select>
            </div>
            <div>
              <Label htmlFor="flag-targeting">Targeting</Label>
              <select
                id="flag-targeting"
                value={formData.targeting}
                onChange={(e) =>
                  setFormData({ ...formData, targeting: e.target.value as typeof formData.targeting })
                }
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
              >
                <option value="all">All Users</option>
                <option value="percentage">Percentage of Users</option>
                <option value="specific">Specific Users</option>
              </select>
            </div>
            {formData.targeting === "percentage" && (
              <div>
                <Label htmlFor="flag-percentage">Percentage</Label>
                <Input
                  id="flag-percentage"
                  type="number"
                  min="0"
                  max="100"
                  defaultValue={formData.percentage.toString()}
                  onChange={(e) =>
                    setFormData({ ...formData, percentage: parseInt(e.target.value) })
                  }
                />
              </div>
            )}
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={createModal.closeModal} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleCreate} className="flex-1">
                Create Flag
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
