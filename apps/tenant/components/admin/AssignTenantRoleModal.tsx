"use client";

import React, { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import { assignTenantRoleAction, removeTenantRoleAction, getUserTenantRolesAction } from "@/app/actions/tenant-roles";
import { getAllTenants } from "@/app/actions/tenants";
import type { Database } from "@/core/database/types";

type Tenant = Database["public"]["Tables"]["tenants"]["Row"];
type UserTenantRole = Database["public"]["Tables"]["user_tenant_roles"]["Row"] & {
  tenants?: { name: string; domain: string } | null;
  roles?: { name: string; description: string } | null;
};

interface AssignTenantRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
  userName: string;
  onSuccess?: () => void;
}

const AVAILABLE_ROLES = [
  { value: "Organization Admin", label: "Organization Admin" },
  { value: "Billing Owner", label: "Billing Owner" },
  { value: "Developer", label: "Developer" },
  { value: "Viewer", label: "Viewer" },
];

export default function AssignTenantRoleModal({
  isOpen,
  onClose,
  userId,
  userEmail,
  userName,
  onSuccess,
}: AssignTenantRoleModalProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [existingRoles, setExistingRoles] = useState<UserTenantRole[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingRoles, setLoadingRoles] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTenants();
      loadExistingRoles();
    }
  }, [isOpen, userId]);

  const loadTenants = async () => {
    try {
      const data = await getAllTenants();
      setTenants(data);
    } catch (err) {
      console.error("Error loading tenants:", err);
    }
  };

  const loadExistingRoles = async () => {
    try {
      setLoadingRoles(true);
      const roles = await getUserTenantRolesAction(userId);
      setExistingRoles(roles);
    } catch (err) {
      console.error("Error loading existing roles:", err);
    } finally {
      setLoadingRoles(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedTenantId || !selectedRole) {
      setError("Please select both tenant and role");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await assignTenantRoleAction(userId, selectedTenantId, selectedRole);
      
      if (result.success) {
        await loadExistingRoles();
        setSelectedTenantId("");
        setSelectedRole("");
        onSuccess?.();
        onClose();
      } else {
        setError(result.error || "Failed to assign role");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign role");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (tenantId: string, roleName: string) => {
    if (!confirm(`Remove ${roleName} role for this tenant?`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await removeTenantRoleAction(userId, tenantId, roleName);
      
      if (result.success) {
        await loadExistingRoles();
        onSuccess?.();
      } else {
        setError(result.error || "Failed to remove role");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove role");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-[700px] p-5 lg:p-10"
    >
      <div className="px-2">
        <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
          Assign Tenant Role
        </h4>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Assign tenant-specific roles to <strong>{userName}</strong> ({userEmail})
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-500/15 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Existing Roles */}
        {existingRoles.length > 0 && (
          <div className="mb-6">
            <Label>Current Tenant Roles</Label>
            <div className="mt-2 space-y-2">
              {existingRoles.map((role) => (
                <div
                  key={`${role.tenant_id}-${role.role_id}`}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {(role.tenants as any)?.name || "Unknown Tenant"}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {(role.roles as any)?.name || "Unknown Role"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRemove(role.tenant_id, (role.roles as any)?.name || "")}
                    disabled={loading}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assign New Role */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="tenant-select">Select Tenant</Label>
            <select
              id="tenant-select"
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pr-11 text-sm text-gray-800 placeholder:text-gray-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
            >
              <option value="">Select a tenant</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name} ({tenant.domain})
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="role-select">Select Role</Label>
            <select
              id="role-select"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pr-11 text-sm text-gray-800 placeholder:text-gray-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
            >
              <option value="">Select a role</option>
              {AVAILABLE_ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleAssign}
              disabled={loading || !selectedTenantId || !selectedRole}
              className="flex-1"
            >
              {loading ? "Assigning..." : "Assign Role"}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}


