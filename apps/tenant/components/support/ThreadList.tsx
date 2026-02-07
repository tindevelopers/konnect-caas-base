"use client";

import type { SupportTicketThread } from "@tinadmin/core/support";

interface ThreadListProps {
  threads: SupportTicketThread[];
}

export default function ThreadList({ threads }: ThreadListProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (threads.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No replies yet. Be the first to reply!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {threads.map((thread) => (
        <div
          key={thread.id}
          className={`rounded-lg border p-4 ${
            thread.is_internal
              ? "border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-900/20"
              : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50"
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-white">
                {thread.user?.full_name || thread.user?.email || "Unknown"}
              </span>
              {thread.is_internal && (
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/50 dark:text-orange-300">
                  Internal
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatDate(thread.created_at)}
            </span>
          </div>
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {thread.message}
          </p>
        </div>
      ))}
    </div>
  );
}

