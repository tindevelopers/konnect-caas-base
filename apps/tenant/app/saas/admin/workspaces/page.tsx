"use client";

import Button from "@/components/ui/button/Button";
import {
  BuildingOffice2Icon,
  PlusIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import { getAllWorkspaces } from "@/app/actions/workspaces";
import { useTenant } from "@/core/multi-tenancy";
import type { Database } from "@/core/database";
import Link from "next/link";

type Workspace = Database["public"]["Tables"]["workspaces"]["Row"] & {
  workspace_users?: Array<{ id: string }> | null;
  userCount?: number;
};

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    active:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
    suspended:
      "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
    archived:
      "bg-gray-50 text-gray-600 dark:bg-gray-500/15 dark:text-gray-300",
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

export default function WorkspacesPage() {
  const { tenant, tenantId } = useTenant();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (tenantId) {
      loadWorkspaces();
    }
  }, [tenantId]);

  const loadWorkspaces = async () => {
    if (!tenantId) return;
    
    try {
      setLoading(true);
      setError(null);
      const workspacesData = await getAllWorkspaces(tenantId);
      setWorkspaces(workspacesData as Workspace[]);
    } catch (err: any) {
      console.error("Error loading workspaces:", err);
      setError(err.message || "Failed to load workspaces.");
      setWorkspaces([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredWorkspaces = workspaces.filter(
    (workspace) =>
      workspace.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      workspace.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      workspace.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeWorkspaces = workspaces.filter((w) => w.status === "active").length;

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
              <BuildingOffice2Icon className="h-4 w-4" />
              Workspace Management
            </p>
            <h1 className="text-4xl font-semibold leading-tight lg:text-5xl">
              Workspaces
            </h1>
            <p className="max-w-2xl text-white/70">
              Manage workspaces within your organization. Each workspace can have
              its own members, settings, and resources.
            </p>
          </div>
          <div className="grid w-full max-w-md gap-4 rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur">
            <div>
              <p className="text-xs uppercase tracking-wide text-white/60">
                Total workspaces
              </p>
              <p className="text-4xl font-semibold">{workspaces.length}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl border border-white/10 p-3">
                <p className="text-xs uppercase tracking-wide text-white/50">
                  Active
                </p>
                <p className="text-2xl font-semibold">{activeWorkspaces}</p>
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

      <section className="space-y-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Workspace Directory
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage and organize your workspaces
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden sm:block relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="search"
                placeholder="Search workspaces..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 rounded-full border border-gray-200 bg-white/70 pl-10 pr-4 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
            </div>
            <Button size="sm">
              <PlusIcon className="h-4 w-4" />
              Create Workspace
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-500 dark:text-gray-400">
            Loading workspaces...
          </div>
        ) : filteredWorkspaces.length === 0 ? (
          <div className="py-12 text-center text-gray-500 dark:text-gray-400">
            {searchQuery ? "No workspaces found matching your search." : "No workspaces found. Create your first workspace to get started."}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredWorkspaces.map((workspace) => (
              <Link
                key={workspace.id}
                href={`/saas/admin/workspaces/${workspace.id}`}
                className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-800"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {workspace.avatar_url ? (
                      <Image
                        src={workspace.avatar_url}
                        alt={workspace.name}
                        width={48}
                        height={48}
                        className="rounded-lg"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                        <BuildingOffice2Icon className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        {workspace.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {workspace.slug}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={workspace.status} />
                </div>
                {workspace.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
                    {workspace.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <UserGroupIcon className="h-4 w-4" />
                    <span>{workspace.userCount || 0} members</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}


