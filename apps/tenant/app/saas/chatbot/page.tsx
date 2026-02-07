"use client";

import TenantBreadcrumbs from "@/components/tenant/TenantBreadcrumbs";
import { useTenant } from "@/core/multi-tenancy";
import ChatbotWidget from "@/components/chatbot/ChatbotWidget";
import React from "react";

export default function ChatbotPage() {
  const { tenant, isLoading } = useTenant();

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <TenantBreadcrumbs 
        items={[
          { label: "Dashboard", href: "/saas/dashboard" },
          { label: "Chatbot", href: "/saas/chatbot" }
        ]}
      />

      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
          AI Assistant
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Get help with platform features, billing, multi-tenancy, and more.
        </p>
      </div>

      {/* Chatbot Widget */}
      <div className="rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <ChatbotWidget />
      </div>
    </div>
  );
}

