
"use client";

import React, { useMemo, useState } from "react";
import Button from "@/components/ui/button/Button";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";

interface OutreachRecord {
  id: string;
  channel: "email" | "sms" | "call";
  recipient: string;
  status: "queued" | "sent" | "failed" | "in_progress";
  cadence: string;
  owner: string;
  lastActivity: string;
}

const mockOutreach: OutreachRecord[] = [
  {
    id: "OUT-001",
    channel: "email",
    recipient: "Cody Wells",
    status: "sent",
    cadence: "Drip 1",
    owner: "CRM Team",
    lastActivity: "2025-01-26 09:03 AM",
  },
  {
    id: "OUT-002",
    channel: "sms",
    recipient: "Rae Donovan",
    status: "queued",
    cadence: "Telnyx follow-up",
    owner: "Dialer Squad",
    lastActivity: "2025-01-26 06:24 AM",
  },
  {
    id: "OUT-003",
    channel: "call",
    recipient: "Everett Lang",
    status: "in_progress",
    cadence: "AI Agent Warm Call",
    owner: "Retell AI",
    lastActivity: "2025-01-25 03:12 PM",
  },
  {
    id: "OUT-004",
    channel: "email",
    recipient: "Priya Sharma",
    status: "failed",
    cadence: "CRM Nurture",
    owner: "CRM Team",
    lastActivity: "2025-01-24 10:05 AM",
  },
];

const channelOptions = [
  { value: "all", label: "All Channels" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "call", label: "Calls" },
];

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "queued", label: "Queued" },
  { value: "in_progress", label: "In Progress" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
];

export default function CampaignOutreachTable() {
  const [channelFilter, setChannelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return mockOutreach.filter((record) => {
      const matchesChannel = channelFilter === "all" || record.channel === channelFilter;
      const matchesStatus = statusFilter === "all" || record.status === statusFilter;
      const matchesSearch = search
        ? record.recipient.toLowerCase().includes(search.toLowerCase()) ||
          record.cadence.toLowerCase().includes(search.toLowerCase())
        : true;
      return matchesChannel && matchesStatus && matchesSearch;
    });
  }, [channelFilter, statusFilter, search]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400 dark:text-gray-500">
            Outreach
          </p>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Calls · SMS · Email</h2>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline">
            Export
          </Button>
          <Button size="sm">New Outreach</Button>
        </div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div>
          <Label htmlFor="outreach-channel">Channel</Label>
          <Select
            id="outreach-channel"
            options={channelOptions}
            value={channelFilter}
            onChange={(value) => setChannelFilter(value)}
          />
        </div>
        <div>
          <Label htmlFor="outreach-status">Status</Label>
          <Select
            id="outreach-status"
            options={statusOptions}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value)}
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
            Search
          </p>
          <input
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-300 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            placeholder="Search by contact or cadence"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="mt-6 overflow-hidden rounded-xl border border-gray-100 dark:border-white/5">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500 dark:bg-gray-900 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Recipient</th>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Cadence</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Last Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white dark:divide-white/5 dark:bg-gray-900">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  No outreach matches the selected filters.
                </td>
              </tr>
            ) : (
              filtered.map((call) => (
                <tr key={call.id}>
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{call.id}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{call.recipient}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{call.channel.toUpperCase()}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{call.status.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{call.cadence}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{call.owner}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{call.lastActivity}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
