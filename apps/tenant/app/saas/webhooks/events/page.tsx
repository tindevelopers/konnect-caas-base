"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { PlusIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface EventType {
  id: string;
  name: string;
  description: string;
  category: string;
  isEnabled: boolean;
}

const eventTypes: EventType[] = [
  {
    id: "1",
    name: "order.created",
    description: "Triggered when a new order is created",
    category: "Orders",
    isEnabled: true,
  },
  {
    id: "2",
    name: "order.updated",
    description: "Triggered when an order is updated",
    category: "Orders",
    isEnabled: true,
  },
  {
    id: "3",
    name: "payment.succeeded",
    description: "Triggered when a payment is successfully processed",
    category: "Payments",
    isEnabled: true,
  },
  {
    id: "4",
    name: "payment.failed",
    description: "Triggered when a payment fails",
    category: "Payments",
    isEnabled: true,
  },
  {
    id: "5",
    name: "user.created",
    description: "Triggered when a new user is created",
    category: "Users",
    isEnabled: true,
  },
  {
    id: "6",
    name: "user.updated",
    description: "Triggered when a user is updated",
    category: "Users",
    isEnabled: false,
  },
  {
    id: "7",
    name: "subscription.created",
    description: "Triggered when a subscription is created",
    category: "Subscriptions",
    isEnabled: true,
  },
  {
    id: "8",
    name: "subscription.cancelled",
    description: "Triggered when a subscription is cancelled",
    category: "Subscriptions",
    isEnabled: true,
  },
];

export default function WebhookEventsPage() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
  });

  const categories = Array.from(new Set(eventTypes.map((e) => e.category)));

  return (
    <div>
      <PageBreadcrumb pageTitle="Webhook Events" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Webhook Events</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Configure available webhook event types
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <PlusIcon className="h-4 w-4" />
            Add Event Type
          </Button>
        </div>

        {showForm && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Add Event Type</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="event-name">Event Name</Label>
                <Input
                  id="event-name"
                  type="text"
                  defaultValue={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., order.created"
                />
              </div>
              <div>
                <Label htmlFor="event-description">Description</Label>
                <textarea
                  id="event-description"
                  defaultValue={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                  placeholder="Describe when this event is triggered"
                />
              </div>
              <div>
                <Label htmlFor="event-category">Category</Label>
                <select
                  id="event-category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button>Save Event Type</Button>
            </div>
          </div>
        )}

        {categories.map((category) => (
          <div
            key={category}
            className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{category}</h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {eventTypes
                .filter((event) => event.category === category)
                .map((event) => (
                  <div key={event.id} className="flex items-center justify-between px-6 py-4">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">{event.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{event.description}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          event.isEnabled
                            ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                      >
                        {event.isEnabled ? "Enabled" : "Disabled"}
                      </span>
                      <Button variant="outline" size="sm">
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

