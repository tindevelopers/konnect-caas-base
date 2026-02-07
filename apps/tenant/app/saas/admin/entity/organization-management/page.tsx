"use client";

export const dynamic = 'force-dynamic';

import Button from "@/components/ui/button/Button";
import {
  BuildingOffice2Icon,
  GlobeAltIcon,
  UserGroupIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { getAllTenants, createTenant, type CreateTenantData } from "@/app/actions/tenants";
import type { Database } from "@/core/database";

type Tenant = Database["public"]["Tables"]["tenants"]["Row"] & {
  userCount?: number;
  workspaceCount?: number;
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

const formatDate = (dateString: string | null) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function OrganizationManagementPage() {
  const [organizations, setOrganizations] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<CreateTenantData>({
    name: "",
    domain: "",
    plan: "starter",
    region: "us-east-1",
    status: "active",
  });

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllTenants();
      setOrganizations(data);
    } catch (err) {
      console.error("Failed to load organizations:", err);
      setError(err instanceof Error ? err.message : "Failed to load organizations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrganizations();
  }, []);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const newTenant = await createTenant(formData);
      setOrganizations([newTenant, ...organizations]);
      setShowCreateModal(false);
      setFormData({
        name: "",
        domain: "",
        plan: "starter",
        region: "us-east-1",
        status: "active",
      });
    } catch (err) {
      console.error("Failed to create organization:", err);
      setError(err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setCreating(false);
    }
  };

  const totalWorkspaces = organizations.reduce((sum, org) => sum + (org.workspaceCount || 0), 0);
  const totalUsers = organizations.reduce((sum, org) => sum + (org.userCount || 0), 0);
  const activeOrganizations = organizations.filter((o) => o.status === "active").length;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 p-8 text-white">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -left-10 top-0 h-56 w-56 rounded-full bg-emerald-500 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-cyan-500 blur-[140px]" />
        </div>
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-1 text-xs uppercase tracking-wide text-white/80">
              <BuildingOffice2Icon className="h-4 w-4" />
              Entity Management
            </p>
            <h1 className="text-4xl font-semibold leading-tight lg:text-5xl">
              Organization Management
            </h1>
            <p className="max-w-2xl text-white/70">
              Manage organizations, workspaces, multi-tenant configurations,
              and cross-organization policies from a unified control plane.
            </p>
          </div>
          <div className="grid w-full max-w-md gap-4 rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur">
            <div>
              <p className="text-xs uppercase tracking-wide text-white/60">
                Total organizations
              </p>
              <p className="text-4xl font-semibold">{organizations.length}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl border border-white/10 p-3">
                <p className="text-xs uppercase tracking-wide text-white/50">
                  Workspaces
                </p>
                <p className="text-2xl font-semibold">{totalWorkspaces}</p>
              </div>
              <div className="rounded-xl border border-white/10 p-3">
                <p className="text-xs uppercase tracking-wide text-white/50">
                  Total users
                </p>
                <p className="text-2xl font-semibold">{totalUsers}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error && !showCreateModal && (
        <div className="rounded-lg bg-error-50 p-4 text-sm text-error-700 dark:bg-error-900/20 dark:text-error-400">
          {error}
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Organizations
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Multi-tenant workspace management
              </p>
            </div>
            <Button size="sm" onClick={() => setShowCreateModal(true)}>
              <PlusIcon className="h-4 w-4" />
              Add Organization
            </Button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-gray-500 dark:text-gray-400">
              Loading organizations...
            </div>
          ) : organizations.length === 0 ? (
            <div className="py-12 text-center space-y-4">
              <p className="text-gray-500 dark:text-gray-400">
                No organizations found. Create your first organization to get started.
              </p>
              <Button onClick={() => setShowCreateModal(true)}>
                <PlusIcon className="h-4 w-4 mr-2" />
                Create Your First Organization
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {organizations.map((org) => (
                <div
                  key={org.id}
                  className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800">
                        {org.avatar_url ? (
                          <Image
                            src={org.avatar_url}
                            alt={org.name}
                            width={40}
                            height={40}
                            className="rounded-lg"
                          />
                        ) : (
                          <BuildingOffice2Icon className="h-8 w-8 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                            {org.name}
                          </h3>
                          <StatusBadge status={org.status} />
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                          {org.domain}
                        </p>
                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                            <BuildingOffice2Icon className="h-4 w-4" />
                            <span>{org.workspaceCount || 0} workspaces</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                            <UserGroupIcon className="h-4 w-4" />
                            <span>{org.userCount || 0} users</span>
                          </div>
                          {org.region && (
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                              <GlobeAltIcon className="h-4 w-4" />
                              <span>{org.region}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {org.plan && (
                        <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                          {org.plan}
                        </span>
                      )}
                      {org.status === "active" ? (
                        <Link href={`/saas/admin/entity/tenant-management/${org.id}`}>
                          <Button variant="outline" size="sm">
                            <Cog6ToothIcon className="h-4 w-4" />
                            Manage
                          </Button>
                        </Link>
                      ) : (
                        <Button variant="outline" size="sm" disabled className="opacity-50 cursor-not-allowed">
                          <Cog6ToothIcon className="h-4 w-4" />
                          Manage
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Created {formatDate(org.created_at)}
                    </span>
                    <div className="flex gap-2">
                      {org.status === "active" ? (
                        <>
                          <Link
                            href={`/saas/admin/workspaces?tenant=${org.id}`}
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                          >
                            View workspaces
                          </Link>
                          <span className="text-gray-300 dark:text-gray-700">•</span>
                          <Link
                            href={`/saas/admin/analytics?tenant=${org.id}`}
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                          >
                            Analytics
                          </Link>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-medium text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50">
                            View workspaces
                          </span>
                          <span className="text-gray-300 dark:text-gray-700">•</span>
                          <span className="text-sm font-medium text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50">
                            Analytics
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Quick Stats
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Organization overview
            </p>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Active organizations
                </span>
                <ChartBarIcon className="h-5 w-5 text-indigo-500" />
              </div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {activeOrganizations}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Total workspaces
                </span>
                <BuildingOffice2Icon className="h-5 w-5 text-emerald-500" />
              </div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {totalWorkspaces}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Total users
                </span>
                <UserGroupIcon className="h-5 w-5 text-blue-500" />
              </div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {totalUsers}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Create Organization Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-800">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Create New Organization
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setError(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleCreateTenant} className="p-6 space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Organization Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  placeholder="Acme Corporation"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Domain *
                </label>
                <input
                  type="text"
                  required
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value.toLowerCase() })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  placeholder="acme-corp"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Unique identifier for the organization (lowercase, no spaces)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Plan
                  </label>
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Region
                  </label>
                  <select
                    value={formData.region}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="us-east-1">US East</option>
                    <option value="us-west-1">US West</option>
                    <option value="us-central-1">US Central</option>
                    <option value="eu-west-1">EU West</option>
                    <option value="ap-southeast-1">Asia Pacific</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as "active" | "pending" | "suspended" })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false);
                    setError(null);
                  }}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? "Creating..." : "Create Organization"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
