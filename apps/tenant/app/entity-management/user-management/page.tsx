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
import type { Metadata } from "next";
import Image from "next/image";
import React from "react";

export const metadata: Metadata = {
  title: "User Management | TailAdmin",
  description: "Comprehensive user directory with roles, plans, and activity tracking",
};

const userDirectory = [
  {
    name: "Ava Patel",
    email: "ava@atlasretail.com",
    role: "Platform Admin",
    plan: "Enterprise",
    status: "Active",
    lastActive: "2m ago",
    avatar: "/images/user/user-17.jpg",
  },
  {
    name: "Marcus Reed",
    email: "m.reed@northwind.finance",
    role: "Billing Owner",
    plan: "Enterprise",
    status: "Active",
    lastActive: "12m ago",
    avatar: "/images/user/user-13.jpg",
  },
  {
    name: "Isabella Chen",
    email: "isabella@lumenhealth.io",
    role: "Security Analyst",
    plan: "Healthcare",
    status: "Pending",
    lastActive: "Invite sent",
    avatar: "/images/user/user-18.jpg",
  },
  {
    name: "Diego Alvarez",
    email: "diego@auroraapps.dev",
    role: "Developer",
    plan: "Growth",
    status: "Active",
    lastActive: "1h ago",
    avatar: "/images/user/user-20.jpg",
  },
  {
    name: "Noor Alvi",
    email: "noor@orbitmobility.com",
    role: "Support Lead",
    plan: "Enterprise",
    status: "Suspended",
    lastActive: "24h ago",
    avatar: "/images/user/user-12.jpg",
  },
  {
    name: "Emily Brooks",
    email: "emily@evergreen.edu",
    role: "Organization Admin",
    plan: "Education",
    status: "Active",
    lastActive: "4m ago",
    avatar: "/images/user/user-11.jpg",
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

export default function UserManagementPage() {
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
            </p>
          </div>
          <div className="grid w-full max-w-md gap-4 rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur">
            <div>
              <p className="text-xs uppercase tracking-wide text-white/60">
                Total users
              </p>
              <p className="text-4xl font-semibold">{userDirectory.length}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl border border-white/10 p-3">
                <p className="text-xs uppercase tracking-wide text-white/50">
                  Active
                </p>
                <p className="text-2xl font-semibold">
                  {userDirectory.filter((u) => u.status === "Active").length}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 p-3">
                <p className="text-xs uppercase tracking-wide text-white/50">
                  Pending
                </p>
                <p className="text-2xl font-semibold">
                  {userDirectory.filter((u) => u.status === "Pending").length}
                </p>
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
                className="h-10 rounded-full border border-gray-200 bg-white/70 pl-10 pr-4 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
            </div>
            <Button variant="outline" size="sm">
              <ArrowDownTrayIcon className="h-4 w-4" />
              Export CSV
            </Button>
            <Button size="sm">
              <UserPlusIcon className="h-4 w-4" />
              Add User
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar rounded-2xl border border-gray-100 dark:border-gray-800">
          <Table className="divide-y divide-gray-100 dark:divide-gray-800">
            <TableHeader className="bg-gray-50/80 dark:bg-gray-800/60">
              <TableRow>
                {["User", "Role", "Plan", "Status", "Last active"].map(
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
              {userDirectory.map((user) => (
                <TableRow
                  key={user.email}
                  className="border-b border-gray-100 last:border-none dark:border-gray-800"
                >
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 overflow-hidden rounded-full">
                        <Image
                          src={user.avatar}
                          alt={user.name}
                          width={40}
                          height={40}
                        />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {user.name}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {user.role}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {user.plan}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <StatusBadge status={user.status} />
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {user.lastActive}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

