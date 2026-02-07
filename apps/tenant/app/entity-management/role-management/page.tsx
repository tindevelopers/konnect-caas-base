import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import {
  ShieldCheckIcon,
  PlusIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";
import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Role Management | TailAdmin",
  description: "Manage roles, permissions, and access policies across your organization",
};

const rolePlaybooks = [
  {
    role: "Platform Admin",
    description: "Full system control, audit exports, billing + API scope.",
    coverage: "Global",
    seats: "32 / 40",
    permissions: ["All permissions", "Billing", "API keys", "Audit logs"],
    gradient: "from-indigo-500 to-purple-500",
  },
  {
    role: "Organization Admin",
    description: "Brand, roles, data residency, tenant level automations.",
    coverage: "Regional",
    seats: "128 / 180",
    permissions: ["Workspace settings", "User management", "Branding"],
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    role: "Billing Owner",
    description: "Plan changes, usage alerts, dunning + collections.",
    coverage: "Per tenant",
    seats: "44 / 60",
    permissions: ["Billing", "Usage reports", "Payment methods"],
    gradient: "from-amber-500 to-orange-500",
  },
  {
    role: "Developer",
    description: "API keys, webhooks, environments, feature flags.",
    coverage: "Per project",
    seats: "310 / 500",
    permissions: ["API access", "Webhooks", "Feature flags"],
    gradient: "from-sky-500 to-blue-500",
  },
  {
    role: "Viewer",
    description: "Read-only access to dashboards and reports.",
    coverage: "Per workspace",
    seats: "89 / 200",
    permissions: ["View dashboards", "View reports"],
    gradient: "from-gray-400 to-gray-600",
  },
];

export default function RoleManagementPage() {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-8 text-white">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -left-10 top-0 h-56 w-56 rounded-full bg-blue-500 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-purple-500 blur-[140px]" />
        </div>
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-1 text-xs uppercase tracking-wide text-white/80">
              <ShieldCheckIcon className="h-4 w-4" />
              Entity Management
            </p>
            <h1 className="text-4xl font-semibold leading-tight lg:text-5xl">
              Role Management
            </h1>
            <p className="max-w-2xl text-white/70">
              Define and manage roles with granular permissions, adaptive RBAC
              policies, and seat-based access controls.
            </p>
          </div>
          <div className="grid w-full max-w-md gap-4 rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur">
            <div>
              <p className="text-xs uppercase tracking-wide text-white/60">
                Total roles
              </p>
              <p className="text-4xl font-semibold">{rolePlaybooks.length}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl border border-white/10 p-3">
                <p className="text-xs uppercase tracking-wide text-white/50">
                  Active seats
                </p>
                <p className="text-2xl font-semibold">603</p>
              </div>
              <div className="rounded-xl border border-white/10 p-3">
                <p className="text-xs uppercase tracking-wide text-white/50">
                  Available
                </p>
                <p className="text-2xl font-semibold">980</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Role Directory
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Adaptive RBAC matrix with policy-aware controls
              </p>
            </div>
            <Button size="sm">
              <PlusIcon className="h-4 w-4" />
              Create Role
            </Button>
          </div>

          <div className="space-y-4">
            {rolePlaybooks.map((role) => (
              <div
                key={role.role}
                className="rounded-2xl border border-gray-100 p-5 dark:border-gray-800"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {role.role}
                      </h3>
                      <span
                        className={`inline-flex items-center rounded-full bg-gradient-to-r ${role.gradient} px-3 py-1 text-xs font-semibold text-white`}
                      >
                        {role.coverage}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                      {role.description}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {role.permissions.map((permission) => (
                        <span
                          key={permission}
                          className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        >
                          {permission}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    <PencilIcon className="h-4 w-4" />
                    Edit
                  </Button>
                </div>
                <div className="mt-4 flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Seats • {role.seats}
                  </span>
                  <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
                    View policy details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Create New Role
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Define a custom role with specific permissions
            </p>
          </div>
          <div className="space-y-4">
            <div>
              <Label htmlFor="role-name">Role Name</Label>
              <Input
                id="role-name"
                type="text"
                placeholder="e.g., Content Manager"
              />
            </div>
            <div>
              <Label htmlFor="role-description">Description</Label>
              <Input
                id="role-description"
                type="text"
                placeholder="Brief description of role"
              />
            </div>
            <div>
              <Label htmlFor="role-coverage">Coverage</Label>
              <div className="relative">
                <select
                  id="role-coverage"
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 pr-10 text-sm text-gray-700 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                >
                  <option>Global</option>
                  <option>Regional</option>
                  <option>Per tenant</option>
                  <option>Per project</option>
                  <option>Per workspace</option>
                </select>
              </div>
            </div>
            <Button size="sm" className="w-full">
              <PlusIcon className="h-4 w-4" />
              Create Role
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

