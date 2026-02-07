"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { PlusIcon, PencilIcon, MagnifyingGlassIcon, TrashIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface Event {
  id: string;
  name: string;
  key: string;
  description: string;
  category: string;
  isActive: boolean;
  eventCount: number;
}

const events: Event[] = [
  {
    id: "1",
    name: "User Signup",
    key: "user.signup",
    description: "Triggered when a new user signs up",
    category: "User",
    isActive: true,
    eventCount: 1250,
  },
  {
    id: "2",
    name: "Subscription Created",
    key: "subscription.created",
    description: "Triggered when a subscription is created",
    category: "Subscription",
    isActive: true,
    eventCount: 890,
  },
  {
    id: "3",
    name: "Payment Processed",
    key: "payment.processed",
    description: "Triggered when a payment is successfully processed",
    category: "Payment",
    isActive: true,
    eventCount: 2340,
  },
];

export default function AnalyticsEventsPage() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    key: "",
    description: "",
    category: "",
  });

  const filteredEvents = events.filter(
    (event) =>
      event.name.toLowerCase().includes(search.toLowerCase()) ||
      event.key.toLowerCase().includes(search.toLowerCase()) ||
      event.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageBreadcrumb pageTitle="Analytics Events" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Analytics Events</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Track and manage analytics events
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <PlusIcon className="h-4 w-4" />
            Add Event
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events..."
            className="h-11 w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
          />
        </div>

        {showForm && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Add Event</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="event-name">Event Name</Label>
                <Input
                  id="event-name"
                  type="text"
                  defaultValue={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., User Signup"
                />
              </div>
              <div>
                <Label htmlFor="event-key">Event Key</Label>
                <Input
                  id="event-key"
                  type="text"
                  defaultValue={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  placeholder="e.g., user.signup"
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
                <Input
                  id="event-category"
                  type="text"
                  defaultValue={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., User"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button>Save Event</Button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Event Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Event Key
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Event Count
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredEvents.map((event) => (
                  <tr key={event.id}>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {event.name}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{event.key}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{event.category}</td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {event.eventCount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          event.isActive
                            ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                      >
                        {event.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm">
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

