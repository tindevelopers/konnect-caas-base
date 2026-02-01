"use client";

import React from "react";
import Button from "@/components/ui/button/Button";

const integrations = [
  {
    name: "GoHighLevel",
    category: "CRM",
    description: "Source of truth for contacts, campaigns, and automations.",
    status: "Connected",
    lastSync: "2m ago",
  },
  {
    name: "Telnyx",
    category: "Dialer + SMS",
    description: "Outbound/inbound voice and SMS for campaign follow ups.",
    status: "Connected",
    lastSync: "1m ago",
  },
  {
    name: "Retell / Vapi AIs",
    category: "AI Agent",
    description: "Conversational AI agents for follow-up calls and chats.",
    status: "Pending Setup",
    lastSync: "N/A",
  },
];

export default function IntegrationsStatusPanel() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400 dark:text-gray-500">
            Integrations
          </p>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">CRM + Dialer + AI</h2>
        </div>
        <Button size="sm" variant="outline">
          Manage Connections
        </Button>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {integrations.map((integration) => (
          <div key={integration.name} className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
                {integration.category}
              </p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  integration.status === "Connected"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200"
                }`}
              >
                {integration.status}
              </span>
            </div>
            <h3 className="mt-3 text-lg font-semibold text-gray-900 dark:text-white">
              {integration.name}
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{integration.description}</p>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Last sync: {integration.lastSync}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
