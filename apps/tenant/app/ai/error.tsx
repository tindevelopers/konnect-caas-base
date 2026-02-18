"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AiSectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("AI section error:", error);
  }, [error]);

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/30">
      <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">
        Something went wrong in the AI section
      </h2>
      <p className="mt-2 text-sm text-red-700 dark:text-red-300">
        This can happen if the telephony/agent provider is not configured (missing API key or tenant
        integration), or if you don’t have permission to access integrations. Configure the provider
        integration for your tenant, then try again.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">Error ID: {error.digest}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Try again
        </button>
        <Link
          href="/ai/assistants"
          className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200 dark:hover:bg-red-900/30"
        >
          Back to AI Assistants
        </Link>
        <Link
          href="/saas/dashboard"
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
