"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { PlusIcon, PencilIcon, EyeIcon, EyeSlashIcon, TrashIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface OAuthApp {
  id: string;
  name: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  isActive: boolean;
}

const oauthApps: OAuthApp[] = [
  {
    id: "1",
    name: "Mobile App",
    clientId: "client_mobile_abc123",
    clientSecret: "secret_xyz789...",
    redirectUri: "myapp://callback",
    scopes: ["read", "write"],
    isActive: true,
  },
  {
    id: "2",
    name: "Web Dashboard",
    clientId: "client_web_def456",
    clientSecret: "secret_web789...",
    redirectUri: "https://dashboard.example.com/callback",
    scopes: ["read", "write", "admin"],
    isActive: true,
  },
];

export default function OAuthAppsPage() {
  const [apps, setApps] = useState<OAuthApp[]>(oauthApps);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const createModal = useModal();
  const [formData, setFormData] = useState({
    name: "",
    redirectUri: "",
    scopes: [] as string[],
  });

  const handleCreate = () => {
    const newApp: OAuthApp = {
      id: Date.now().toString(),
      name: formData.name,
      clientId: `client_${Math.random().toString(36).substring(7)}`,
      clientSecret: `secret_${Math.random().toString(36).substring(7)}...`,
      redirectUri: formData.redirectUri,
      scopes: formData.scopes,
      isActive: true,
    };
    setApps([...apps, newApp]);
    createModal.closeModal();
    setFormData({ name: "", redirectUri: "", scopes: [] });
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="OAuth Apps" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">OAuth Apps</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Manage OAuth applications and credentials
            </p>
          </div>
          <Button onClick={createModal.openModal}>
            <PlusIcon className="h-4 w-4" />
            Create OAuth App
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {apps.map((app) => (
            <div
              key={app.id}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{app.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{app.redirectUri}</p>
                </div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    app.isActive
                      ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500"
                      : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  {app.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="mb-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Client ID</span>
                  <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
                    {app.clientId}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Client Secret</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
                      {showSecrets[app.id] ? app.clientSecret : "••••••••"}
                    </span>
                    <button
                      onClick={() =>
                        setShowSecrets({ ...showSecrets, [app.id]: !showSecrets[app.id] })
                      }
                    >
                      {showSecrets[app.id] ? (
                        <EyeSlashIcon className="h-4 w-4 text-gray-400" />
                      ) : (
                        <EyeIcon className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Scopes</span>
                  <div className="flex gap-1">
                    {app.scopes.map((scope) => (
                      <span
                        key={scope}
                        className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-500/15 dark:text-blue-500"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
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

      {/* Create OAuth App Modal */}
      <Modal isOpen={createModal.isOpen} onClose={createModal.closeModal} className="max-w-[600px] m-4">
        <div className="p-6">
          <h3 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Create OAuth App</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="app-name">App Name</Label>
              <Input
                id="app-name"
                type="text"
                defaultValue={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Mobile App"
              />
            </div>
            <div>
              <Label htmlFor="app-redirect">Redirect URI</Label>
              <Input
                id="app-redirect"
                type="url"
                defaultValue={formData.redirectUri}
                onChange={(e) => setFormData({ ...formData, redirectUri: e.target.value })}
                placeholder="https://example.com/callback"
              />
            </div>
            <div>
              <Label>Scopes</Label>
              <div className="mt-2 space-y-2">
                {["read", "write", "admin"].map((scope) => (
                  <label key={scope} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.scopes.includes(scope)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, scopes: [...formData.scopes, scope] });
                        } else {
                          setFormData({
                            ...formData,
                            scopes: formData.scopes.filter((s) => s !== scope),
                          });
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-brand-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{scope}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={createModal.closeModal} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleCreate} className="flex-1">
                Create App
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

