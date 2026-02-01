"use client";

import React, { useMemo, useState } from "react";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import { PlusIcon, PlayIcon, PauseIcon, TrashIcon } from "@heroicons/react/24/outline";
import { CampaignStatus } from "@/types/campaigns";

interface Campaign {
  id: string;
  name: string;
  template: string;
  channel: "email" | "sms" | "call";
  recipients: number;
  sent: number;
  opened: number;
  clicked: number;
  status: CampaignStatus;
  scheduledFor?: string;
}

const initialCampaigns: Campaign[] = [
  {
    id: "1",
    name: "Enterprise Outreach Series",
    template: "New Product Launch",
    channel: "email",
    recipients: 4500,
    sent: 4200,
    opened: 2800,
    clicked: 950,
    status: "completed",
  },
  {
    id: "2",
    name: "Telnyx Warm Call Push",
    template: "Call + SMS Reminder",
    channel: "sms",
    recipients: 1800,
    sent: 700,
    opened: 450,
    clicked: 210,
    status: "sending",
  },
  {
    id: "3",
    name: "GHL CRM Nurture",
    template: "Campaign Funnel",
    channel: "email",
    recipients: 8200,
    sent: 0,
    opened: 0,
    clicked: 0,
    status: "scheduled",
    scheduledFor: "2025-02-03 09:00 AM",
  },
];

const CampaignChannelBadge = ({ channel }: { channel: Campaign["channel"] }) => {
  const meta = {
    email: { label: "Email", bg: "bg-indigo-100 text-indigo-700", icon: "✉️" },
    sms: { label: "SMS", bg: "bg-amber-100 text-amber-700", icon: "💬" },
    call: { label: "Call", bg: "bg-sky-100 text-sky-700", icon: "📞" },
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${meta[channel].bg}`}>
      <span>{meta[channel].icon}</span>
      {meta[channel].label}
    </span>
  );
};

const statusStyles: Record<CampaignStatus, string> = {
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200",
  sending: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200",
  scheduled: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200",
  paused: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-100",
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-100",
};

export default function CampaignOverviewCards() {
  const [campaignList, setCampaignList] = useState<Campaign[]>(initialCampaigns);
  const createModal = useModal();
  const [formData, setFormData] = useState({
    name: "",
    template: "",
    channel: "email",
    recipients: "",
    scheduledFor: "",
  });

  const summary = useMemo(() => {
    const totals = campaignList.reduce(
      (acc, campaign) => {
        acc.recipients += campaign.recipients;
        acc.sent += campaign.sent;
        acc.opened += campaign.opened;
        acc.clicked += campaign.clicked;
        if (campaign.status === "sending") acc.sending++;
        if (campaign.status === "scheduled") acc.scheduled++;
        return acc;
      },
      { recipients: 0, sent: 0, opened: 0, clicked: 0, sending: 0, scheduled: 0 }
    );
    return totals;
  }, [campaignList]);

  const handleCreate = () => {
    if (!formData.name.trim() || !formData.template.trim()) {
      return;
    }

    const newCampaign: Campaign = {
      id: Date.now().toString(),
      name: formData.name.trim(),
      template: formData.template.trim(),
      channel: formData.channel as Campaign["channel"],
      recipients: Number(formData.recipients) || 0,
      sent: 0,
      opened: 0,
      clicked: 0,
      status: formData.scheduledFor ? "scheduled" : "draft",
      scheduledFor: formData.scheduledFor || undefined,
    };

    setCampaignList((prev) => [newCampaign, ...prev]);
    createModal.closeModal();
    setFormData({
      name: "",
      template: "",
      channel: "email",
      recipients: "",
      scheduledFor: "",
    });
  };

  return (
    <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Campaign Summary
          </p>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Active Campaigns</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage sent, scheduled, and paused campaigns that touch CRM records first.
          </p>
        </div>
        <Button onClick={createModal.openModal}>
          <PlusIcon className="h-4 w-4" />
          Create Campaign
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Recipients" value={summary.recipients.toLocaleString()} />
        <StatCard label="Sent" value={summary.sent.toLocaleString()} />
        <StatCard label="Opened" value={summary.opened.toLocaleString()} />
        <StatCard label="Clicks" value={summary.clicked.toLocaleString()} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {campaignList.map((campaign) => (
          <div
            key={campaign.id}
            className="flex flex-col rounded-xl border border-gray-100 bg-gray-50/80 p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/40"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
                #{campaign.id.slice(-3)}
              </span>
              <CampaignChannelBadge channel={campaign.channel} />
            </div>
            <div className="mt-3 space-y-2">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{campaign.name}</h3>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                  {campaign.template}
                </p>
              </div>
              <div className="grid gap-2 text-sm text-gray-600 dark:text-gray-300">
                <StatLine label="Recipients" value={campaign.recipients.toLocaleString()} />
                <StatLine label="Sent" value={campaign.sent.toLocaleString()} />
                <StatLine label="Opened" value={campaign.opened.toLocaleString()} />
                <StatLine label="Clicked" value={campaign.clicked.toLocaleString()} />
              </div>
              {campaign.scheduledFor && (
                <p className="text-xs text-gray-500 dark:text-gray-400">Scheduled for {campaign.scheduledFor}</p>
              )}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[campaign.status]}`}
              >
                {campaign.status}
              </span>
              {campaign.status === "sending" && (
                <Button variant="outline" size="sm">
                  <PauseIcon className="h-4 w-4" />
                  Pause
                </Button>
              )}
              {(campaign.status === "draft" || campaign.status === "scheduled") && (
                <Button variant="outline" size="sm">
                  <PlayIcon className="h-4 w-4" />
                  Start
                </Button>
              )}
              <Button variant="outline" size="sm">
                <TrashIcon className="h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={createModal.isOpen} onClose={createModal.closeModal} className="max-w-xl m-4">
        <div className="space-y-4 p-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">New CRM Campaign</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Connect with your audience using CRM records first, then layer Telnyx calls or SMS.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="campaign-name">Campaign Name</Label>
              <Input
                id="campaign-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="campaign-template">Template</Label>
              <Input
                id="campaign-template"
                value={formData.template}
                onChange={(e) => setFormData({ ...formData, template: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="campaign-channel">Channel</Label>
              <select
                id="campaign-channel"
                value={formData.channel}
                onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-300 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="call">Call</option>
              </select>
            </div>
            <div>
              <Label htmlFor="campaign-recipients">Recipients</Label>
              <Input
                id="campaign-recipients"
                type="number"
                value={formData.recipients}
                onChange={(e) => setFormData({ ...formData, recipients: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="campaign-schedule">Schedule for (optional)</Label>
              <Input
                id="campaign-schedule"
                type="datetime-local"
                value={formData.scheduledFor}
                onChange={(e) => setFormData({ ...formData, scheduledFor: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={createModal.closeModal}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Create Campaign</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
    <p className="text-xs text-gray-400">{label}</p>
    <p className="text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
  </div>
);

const StatLine = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
    <span>{label}</span>
    <span className="font-semibold text-gray-900 dark:text-white">{value}</span>
  </div>
);
