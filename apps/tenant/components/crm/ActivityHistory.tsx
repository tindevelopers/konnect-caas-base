"use client";

import { useEffect, useState } from "react";
import { getActivities } from "@/app/actions/crm/activities";
import { ClockIcon } from "@heroicons/react/24/outline";

type Activity = {
  id: string;
  type: string;
  description: string;
  created_at: string;
  created_by: string | null;
  metadata: Record<string, any> | null;
};

type ActivityHistoryProps = {
  contactId?: string;
  companyId?: string;
  dealId?: string;
  taskId?: string;
};

const activityIcons: Record<string, string> = {
  created: "✨",
  updated: "✏️",
  deleted: "🗑️",
  note_added: "📝",
  task_created: "✅",
  task_completed: "🎉",
  deal_stage_changed: "🔄",
  email_sent: "📧",
  call_made: "📞",
  meeting_scheduled: "📅",
};

const activityColors: Record<string, string> = {
  created: "text-green-600 dark:text-green-400",
  updated: "text-blue-600 dark:text-blue-400",
  deleted: "text-red-600 dark:text-red-400",
  note_added: "text-purple-600 dark:text-purple-400",
  task_created: "text-indigo-600 dark:text-indigo-400",
  task_completed: "text-green-600 dark:text-green-400",
  deal_stage_changed: "text-yellow-600 dark:text-yellow-400",
  email_sent: "text-cyan-600 dark:text-cyan-400",
  call_made: "text-pink-600 dark:text-pink-400",
  meeting_scheduled: "text-orange-600 dark:text-orange-400",
};

export default function ActivityHistory({ contactId, companyId, dealId, taskId }: ActivityHistoryProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
  }, [contactId, companyId, dealId, taskId]);

  const loadActivities = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (contactId) filters.contact_id = contactId;
      if (companyId) filters.company_id = companyId;
      if (dealId) filters.deal_id = dealId;
      if (taskId) filters.task_id = taskId;

      const data = await getActivities(filters);
      setActivities(data);
    } catch (error) {
      console.error("Error loading activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Activity History</h2>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading activities...</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Activity History</h2>
      <div className="space-y-4">
        {activities.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <ClockIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No activities yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 pb-3 border-b border-gray-200 dark:border-gray-800 last:border-0">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-lg">
                  {activityIcons[activity.type] || "📌"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${activityColors[activity.type] || "text-gray-900 dark:text-white"}`}>
                    {activity.description}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {formatDate(activity.created_at)}
                  </p>
                  {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {activity.metadata.changes && (
                        <div className="space-y-1">
                          {Object.entries(activity.metadata.changes).map(([key, value]) => (
                            <div key={key}>
                              <span className="font-medium">{key}:</span> {String(value)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
