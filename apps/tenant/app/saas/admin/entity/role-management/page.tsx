"use client";

export const dynamic = 'force-dynamic';

import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import TextArea from "@/components/form/input/TextArea";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import Select from "@/components/form/Select";
import {
  ShieldCheckIcon,
  PlusIcon,
  PencilIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface Role {
  role: string;
  description: string;
  coverage: string;
  seats: string;
  permissions: string[];
  gradient: string;
}

const initialRoles: Role[] = [
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

const coverageOptions = [
  { value: "Global", label: "Global" },
  { value: "Regional", label: "Regional" },
  { value: "Per tenant", label: "Per tenant" },
  { value: "Per project", label: "Per project" },
  { value: "Per workspace", label: "Per workspace" },
];

const availablePermissions = [
  "All permissions",
  "Billing",
  "API keys",
  "Audit logs",
  "Workspace settings",
  "User management",
  "Branding",
  "Usage reports",
  "Payment methods",
  "API access",
  "Webhooks",
  "Feature flags",
  "View dashboards",
  "View reports",
];

export default function RoleManagementPage() {
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const editModal = useModal();
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editFormData, setEditFormData] = useState<{
    role: string;
    description: string;
    coverage: string;
    seats: string;
    permissions: string[];
  }>({
    role: "",
    description: "",
    coverage: "",
    seats: "",
    permissions: [],
  });
  const [newPermission, setNewPermission] = useState("");

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setEditFormData({
      role: role.role,
      description: role.description,
      coverage: role.coverage,
      seats: role.seats,
      permissions: [...role.permissions],
    });
    editModal.openModal();
  };

  const handleSave = () => {
    if (!editingRole) return;

    const updatedRoles = roles.map((r) => {
      if (r.role === editingRole.role) {
        return {
          ...r,
          role: editFormData.role,
          description: editFormData.description,
          coverage: editFormData.coverage,
          seats: editFormData.seats,
          permissions: editFormData.permissions,
        };
      }
      return r;
    });

    setRoles(updatedRoles);
    editModal.closeModal();
    setEditingRole(null);
  };

  const handlePermissionToggle = (permission: string) => {
    setEditFormData((prev) => {
      const isSelected = prev.permissions.includes(permission);
      return {
        ...prev,
        permissions: isSelected
          ? prev.permissions.filter((p) => p !== permission)
          : [...prev.permissions, permission],
      };
    });
  };

  const handleAddPermission = () => {
    if (newPermission.trim() && !editFormData.permissions.includes(newPermission.trim())) {
      setEditFormData((prev) => ({
        ...prev,
        permissions: [...prev.permissions, newPermission.trim()],
      }));
      setNewPermission("");
    }
  };

  const handleRemovePermission = (permission: string) => {
    setEditFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.filter((p) => p !== permission),
    }));
  };

  const parseSeats = (seats: string) => {
    if (!seats || typeof seats !== 'string') {
      return { current: 0, total: 0 };
    }
    const parts = seats.split(" / ");
    const current = parts[0] ? Number(parts[0]) : 0;
    const total = parts[1] ? Number(parts[1]) : 0;
    return { 
      current: isNaN(current) ? 0 : current, 
      total: isNaN(total) ? 0 : total 
    };
  };

  const formatSeats = (current: number, total: number) => {
    return `${current} / ${total}`;
  };

  const handleSeatChange = (type: "current" | "total", value: number) => {
    const { current, total } = parseSeats(editFormData.seats || "0 / 0");
    const newSeats =
      type === "current"
        ? formatSeats(value, total)
        : formatSeats(current, value);
    setEditFormData((prev) => ({ ...prev, seats: newSeats }));
  };

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
              <p className="text-4xl font-semibold">{roles.length}</p>
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
            {roles.map((role) => (
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(role)}
                  >
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

      {/* Edit Role Modal */}
      <Modal
        isOpen={editModal.isOpen}
        onClose={editModal.closeModal}
        className="max-w-[800px] w-full"
      >
        <div className="w-full bg-white rounded-3xl dark:bg-gray-900 p-6 lg:p-10">
          <div className="mb-6">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              Edit Role
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Update role details, permissions, and seat allocations
            </p>
          </div>

          <form className="flex flex-col gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-role-name">Role Name</Label>
                <Input
                  key={`role-name-${editingRole?.role}`}
                  id="edit-role-name"
                  type="text"
                  defaultValue={editFormData.role}
                  onChange={(e) =>
                    setEditFormData((prev) => ({
                      ...prev,
                      role: e.target.value,
                    }))
                  }
                  placeholder="e.g., Platform Admin"
                />
              </div>

              <div>
                <Label htmlFor="edit-role-description">Description</Label>
                <TextArea
                  value={editFormData.description}
                  onChange={(value) =>
                    setEditFormData((prev) => ({
                      ...prev,
                      description: value,
                    }))
                  }
                  placeholder="Brief description of role"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="edit-role-coverage">Coverage</Label>
                <Select
                  key={`role-coverage-${editingRole?.role}`}
                  options={coverageOptions}
                  defaultValue={editFormData.coverage}
                  onChange={(value) =>
                    setEditFormData((prev) => ({ ...prev, coverage: value }))
                  }
                />
              </div>

              <div>
                <Label>Seat Allocation</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-seats-current" className="text-xs">
                      Current Seats
                    </Label>
                    <Input
                      key={`seats-current-${editingRole?.role}`}
                      id="edit-seats-current"
                      type="number"
                      defaultValue={parseSeats(editFormData.seats || "0 / 0").current.toString()}
                      onChange={(e) =>
                        handleSeatChange("current", parseInt(e.target.value) || 0)
                      }
                      min="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-seats-total" className="text-xs">
                      Total Seats
                    </Label>
                    <Input
                      key={`seats-total-${editingRole?.role}`}
                      id="edit-seats-total"
                      type="number"
                      defaultValue={parseSeats(editFormData.seats || "0 / 0").total.toString()}
                      onChange={(e) =>
                        handleSeatChange("total", parseInt(e.target.value) || 0)
                      }
                      min="0"
                    />
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Current: {editFormData.seats}
                </p>
              </div>

              <div>
                <Label>Permissions</Label>
                <div className="mt-2 space-y-3">
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 p-4 dark:border-gray-700 space-y-2">
                    {availablePermissions.map((permission) => (
                      <label
                        key={permission}
                        className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={editFormData.permissions.includes(permission)}
                          onChange={() => handlePermissionToggle(permission)}
                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {permission}
                        </span>
                      </label>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    {editFormData.permissions.map((permission) => (
                      <span
                        key={permission}
                        className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                      >
                        {permission}
                        <button
                          type="button"
                          onClick={() => handleRemovePermission(permission)}
                          className="hover:text-indigo-900 dark:hover:text-indigo-100"
                        >
                          <XMarkIcon className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPermission}
                      onChange={(e) => setNewPermission(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddPermission();
                        }
                      }}
                      placeholder="Add custom permission"
                      className="h-11 flex-1 rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleAddPermission}
                    >
                      <PlusIcon className="h-4 w-4" />
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                size="sm"
                variant="outline"
                onClick={editModal.closeModal}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                Save Changes
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
