"use client";

import TenantBreadcrumbs from "@/components/tenant/TenantBreadcrumbs";
import ChatAgentList from "@/components/agents/ChatAgentList";
import React from "react";

export default function ChatAgentPage() {
  return (
    <div className="space-y-6">
      <TenantBreadcrumbs
        items={[
          { label: "Dashboard", href: "/saas/dashboard" },
          { label: "Chat Agents", href: "/saas/agents/chat" },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Chat Agent Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Create, configure, and manage AI chat agents (Telnyx)
          </p>
        </div>
        <a
          href="/saas/agents/chat"
          className="rounded-lg bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700"
        >
          Create New Agent
        </a>
      </div>

      <ChatAgentList />
    </div>
  );
}
