"use client";

import TenantBreadcrumbs from "@/components/tenant/TenantBreadcrumbs";
import DashboardOverview from "@/components/agents/DashboardOverview";
import React from "react";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <TenantBreadcrumbs
        items={[{ label: "Dashboard", href: "/saas/dashboard" }]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Overview of your tenants and agents
          </p>
        </div>
      </div>

      <DashboardOverview />
    </div>
  );
}
