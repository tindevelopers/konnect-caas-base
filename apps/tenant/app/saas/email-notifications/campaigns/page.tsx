"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { PlusIcon, PlayIcon, PauseIcon, TrashIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface Campaign {
  id: string;
  name: string;
  template: string;
  recipients: number;
  sent: number;
  opened: number;
  clicked: number;
  status: "draft" | "scheduled" | "sending" | "completed" | "paused";
  scheduledFor?: string;
}

const campaigns: Campaign[] = [
  {
    id: "1",
    name: "Q1 Product Update",
    template: "Monthly Newsletter",
    recipients: 5000,
    sent: 5000,
    opened: 3200,
    clicked: 850,
    status: "completed",
  },
  {
    id: "2",
    name: "New Feature Announcement",
    template: "Feature Announcement",
    recipients: 10000,
    sent: 7500,
    opened: 0,
    clicked: 0,
    status: "sending",
  },
  {
    id: "3",
    name: "Holiday Promotion",
    template: "Promotional Email",
    recipients: 15000,
    sent: 0,
    opened: 0,
    clicked: 0,
    status: "scheduled",
    scheduledFor: "2025-01-20 09:00 AM",
  },
];

export default function EmailCampaignsPage() {
  const [campaignList, setCampaignList] = useState<Campaign[]>(campaigns);
  const createModal = useModal();
  const [formData, setFormData] = useState({
    name: "",
    template: "",
    recipients: "",
    scheduledFor: "",
  });

  const handleCreate = () => {
    const newCampaign: Campaign = {
      id: Date.now().toString(),
      name: formData.name,
      template: formData.template,
      recipients: parseInt(formData.recipients),
      sent: 0,
      opened: 0,
      clicked: 0,
      status: formData.scheduledFor ? "scheduled" : "draft",
      scheduledFor: formData.scheduledFor || undefined,
    };
    setCampaignList([...campaignList, newCampaign]);
    createModal.closeModal();
    setFormData({ name: "", template: "", recipients: "", scheduledFor: "" });
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Email Campaigns" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Email Campaigns</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Create and manage email marketing campaigns
            </p>
          </div>
          <Button onClick={createModal.openModal}>
            <PlusIcon className="h-4 w-4" />
            Create Campaign
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {campaignList.map((campaign) => (
            <div
              key={campaign.id}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {campaign.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{campaign.template}</p>
                </div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    campaign.status === "completed"
                      ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500"
                      : campaign.status === "sending"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-500"
                      : campaign.status === "scheduled"
                      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-500"
                      : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  {campaign.status}
                </span>
              </div>
              <div className="mb-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Recipients</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {campaign.recipients.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Sent</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {campaign.sent.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Opened</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {campaign.opened.toLocaleString()} (
                    {campaign.sent > 0
                      ? ((campaign.opened / campaign.sent) * 100).toFixed(1)
                      : 0}
                    %)
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Clicked</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {campaign.clicked.toLocaleString()} (
                    {campaign.opened > 0
                      ? ((campaign.clicked / campaign.opened) * 100).toFixed(1)
                      : 0}
                    %)
                  </span>
                </div>
              </div>
              {campaign.scheduledFor && (
                <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
                  Scheduled: {campaign.scheduledFor}
                </p>
              )}
              <div className="flex gap-2">
                {campaign.status === "sending" ? (
                  <Button variant="outline" size="sm" className="flex-1">
                    <PauseIcon className="h-4 w-4" />
                    Pause
                  </Button>
                ) : campaign.status === "draft" || campaign.status === "scheduled" ? (
                  <Button variant="outline" size="sm" className="flex-1">
                    <PlayIcon className="h-4 w-4" />
                    Start
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" className="flex-1">
                  <TrashIcon className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Campaign Modal */}
      <Modal isOpen={createModal.isOpen} onClose={createModal.closeModal} className="max-w-[600px] m-4">
        <div className="p-6">
          <h3 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Create Campaign</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="campaign-name">Campaign Name</Label>
              <Input
                id="campaign-name"
                type="text"
                defaultValue={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Q1 Product Update"
              />
            </div>
            <div>
              <Label htmlFor="campaign-template">Email Template</Label>
              <select
                id="campaign-template"
                value={formData.template}
                onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
              >
                <option value="">Select template</option>
                <option value="Monthly Newsletter">Monthly Newsletter</option>
                <option value="Feature Announcement">Feature Announcement</option>
                <option value="Promotional Email">Promotional Email</option>
              </select>
            </div>
            <div>
              <Label htmlFor="campaign-recipients">Number of Recipients</Label>
              <Input
                id="campaign-recipients"
                type="number"
                defaultValue={formData.recipients}
                onChange={(e) => setFormData({ ...formData, recipients: e.target.value })}
                placeholder="1000"
              />
            </div>
            <div>
              <Label htmlFor="campaign-schedule">Schedule For (Optional)</Label>
              <Input
                id="campaign-schedule"
                type="datetime-local"
                defaultValue={formData.scheduledFor}
                onChange={(e) => setFormData({ ...formData, scheduledFor: e.target.value })}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={createModal.closeModal} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleCreate} className="flex-1">
                Create Campaign
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

