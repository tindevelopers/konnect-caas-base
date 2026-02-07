import ApiKeyTable from "@/components/api-keys/ApiKeyTable";
import Button from "@/components/ui/button/Button";
import {
  Cog6ToothIcon,
  ServerIcon,
  ShieldCheckIcon,
  KeyIcon,
  ChartBarIcon,
  GlobeAltIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "System Administration | TailAdmin",
  description: "System configuration, monitoring, and administration",
};

const systemSettings = [
  {
    title: "API Configuration",
    description: "Manage API endpoints, rate limits, and access controls",
    icon: KeyIcon,
    status: "Configured",
  },
  {
    title: "Security Policies",
    description: "SSO, MFA, session management, and compliance settings",
    icon: ShieldCheckIcon,
    status: "Active",
  },
  {
    title: "Data Residency",
    description: "Configure data storage regions and compliance zones",
    icon: GlobeAltIcon,
    status: "Multi-region",
  },
  {
    title: "Monitoring & Alerts",
    description: "System health, performance metrics, and alerting rules",
    icon: ChartBarIcon,
    status: "Monitoring",
  },
  {
    title: "Backup & Recovery",
    description: "Automated backups, retention policies, and recovery procedures",
    icon: ServerIcon,
    status: "Enabled",
  },
  {
    title: "Maintenance Windows",
    description: "Schedule system updates and maintenance periods",
    icon: ClockIcon,
    status: "Scheduled",
  },
];

export default function SystemAdminPage() {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-700 via-gray-800 to-slate-900 p-8 text-white">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -left-10 top-0 h-56 w-56 rounded-full bg-slate-600 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-gray-700 blur-[140px]" />
        </div>
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-1 text-xs uppercase tracking-wide text-white/80">
              <Cog6ToothIcon className="h-4 w-4" />
              System Administration
            </p>
            <h1 className="text-4xl font-semibold leading-tight lg:text-5xl">
              System Configuration
            </h1>
            <p className="max-w-2xl text-white/70">
              Manage system-wide settings, security policies, monitoring, and
              infrastructure configuration from a centralized control panel.
            </p>
          </div>
          <div className="grid w-full max-w-md gap-4 rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur">
            <div>
              <p className="text-xs uppercase tracking-wide text-white/60">
                System Status
              </p>
              <p className="text-4xl font-semibold">Operational</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl border border-white/10 p-3">
                <p className="text-xs uppercase tracking-wide text-white/50">
                  Uptime
                </p>
                <p className="text-2xl font-semibold">99.97%</p>
              </div>
              <div className="rounded-xl border border-white/10 p-3">
                <p className="text-xs uppercase tracking-wide text-white/50">
                  Active Configs
                </p>
                <p className="text-2xl font-semibold">
                  {systemSettings.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              System Settings
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Configure system-wide policies and infrastructure
            </p>
          </div>

          <div className="grid gap-4">
            {systemSettings.map((setting) => (
              <div
                key={setting.title}
                className="flex items-start justify-between gap-4 rounded-2xl border border-gray-100 p-5 dark:border-gray-800"
              >
                <div className="flex items-start gap-4 flex-1">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    <setting.icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {setting.title}
                      </h3>
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                        {setting.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {setting.description}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  Configure
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              API Keys
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage system API keys
            </p>
          </div>
          <ApiKeyTable />
        </div>
      </section>
    </div>
  );
}
