"use client";

import { useState, useEffect } from "react";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { createUser, updateUser, getAllRoles, getAllTenantsForUser, type CreateUserData, type UpdateUserData } from "@/app/actions/users";
import type { Database } from "@/core/database";

type User = Database["public"]["Tables"]["users"]["Row"] & {
  roles?: { name: string } | null;
  tenants?: { name: string } | null;
};

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User | null;
  onSuccess: () => void;
}

export default function UserModal({ isOpen, onClose, user, onSuccess }: UserModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [tenants, setTenants] = useState<Array<{ id: string; name: string; domain: string }>>([]);
  
  const [formData, setFormData] = useState<CreateUserData & { password?: string }>({
    email: "",
    full_name: "",
    password: "",
    role_id: null,
    tenant_id: null,
    plan: "starter",
    status: "active",
  });

  useEffect(() => {
    if (isOpen) {
      loadOptions();
      if (user) {
        // Edit mode
        setFormData({
          email: user.email,
          full_name: user.full_name || "",
          password: "", // Don't pre-fill password
          role_id: user.role_id || null,
          tenant_id: user.tenant_id || null,
          plan: user.plan || "free",
          status: user.status || "active",
        });
      } else {
        // Create mode
        setFormData({
          email: "",
          full_name: "",
          password: "",
          role_id: null,
          tenant_id: null,
          plan: "starter",
          status: "active",
        });
      }
      setError(null);
    }
  }, [isOpen, user]);

  const loadOptions = async () => {
    try {
      const [rolesData, tenantsData] = await Promise.all([
        getAllRoles(),
        getAllTenantsForUser(),
      ]);
      setRoles(rolesData);
      setTenants(tenantsData);
    } catch (err) {
      console.error("Error loading options:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (user) {
        // Update existing user
        const updateData: UpdateUserData = {
          full_name: formData.full_name,
          role_id: formData.role_id || null,
          tenant_id: formData.tenant_id || null,
          plan: formData.plan,
          status: formData.status,
        };

        const result = await updateUser(user.id, updateData);
        if (result.success) {
          onSuccess();
          onClose();
        } else {
          setError(result.error || "Failed to update user");
        }
      } else {
        // Create new user
        if (!formData.password || formData.password.length < 8) {
          setError("Password must be at least 8 characters");
          setLoading(false);
          return;
        }

        const result = await createUser({
          email: formData.email,
          full_name: formData.full_name,
          password: formData.password,
          role_id: formData.role_id || null,
          tenant_id: formData.tenant_id || null,
          plan: formData.plan || "starter",
          status: formData.status || "active",
        });

        if (result.success) {
          // Wait a moment for database consistency, then refresh
          await new Promise(resolve => setTimeout(resolve, 300));
          await onSuccess();
          onClose();
        } else {
          setError(result.error || "Failed to create user");
        }
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {user ? "Edit User" : "Add New User"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="John Doe"
              />
            </div>

            <div>
              <Label>
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@example.com"
                disabled={!!user} // Email cannot be changed
              />
            </div>
          </div>

          {!user && (
            <div>
              <Label>
                Password <span className="text-red-500">*</span>
              </Label>
              <Input
                type="password"
                required={!user}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="At least 8 characters"
                minLength={8}
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Role</Label>
              <select
                value={formData.role_id || ""}
                onChange={(e) => setFormData({ ...formData, role_id: e.target.value || null })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="">Select a role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Tenant</Label>
              <select
                value={formData.tenant_id || ""}
                onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value || null })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="">No tenant (Platform Admin)</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} ({tenant.domain})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Plan</Label>
              <select
                value={formData.plan}
                onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div>
              <Label>Status</Label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (user ? "Updating..." : "Creating...") : (user ? "Update User" : "Create User")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
