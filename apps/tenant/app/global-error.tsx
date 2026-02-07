"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global application error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center justify-center min-h-screen p-6">
          <div className="mx-auto w-full max-w-lg text-center">
            <div className="mb-8">
              <svg
                className="mx-auto h-24 w-24 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>

            <h1 className="mb-4 font-bold text-gray-800 text-2xl dark:text-white">
              Critical Error
            </h1>

            <p className="mb-6 text-base text-gray-600 dark:text-gray-400">
              A critical error occurred. Please try refreshing the page.
            </p>

            {error.digest && (
              <p className="mb-6 text-sm text-gray-500 dark:text-gray-500 font-mono">
                Error ID: {error.digest}
              </p>
            )}

            <button
              onClick={() => reset()}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

