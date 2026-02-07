"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import { PlusIcon, PencilIcon, PlayIcon, TrashIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: "active" | "inactive";
  lastTriggered?: string;
  secret: string;
}

const webhooks: Webhook[] = [
  {
    id: "1",
    name: "Order Created",
    url: "https://api.example.com/webhooks/orders",
    events: ["order.created"],
    status: "active",
    lastTriggered: "2025-01-16 10:30 AM",
    secret: "whsec_abc123...",
  },
  {
    id: "2",
    name: "Payment Webhook",
    url: "https://api.example.com/webhooks/payments",
    events: ["payment.succeeded", "payment.failed"],
    status: "active",
    lastTriggered: "2025-01-16 09:15 AM",
    secret: "whsec_xyz789...",
  },
  {
    id: "3",
    name: "User Events",
    url: "https://api.example.com/webhooks/users",
    events: ["user.created", "user.updated", "user.deleted"],
    status: "inactive",
    secret: "whsec_def456...",
  },
];

export default function WebhookManagementPage() {
  const [webhookList, setWebhookList] = useState<Webhook[]>(webhooks);
  const createModal = useModal();
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    events: [] as string[],
    secret: "",
  });

  const handleCreate = () => {
    const newWebhook: Webhook = {
      id: Date.now().toString(),
      name: formData.name,
      url: formData.url,
      events: formData.events,
      status: "active",
      secret: `whsec_${Math.random().toString(36).substring(7)}...`,
    };
    setWebhookList([...webhookList, newWebhook]);
    createModal.closeModal();
    setFormData({ name: "", url: "", events: [], secret: "" });
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Webhook Management" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Webhook Management</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Create and manage webhooks for event notifications
            </p>
          </div>
          <Button onClick={createModal.openModal}>
            <PlusIcon className="h-4 w-4" />
            Create Webhook
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {webhookList.map((webhook) => (
            <div
              key={webhook.id}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {webhook.name}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{webhook.url}</p>
                </div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    webhook.status === "active"
                      ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500"
                      : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  {webhook.status}
                </span>
              </div>
              <div className="mb-4 space-y-2">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Events</p>
                <div className="flex flex-wrap gap-1">
                  {webhook.events.map((event) => (
                    <span
                      key={event}
                      className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-500/15 dark:text-blue-500"
                    >
                      {event}
                    </span>
                  ))}
                </div>
              </div>
              {webhook.lastTriggered && (
                <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
                  Last triggered: {webhook.lastTriggered}
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <PlayIcon className="h-4 w-4" />
                  Test
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <PencilIcon className="h-4 w-4" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <TrashIcon className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Webhook Modal */}
      <Modal isOpen={createModal.isOpen} onClose={createModal.closeModal} className="max-w-[600px] m-4">
        <div className="p-6">
          <h3 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Create Webhook</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="webhook-name">Webhook Name</Label>
              <Input
                id="webhook-name"
                type="text"
                defaultValue={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Order Created"
              />
            </div>
            <div>
              <Label htmlFor="webhook-url">Webhook URL</Label>
              <Input
                id="webhook-url"
                type="url"
                defaultValue={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://api.example.com/webhooks"
              />
            </div>
            <div>
              <Label>Events</Label>
              <div className="mt-2 space-y-2">
                {["order.created", "payment.succeeded", "payment.failed", "user.created"].map(
                  (event) => (
                    <label key={event} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.events.includes(event)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, events: [...formData.events, event] });
                          } else {
                            setFormData({
                              ...formData,
                              events: formData.events.filter((e) => e !== event),
                            });
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-brand-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{event}</span>
                    </label>
                  )
                )}
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={createModal.closeModal} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleCreate} className="flex-1">
                Create Webhook
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

