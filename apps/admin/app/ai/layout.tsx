"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

const tabs = [
  { label: "AI Assistants", href: "/ai/assistants" },
  { label: "AI Tests", href: "/ai/tests" },
  { label: "MCP Servers", href: "/ai/mcp-servers" },
];

export default function AiLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6 border-b border-gray-200 dark:border-gray-800">
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`border-b-2 px-1 pb-3 text-sm font-medium ${
                isActive
                  ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
