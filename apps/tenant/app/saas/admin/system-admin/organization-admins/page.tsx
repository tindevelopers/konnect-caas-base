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
  BuildingOffice2Icon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import { getAllOrganizationAdmins, isPlatformAdmin } from "@/app/actions/organization-admins";
import type { Database } from "@/core/database";

type OrgAdmin = Database["public"]["Tables"]["users"]["Row"] & {
  roles?: { name: string } | null;
  tenants?: { name: string; domain: string; status: string } | null;
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
  if (!dateString) return "Never";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { 
    month: "short", 
    day: "numeric",
    year: "numeric" 
  });
};

export default function OrganizationAdminsPage() {
  const [admins, setAdmins] = useState<OrgAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const isAdmin = await isPlatformAdmin();
      setHasAccess(isAdmin);
      if (isAdmin) {
        loadAdmins();
      } else {
        setError("Only Platform Admins can view all Organization Admins");
        setLoading(false);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to check access";
      console.error("[OrganizationAdminsPage] Access check error:", errorMessage);
      setError(errorMessage);
      setLoading(false);
    }
  };

  const loadAdmins = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllOrganizationAdmins();
      setAdmins(data as OrgAdmin[]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load Organization Admins";
      console.error("[OrganizationAdminsPage] Load admins error:", errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Group admins by tenant
  const adminsByTenant = admins.reduce((acc, admin) => {
    const tenantName = (admin.tenants as any)?.name || "Unknown Tenant";
    if (!acc[tenantName]) {
      acc[tenantName] = {
        tenant: admin.tenants,
        admins: [],
      };
    }
    acc[tenantName].admins.push(admin);
    return acc;
  }, {} as Record<string, { tenant: any; admins: OrgAdmin[] }>);

  const filteredAdmins = admins.filter(
    (admin) =>
      admin.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      admin.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ((admin.tenants as any)?.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalAdmins = admins.length;
  const activeAdmins = admins.filter((a) => a.status === "active").length;
  const totalTenants = Object.keys(adminsByTenant).length;

  if (hasAccess === false) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
          <p className="text-gray-600">
            Only Platform Admins can view all Organization Admins.
          </p>
        </div>
      </div>
    );
  }

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
              <BuildingOffice2Icon className="h-4 w-4" />
              System Administration
            </p>
            <h1 className="text-4xl font-semibold leading-tight lg:text-5xl">
              Organization Admins
            </h1>
            <p className="max-w-2xl text-white/70">
              View and manage all Organization Admins (Organization Admins) across all tenants from a unified control plane.
            </p>
          </div>
          <div className="grid w-full max-w-md gap-4 rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur">
            <div>
              <p className="text-xs uppercase tracking-wide text-white/60">
                Total Admins
              </p>
              <p className="text-4xl font-semibold">{totalAdmins}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl border border-white/10 p-3">
                <p className="text-xs uppercase tracking-wide text-white/50">
                  Active
                </p>
                <p className="text-2xl font-semibold">{activeAdmins}</p>
              </div>
              <div className="rounded-xl border border-white/10 p-3">
                <p className="text-xs uppercase tracking-wide text-white/50">
                  Tenants
                </p>
                <p className="text-2xl font-semibold">{totalTenants}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Organization Admins Directory
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              All Organization Admins across all tenants
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden sm:block relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="search"
                placeholder="Search admins, emails, tenants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 rounded-full border border-gray-200 bg-white/70 pl-10 pr-4 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
            </div>
            <Button variant="outline" size="sm">
              <ArrowDownTrayIcon className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-500 dark:text-gray-400">
            Loading Organization Admins...
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : filteredAdmins.length === 0 ? (
          <div className="py-12 text-center text-gray-500 dark:text-gray-400">
            {searchQuery ? "No admins found matching your search." : "No Organization Admins found."}
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar rounded-2xl border border-gray-100 dark:border-gray-800">
            <Table className="divide-y divide-gray-100 dark:divide-gray-800">
              <TableHeader className="bg-gray-50/80 dark:bg-gray-800/60">
                <TableRow>
                  {["Admin", "Tenant", "Status", "Last Active", "Created"].map(
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
                {filteredAdmins.map((admin) => (
                  <TableRow
                    key={admin.id}
                    className="border-b border-gray-100 last:border-none dark:border-gray-800"
                  >
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                          {admin.avatar_url ? (
                            <Image
                              src={admin.avatar_url}
                              alt={admin.full_name}
                              width={40}
                              height={40}
                              className="object-cover"
                            />
                          ) : (
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                              {admin.full_name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {admin.full_name}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {admin.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {(admin.tenants as any)?.name || "Unknown"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {(admin.tenants as any)?.domain || ""}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <StatusBadge status={admin.status} />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(admin.last_active_at)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(admin.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Grouped by Tenant View */}
      {!searchQuery && Object.keys(adminsByTenant).length > 0 && (
        <section className="space-y-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Organization Admins by Tenant
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              View admins grouped by their tenant
            </p>
          </div>
          <div className="space-y-4">
            {Object.entries(adminsByTenant).map(([tenantName, { tenant, admins: tenantAdmins }]: [string, any]) => (
              <div key={tenantName} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {tenantName}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {(tenant as any)?.domain || ""} • {tenantAdmins.length} admin{tenantAdmins.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <StatusBadge status={(tenant as any)?.status || "active"} />
                </div>
                <div className="space-y-2">
                  {tenantAdmins.map((admin: any) => (
                    <div key={admin.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                          {admin.avatar_url ? (
                            <Image
                              src={admin.avatar_url}
                              alt={admin.full_name}
                              width={32}
                              height={32}
                              className="object-cover"
                            />
                          ) : (
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                              {admin.full_name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {admin.full_name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {admin.email}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={admin.status} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

