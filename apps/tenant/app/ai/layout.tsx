"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import AdminLayout from "@/layout/AdminLayout";

const aiNavItems = [
  { label: "Agent Manager", href: "/ai/agent-manager" },
  { label: "AI Assistants", href: "/ai/assistants" },
  { label: "AI Tests", href: "/ai/tests" },
  { label: "Voice Settings", href: "/ai/voice-settings" },
  { label: "MCP Servers", href: "/ai/mcp-servers" },
  { label: "Integration Secrets", href: "/ai/integration-secrets" },
];

export default function AiLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navLink = (item: (typeof aiNavItems)[0]) => {
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`rounded-md px-3 py-2 text-sm font-medium ${
          isActive
            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
            : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700/50"
        }`}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6 md:flex-row">
        {/* Mobile: horizontal nav; Desktop: left sidebar */}
        <nav
          className="flex shrink-0 flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800/50 md:w-52 md:flex-col md:gap-0"
          aria-label="AI section navigation"
        >
          {aiNavItems.map(navLink)}
        </nav>
        {/* Main content */}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </AdminLayout>
  );
}
