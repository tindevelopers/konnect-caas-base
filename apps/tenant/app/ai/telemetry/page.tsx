"use client";

import React, { useState, useEffect } from "react";
import { getTelemetryEventsAction, getTelemetryStatsAction } from "@/app/actions/telemetry";

interface TelemetryEvent {
  id?: string;
  tenant_id?: string | null;
  user_id?: string | null;
  event_type: string;
  operation: string;
  provider: string;
  status: "success" | "error" | "timeout";
  duration_ms: number;
  request_data?: Record<string, any>;
  response_data?: Record<string, any>;
  error_message?: string;
  error_stack?: string;
  metadata?: Record<string, any>;
  created_at?: string;
}

interface TelemetryStats {
  total_events: number;
  success_count: number;
  error_count: number;
  avg_duration_ms: number;
  operations: Record<string, { count: number; avg_duration_ms: number; error_count: number }>;
}

export default function TelemetryPage() {
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [stats, setStats] = useState<TelemetryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    operation: "",
    status: "" as "" | "success" | "error" | "timeout",
    provider: "",
    limit: 50,
  });
  const [selectedEvent, setSelectedEvent] = useState<TelemetryEvent | null>(null);

  useEffect(() => {
    loadTelemetry();
  }, [filters]);

  const loadTelemetry = async () => {
    try {
      setLoading(true);
      setError(null);

      const [eventsData, statsData] = await Promise.all([
        getTelemetryEventsAction({
          operation: filters.operation || undefined,
          status: filters.status || undefined,
          provider: filters.provider || undefined,
          limit: filters.limit,
        }),
        getTelemetryStatsAction({
          provider: filters.provider || undefined,
        }),
      ]);

      setEvents(eventsData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load telemetry");
      console.error("Error loading telemetry:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "error":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "timeout":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Telemetry & Instrumentation</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Monitor API calls, performance, and errors for faster testing
          </p>
        </div>
        <button
          onClick={loadTelemetry}
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Events</div>
            <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{stats.total_events}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Success</div>
            <div className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">{stats.success_count}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Errors</div>
            <div className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">{stats.error_count}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Duration</div>
            <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
              {formatDuration(stats.avg_duration_ms)}
            </div>
          </div>
        </div>
      )}

      {/* Operation Stats */}
      {stats && Object.keys(stats.operations).length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Operation Statistics</h2>
          <div className="mt-4 space-y-2">
            {Object.entries(stats.operations).map(([operation, opStats]) => (
              <div
                key={operation}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-800"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">{operation}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {opStats.count} calls • {opStats.error_count} errors
                  </div>
                </div>
                <div className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  {formatDuration(opStats.avg_duration_ms)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Operation</label>
            <input
              type="text"
              value={filters.operation}
              onChange={(e) => setFilters({ ...filters, operation: e.target.value })}
              placeholder="e.g. listAssistants"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <option value="">All</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
              <option value="timeout">Timeout</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Provider</label>
            <input
              type="text"
              value={filters.provider}
              onChange={(e) => setFilters({ ...filters, provider: e.target.value })}
              placeholder="e.g. telnyx"
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
                  Operation
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Duration
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Error
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-900">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No telemetry events found
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(event.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      {event.operation}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(event.status)}`}
                      >
                        {event.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {formatDuration(event.duration_ms)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {event.error_message ? (
                        <span className="text-red-600 dark:text-red-400">{event.error_message}</span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <button
                        onClick={() => setSelectedEvent(event)}
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
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-lg dark:bg-gray-900">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Event Details</h2>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Operation</div>
                <div className="mt-1 text-gray-900 dark:text-white">{selectedEvent.operation}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Provider</div>
                <div className="mt-1 text-gray-900 dark:text-white">{selectedEvent.provider}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</div>
                <div className="mt-1">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(selectedEvent.status)}`}>
                    {selectedEvent.status}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Duration</div>
                <div className="mt-1 text-gray-900 dark:text-white">{formatDuration(selectedEvent.duration_ms)}</div>
              </div>
              {selectedEvent.error_message && (
                <div>
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Error Message</div>
                  <div className="mt-1 text-red-600 dark:text-red-400">{selectedEvent.error_message}</div>
                </div>
              )}
              {selectedEvent.error_stack && (
                <div>
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Error Stack</div>
                  <pre className="mt-1 overflow-auto rounded bg-gray-100 p-3 text-xs text-gray-900 dark:bg-gray-800 dark:text-gray-300">
                    {selectedEvent.error_stack}
                  </pre>
                </div>
              )}
              {selectedEvent.request_data && (
                <div>
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Request Data</div>
                  <pre className="mt-1 overflow-auto rounded bg-gray-100 p-3 text-xs text-gray-900 dark:bg-gray-800 dark:text-gray-300">
                    {JSON.stringify(selectedEvent.request_data, null, 2)}
                  </pre>
                </div>
              )}
              {selectedEvent.response_data && (
                <div>
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Response Data</div>
                  <pre className="mt-1 overflow-auto rounded bg-gray-100 p-3 text-xs text-gray-900 dark:bg-gray-800 dark:text-gray-300">
                    {JSON.stringify(selectedEvent.response_data, null, 2)}
                  </pre>
                </div>
              )}
              {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Metadata</div>
                  <pre className="mt-1 overflow-auto rounded bg-gray-100 p-3 text-xs text-gray-900 dark:bg-gray-800 dark:text-gray-300">
                    {JSON.stringify(selectedEvent.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
