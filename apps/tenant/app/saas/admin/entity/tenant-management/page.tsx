"use client";

import Button from "@/components/ui/button/Button";
import {
  BuildingOffice2Icon,
  GlobeAltIcon,
  UserGroupIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  PlusIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { getAllTenants, createTenant, type CreateTenantData } from "@/app/actions/tenants";
import { PermissionGate } from "@/core/permissions";
import type { Database } from "@/core/database";

type Tenant = Database["public"]["Tables"]["tenants"]["Row"] & {
  users?: Array<{ id: string }> | null;
  userCount?: number;
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
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export default function TenantManagementPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<CreateTenantData>({
    name: "",
    domain: "",
    plan: "free",
    region: "us-east-1",
    status: "active",
  });

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch tenants using server action (includes user counts)
      const tenantsData = await getAllTenants();
      
      setTenants(tenantsData as Tenant[]);
    } catch (err: any) {
      // Better error serialization
      let errorDetails = "Unknown error";
      
      if (err) {
        if (typeof err === "string") {
          errorDetails = err;
        } else if (err instanceof Error) {
          errorDetails = err.message || err.toString();
        } else if (err.message) {
          errorDetails = err.message;
        } else {
          try {
            errorDetails = JSON.stringify(err);
          } catch {
            errorDetails = String(err);
          }
        }
      }
      
      console.error("Error loading tenants:", {
        error: err,
        message: err?.message,
        stringified: errorDetails,
      });
      
      // If it's an RLS error, provide helpful message
      if (err?.message?.includes("permission") || err?.message?.includes("policy") || err?.message?.includes("row-level security") || err?.message?.includes("Not authenticated")) {
        setError("You don't have permission to view tenants. Please sign in or check your role assignment.");
      } else {
        setError(errorDetails);
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredTenants = tenants.filter(
    (tenant) =>
      tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.domain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);

    try {
      // Validate domain format
      const domainRegex = /^[a-z0-9-]+$/;
      if (!domainRegex.test(formData.domain)) {
        throw new Error("Domain must contain only lowercase letters, numbers, and hyphens");
      }

      await createTenant({
        name: formData.name,
        domain: formData.domain,
        plan: formData.plan,
        region: formData.region,
        status: formData.status,
      });

      // Reset form and close modal
      setFormData({
        name: "",
        domain: "",
        plan: "free",
        region: "us-east-1",
        status: "active",
      });
      setShowCreateModal(false);
      
      // Reload tenants list
      await loadTenants();
    } catch (err: any) {
      console.error("Error creating tenant:", err);
      setError(err.message || "Failed to create tenant. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const activeTenants = tenants.filter((t) => t.status === "active").length;
  const totalUsers = tenants.reduce((sum, t) => sum + (t.userCount || 0), 0);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-8 text-white">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -left-10 top-0 h-56 w-56 rounded-full bg-violet-500 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-fuchsia-500 blur-[140px]" />
        </div>
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-1 text-xs uppercase tracking-wide text-white/80">
              <BuildingOffice2Icon className="h-4 w-4" />
              Entity Management
            </p>
            <h1 className="text-4xl font-semibold leading-tight lg:text-5xl">
              Tenant Management
            </h1>
            <p className="max-w-2xl text-white/70">
              Manage tenants, workspaces, multi-tenant configurations, and
              tenant-specific policies from a unified control plane.
            </p>
          </div>
          <div className="grid w-full max-w-md gap-4 rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur">
            <div>
              <p className="text-xs uppercase tracking-wide text-white/60">
                Total tenants
              </p>
              <p className="text-4xl font-semibold">{tenants.length}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl border border-white/10 p-3">
                <p className="text-xs uppercase tracking-wide text-white/50">
                  Active
                </p>
                <p className="text-2xl font-semibold">{activeTenants}</p>
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

      {error && (
        <div className="rounded-lg bg-error-50 p-4 text-sm text-error-700 dark:bg-error-900/20 dark:text-error-400">
          {error}
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Tenants
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Multi-tenant workspace management
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="hidden sm:block relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="search"
                  placeholder="Search tenants..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 rounded-full border border-gray-200 bg-white/70 pl-10 pr-4 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                />
              </div>
              <Button size="sm" onClick={() => setShowCreateModal(true)}>
                <PlusIcon className="h-4 w-4" />
                Add Tenant
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-gray-500 dark:text-gray-400">
              Loading tenants...
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="py-12 text-center space-y-4">
              <p className="text-gray-500 dark:text-gray-400">
                {searchQuery ? "No tenants found matching your search." : "No tenants found. Create your first tenant to get started."}
              </p>
              {!searchQuery && (
                <Button onClick={() => setShowCreateModal(true)}>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Create Your First Tenant
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredTenants.map((tenant) => (
                <div
                  key={tenant.id}
                  className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800">
                        {tenant.avatar_url ? (
                          <Image
                            src={tenant.avatar_url}
                            alt={tenant.name}
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
                            {tenant.name}
                          </h3>
                          <StatusBadge status={tenant.status} />
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                          {tenant.domain}
                        </p>
                        <div className="flex flex-wrap items-center gap-4 text-sm mb-3">
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                            <UserGroupIcon className="h-4 w-4" />
                            <span>{tenant.userCount || 0} users</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                            <GlobeAltIcon className="h-4 w-4" />
                            <span>{tenant.region}</span>
                          </div>
                        </div>
                        {tenant.features && tenant.features.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {tenant.features.slice(0, 3).map((feature: string) => (
                              <span
                                key={feature}
                                className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
                              >
                                <CheckCircleIcon className="h-3 w-3" />
                                {feature}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                        {tenant.plan}
                      </span>
                      {tenant.status === "active" ? (
                        <Link href={`/saas/admin/entity/tenant-management/${tenant.id}`}>
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
                      Created {formatDate(tenant.created_at)}
                    </span>
                    <div className="flex gap-2">
                      {tenant.status === "active" ? (
                        <>
                          <Link 
                            href={`/saas/admin/entity/user-management?tenant=${tenant.id}`}
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                          >
                            View users
                          </Link>
                          <span className="text-gray-300 dark:text-gray-700">•</span>
                          <Link 
                            href={`/saas/admin/entity/tenant-management/${tenant.id}/settings`}
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                          >
                            Settings
                          </Link>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-medium text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50">
                            View users
                          </span>
                          <span className="text-gray-300 dark:text-gray-700">•</span>
                          <span className="text-sm font-medium text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50">
                            Settings
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
              Tenant overview
            </p>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Active tenants
                </span>
                <ChartBarIcon className="h-5 w-5 text-indigo-500" />
              </div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {activeTenants}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Pending tenants
                </span>
                <BuildingOffice2Icon className="h-5 w-5 text-amber-500" />
              </div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {tenants.filter((t) => t.status === "pending").length}
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

      {/* Create Tenant Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-800">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Create New Tenant
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
                  Tenant Name *
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
                  Unique identifier for the tenant (lowercase, no spaces)
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
                    <option value="free">Free</option>
                    <option value="basic">Basic</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
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
                  {creating ? "Creating..." : "Create Tenant"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

