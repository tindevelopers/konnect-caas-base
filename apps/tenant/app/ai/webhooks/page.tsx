"use client";

import React, { useState, useEffect } from "react";
import { getWebhookEventsAction, getWebhookStatsAction } from "@/app/actions/webhooks";
import type { TelephonyEvent, AiAgentEvent } from "@/app/actions/webhooks";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";

export default function WebhookEventsPage() {
  const [telephonyEvents, setTelephonyEvents] = useState<TelephonyEvent[]>([]);
  const [aiAgentEvents, setAiAgentEvents] = useState<AiAgentEvent[]>([]);
  const [stats, setStats] = useState<{ telephonyCount: number; aiAgentCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"telephony" | "ai">("telephony");
  const [filters, setFilters] = useState({
    eventType: "",
    limit: 50,
  });
  const [selectedEvent, setSelectedEvent] = useState<TelephonyEvent | AiAgentEvent | null>(null);
  const detailsModal = useModal();

  useEffect(() => {
    loadWebhookEvents();
  }, [filters]);

  const loadWebhookEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const [eventsData, statsData] = await Promise.all([
        getWebhookEventsAction({
          eventType: filters.eventType || undefined,
          limit: filters.limit,
        }),
        getWebhookStatsAction(),
      ]);

      setTelephonyEvents(eventsData.telephony);
      setAiAgentEvents(eventsData.aiAgent);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load webhook events");
      console.error("Error loading webhook events:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getEventTypeColor = (eventType: string) => {
    const normalized = eventType.toLowerCase();
    if (normalized.includes("error") || normalized.includes("failed")) {
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    }
    if (normalized.includes("started") || normalized.includes("initiated")) {
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    }
    if (normalized.includes("ended") || normalized.includes("completed")) {
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    }
    return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  };

  const handleViewDetails = (event: TelephonyEvent | AiAgentEvent) => {
    setSelectedEvent(event);
    detailsModal.openModal();
  };

  const currentEvents = activeTab === "telephony" ? telephonyEvents : aiAgentEvents;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Webhook Events</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            View recent Telnyx webhook events for telephony and AI assistant calls
          </p>
        </div>
        <button
          onClick={loadWebhookEvents}
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Telephony Events</div>
            <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{stats.telephonyCount}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">AI Agent Events</div>
            <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{stats.aiAgentCount}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Event Type</label>
            <input
              type="text"
              value={filters.eventType}
              onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
              placeholder="e.g. call.initiated"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Limit</label>
            <input
              type="number"
              value={filters.limit}
              onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value) || 50 })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
            />
          </div>
          <div className="flex items-end">
            <div className="flex rounded-lg border border-gray-300 dark:border-gray-700">
              <button
                onClick={() => setActiveTab("telephony")}
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === "telephony"
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                }`}
              >
                Telephony ({telephonyEvents.length})
              </button>
              <button
                onClick={() => setActiveTab("ai")}
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === "ai"
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                }`}
              >
                AI Agent ({aiAgentEvents.length})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Events Table */}
      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Event Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  External ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-900">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : currentEvents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No webhook events found
                  </td>
                </tr>
              ) : (
                currentEvents.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(event.received_at)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getEventTypeColor(event.event_type)}`}
                      >
                        {event.event_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-500 dark:text-gray-400">
                      {event.external_id || "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <button
                        onClick={() => handleViewDetails(event)}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Event Details Modal */}
      <Modal
        isOpen={detailsModal.isOpen}
        onClose={detailsModal.closeModal}
        className="relative w-full max-w-4xl m-5 sm:m-0 rounded-3xl bg-white p-6 lg:p-8 dark:bg-gray-900"
      >
        {selectedEvent && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Event Details</h2>
              <button
                onClick={detailsModal.closeModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Event Type</div>
                <div className="mt-1">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getEventTypeColor(selectedEvent.event_type)}`}
                  >
                    {selectedEvent.event_type}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Provider</div>
                <div className="mt-1 text-gray-900 dark:text-white">{selectedEvent.provider}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">External ID</div>
                <div className="mt-1 font-mono text-sm text-gray-900 dark:text-white">
                  {selectedEvent.external_id || "-"}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Received At</div>
                <div className="mt-1 text-gray-900 dark:text-white">{formatDate(selectedEvent.received_at)}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Payload</div>
                <pre className="mt-1 max-h-96 overflow-auto rounded-lg bg-gray-100 p-3 text-xs text-gray-900 dark:bg-gray-800 dark:text-gray-300">
                  {JSON.stringify(selectedEvent.payload, null, 2)}
                </pre>
              </div>
            </div>
            <div className="mt-6 flex w-full">
              <button
                onClick={detailsModal.closeModal}
                className="w-full rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
