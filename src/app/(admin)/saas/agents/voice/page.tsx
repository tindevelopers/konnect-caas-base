"use client";

import TenantBreadcrumbs from "@/components/tenant/TenantBreadcrumbs";
import VoiceAgentList from "@/components/agents/VoiceAgentList";
import React from "react";

export default function VoiceAgentPage() {
  return (
    <div className="space-y-6">
      <TenantBreadcrumbs
        items={[
          { label: "Dashboard", href: "/saas/dashboard" },
          { label: "Voice Agents", href: "/saas/agents/voice" },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Voice Agent Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Create, configure, and manage AI voice agents (Telnyx)
          </p>
        </div>
        <a
          href="/saas/agents/voice"
          className="rounded-lg bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700"
        >
          Create New Agent
        </a>
      </div>

      <VoiceAgentList />
    </div>
  );
}
