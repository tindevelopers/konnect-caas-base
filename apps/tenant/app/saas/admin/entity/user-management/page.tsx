"use client";

import Button from "@/components/ui/button/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  UserGroupIcon,
  UserPlusIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import { getAllUsers } from "@/app/actions/users";
import { getUserTenantRolesAction } from "@/app/actions/tenant-roles";
import type { Database } from "@/core/database";
import { PermissionGate } from "@/core/permissions";
import { Permission } from "@/core/permissions";
import AssignTenantRoleModal from "@/components/admin/AssignTenantRoleModal";
import { useModal } from "@/hooks/useModal";
import { Cog6ToothIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import UserModal from "@/components/admin/UserModal";
import { deleteUser } from "@/app/actions/users";

type User = Database["public"]["Tables"]["users"]["Row"] & {
  roles?: { name: string } | null;
  tenants?: { name: string } | null;
  tenantRoles?: Array<{
    tenant_id: string;
    tenants?: { name: string } | null;
    roles?: { name: string } | null;
  }>;
};

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    active:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
    pending:
      "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
    suspended:
      "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  };

  const displayStatus = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status.toLowerCase()] ?? "bg-gray-100 text-gray-600"}`}
    >
      {displayStatus}
    </span>
  );
};

const formatLastActive = (lastActiveAt: string | null) => {
  if (!lastActiveAt) return "Never";
  
  const date = new Date(lastActiveAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
};

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  const assignRoleModal = useModal();
  const userModal = useModal();
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    // Load tenant roles for Platform Admins
    const loadTenantRoles = async () => {
      const platformAdmins = users.filter(
        (u) => u.roles?.name === "Platform Admin"
      );
      
      for (const user of platformAdmins) {
        try {
          const tenantRoles = await getUserTenantRolesAction(user.id);
          setUsers((prev) =>
            prev.map((u) =>
              u.id === user.id ? { ...u, tenantRoles } : u
            )
          );
        } catch (err) {
          console.error(`Error loading tenant roles for ${user.id}:`, err);
        }
      }
    };

    if (users.length > 0) {
      loadTenantRoles();
    }
  }, [users.length]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllUsers();
      setUsers(data as User[]);
    } catch (error) {
      console.error("Error loading users:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to load users";
      setError(errorMessage);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeUsers = users.filter((u) => u.status === "active").length;
  const pendingUsers = users.filter((u) => u.status === "pending").length;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-8 text-white">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -left-10 top-0 h-56 w-56 rounded-full bg-indigo-500 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-pink-500 blur-[140px]" />
        </div>
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-1 text-xs uppercase tracking-wide text-white/80">
              <UserGroupIcon className="h-4 w-4" />
              Entity Management
            </p>
            <h1 className="text-4xl font-semibold leading-tight lg:text-5xl">
              User Management
            </h1>
            <p className="max-w-2xl text-white/70">
              Manage users, roles, permissions, and access across your
              organization with real-time sync and policy-aware controls.
              {users.length > 0 && (
                <span className="block mt-2 text-sm text-white/60">
                  Showing {users.length} user{users.length !== 1 ? 's' : ''} you have access to
                </span>
              )}
            </p>
          </div>
          <div className="grid w-full max-w-md gap-4 rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur">
            <div>
              <p className="text-xs uppercase tracking-wide text-white/60">
                Total users
              </p>
              <p className="text-4xl font-semibold">{users.length}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl border border-white/10 p-3">
                <p className="text-xs uppercase tracking-wide text-white/50">
                  Active
                </p>
                <p className="text-2xl font-semibold">{activeUsers}</p>
              </div>
              <div className="rounded-xl border border-white/10 p-3">
                <p className="text-xs uppercase tracking-wide text-white/50">
                  Pending
                </p>
                <p className="text-2xl font-semibold">{pendingUsers}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              User Directory
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Real-time sync, policy aware, SCIM ready.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden sm:block relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="search"
                placeholder="Search people, emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 rounded-full border border-gray-200 bg-white/70 pl-10 pr-4 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
            </div>
                <Button variant="outline" size="sm">
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  Export CSV
                </Button>
                <Button size="sm" onClick={() => {
                  setSelectedUserForEdit(null);
                  userModal.openModal();
                }}>
                  <UserPlusIcon className="h-4 w-4" />
                  Add User
                </Button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-500 dark:text-gray-400">
            Loading users...
          </div>
        ) : error ? (
          <div className="py-12 text-center">
            <div className="inline-block p-4 rounded-lg bg-red-50 dark:bg-red-900/20">
              <p className="text-red-600 dark:text-red-400 font-medium">Error loading users</p>
              <p className="text-sm text-red-500 dark:text-red-500 mt-1">{error}</p>
              <button
                onClick={loadUsers}
                className="mt-3 px-4 py-2 text-sm font-medium text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200"
              >
                Try again
              </button>
            </div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-12 text-center text-gray-500 dark:text-gray-400">
            {searchQuery ? "No users found matching your search." : "No users found. Add your first user to get started."}
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar rounded-2xl border border-gray-100 dark:border-gray-800">
            <Table className="divide-y divide-gray-100 dark:divide-gray-800">
              <TableHeader className="bg-gray-50/80 dark:bg-gray-800/60">
                <TableRow>
                  {["User", "Role", "Plan", "Status", "Last active", "Actions"].map(
                    (label) => (
                      <TableCell
                        key={label}
                        isHeader
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                      >
                        {label}
                      </TableCell>
                    )
                  )}
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white dark:bg-gray-900">
                {filteredUsers.map((user) => (
                  <TableRow
                    key={user.id}
                    className="border-b border-gray-100 last:border-none dark:border-gray-800"
                  >
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                          {user.avatar_url ? (
                            <Image
                              src={user.avatar_url}
                              alt={user.full_name}
                              width={40}
                              height={40}
                              className="object-cover"
                            />
                          ) : (
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                              {user.full_name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {user.full_name}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{user.roles?.name || "No role"}</p>
                          {user.roles?.name === "Platform Admin" && (
                            <PermissionGate permission="users.write">
                              <button
                                onClick={() => {
                                  setSelectedUser(user);
                                  assignRoleModal.openModal();
                                }}
                                className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                                title="Assign tenant role"
                              >
                                <Cog6ToothIcon className="h-4 w-4" />
                              </button>
                            </PermissionGate>
                          )}
                        </div>
                        {user.tenants && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {user.tenants.name}
                          </p>
                        )}
                        {user.tenantRoles && user.tenantRoles.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {user.tenantRoles.map((tr: any, idx: number) => (
                              <p
                                key={idx}
                                className="text-xs text-indigo-600 dark:text-indigo-400"
                              >
                                {(tr.tenants as any)?.name}: {(tr.roles as any)?.name}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {user.plan}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <StatusBadge status={user.status} />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {formatLastActive(user.last_active_at)}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedUserForEdit(user);
                            userModal.openModal();
                          }}
                          className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                          title="Edit user"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm(`Are you sure you want to delete ${user.full_name}? This action cannot be undone.`)) {
                              setDeletingUserId(user.id);
                              try {
                                const result = await deleteUser(user.id);
                                if (result.success) {
                                  await loadUsers();
                                } else {
                                  alert(result.error || "Failed to delete user");
                                }
                              } catch (err: any) {
                                alert(err.message || "Failed to delete user");
                              } finally {
                                setDeletingUserId(null);
                              }
                            }
                          }}
                          disabled={deletingUserId === user.id}
                          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                          title="Delete user"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* User Modal */}
      <UserModal
        isOpen={userModal.isOpen}
        onClose={() => {
          userModal.closeModal();
          setSelectedUserForEdit(null);
        }}
        user={selectedUserForEdit}
        onSuccess={async () => {
          // Reload users after successful creation/update
          await loadUsers();
        }}
      />

      {/* Assign Tenant Role Modal */}
      {selectedUser && (
        <AssignTenantRoleModal
          isOpen={assignRoleModal.isOpen}
          onClose={() => {
            assignRoleModal.closeModal();
            setSelectedUser(null);
          }}
          userId={selectedUser.id}
          userEmail={selectedUser.email}
          userName={selectedUser.full_name}
          onSuccess={() => {
            loadUsers();
          }}
        />
      )}
    </div>
  );
}
