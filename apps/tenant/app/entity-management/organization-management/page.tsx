import Button from "@/components/ui/button/Button";
import {
  BuildingOffice2Icon,
  GlobeAltIcon,
  UserGroupIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import type { Metadata } from "next";
import Image from "next/image";
import React from "react";

export const metadata: Metadata = {
  title: "Organization Management | TailAdmin",
  description: "Manage organizations, workspaces, and multi-tenant configurations",
};

const organizations = [
  {
    name: "Atlas Retail Group",
    industry: "Omni-channel Retail",
    status: "Active",
    workspaces: 48,
    users: 1240,
    plan: "Enterprise",
    avatar: "/images/brand/brand-01.svg",
    region: "US East",
    createdAt: "Jan 2023",
  },
  {
    name: "Lumen Health Systems",
    industry: "Healthcare Networks",
    status: "Active",
    workspaces: 22,
    users: 580,
    plan: "Healthcare",
    avatar: "/images/brand/brand-02.svg",
    region: "US Central",
    createdAt: "Mar 2023",
  },
  {
    name: "Northwind Finance",
    industry: "FinTech & Treasury",
    status: "Active",
    workspaces: 6,
    users: 145,
    plan: "Enterprise",
    avatar: "/images/brand/brand-03.svg",
    region: "EU West",
    createdAt: "Jun 2023",
  },
  {
    name: "Evergreen Education",
    industry: "Education & Public",
    status: "Pending",
    workspaces: 12,
    users: 320,
    plan: "Education",
    avatar: "/images/brand/brand-04.svg",
    region: "US West",
    createdAt: "Sep 2023",
  },
];

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    Active:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
    Pending:
      "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
    Suspended:
      "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {status}
    </span>
  );
};

export default function OrganizationManagementPage() {
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
                <p className="text-2xl font-semibold">
                  {organizations.reduce((sum, org) => sum + org.workspaces, 0)}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 p-3">
                <p className="text-xs uppercase tracking-wide text-white/50">
                  Total users
                </p>
                <p className="text-2xl font-semibold">
                  {organizations.reduce((sum, org) => sum + org.users, 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

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
            <Button size="sm">
              <PlusIcon className="h-4 w-4" />
              Add Organization
            </Button>
          </div>

          <div className="grid gap-4">
            {organizations.map((org) => (
              <div
                key={org.name}
                className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800">
                      <Image
                        src={org.avatar}
                        alt={org.name}
                        width={40}
                        height={40}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                          {org.name}
                        </h3>
                        <StatusBadge status={org.status} />
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                        {org.industry}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                          <BuildingOffice2Icon className="h-4 w-4" />
                          <span>{org.workspaces} workspaces</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                          <UserGroupIcon className="h-4 w-4" />
                          <span>{org.users} users</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                          <GlobeAltIcon className="h-4 w-4" />
                          <span>{org.region}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                      {org.plan}
                    </span>
                    <Button variant="outline" size="sm">
                      <Cog6ToothIcon className="h-4 w-4" />
                      Manage
                    </Button>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Created {org.createdAt}
                  </span>
                  <div className="flex gap-2">
                    <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
                      View workspaces
                    </button>
                    <span className="text-gray-300 dark:text-gray-700">•</span>
                    <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
                      Analytics
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
                {organizations.filter((o) => o.status === "Active").length}
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
                {organizations.reduce((sum, org) => sum + org.workspaces, 0)}
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
                {organizations.reduce((sum, org) => sum + org.users, 0)}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

