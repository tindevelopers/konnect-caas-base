"use client";
export const dynamic = 'force-dynamic';
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Switch from "@/components/form/switch/Switch";
import React, { useState } from "react";

export default function SupportSettingsPage() {
  const [settings, setSettings] = useState({
    autoAssignTickets: true,
    defaultPriority: "medium",
    slaResponseTime: 24,
    slaResolutionTime: 72,
    enableEmailNotifications: true,
    enableCustomerPortal: true,
    allowPublicTickets: false,
  });

  return (
    <div>
      <PageBreadcrumb pageTitle="Support Settings" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Support Settings</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Configure support ticket system preferences
          </p>
        </div>

        {/* Ticket Assignment */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Ticket Assignment
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="auto-assign">Auto-Assign Tickets</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Automatically assign tickets based on category
                </p>
              </div>
              <Switch
                id="auto-assign"
                defaultChecked={settings.autoAssignTickets}
                onChange={(checked) => setSettings({ ...settings, autoAssignTickets: checked })}
              />
            </div>
            <div>
              <Label htmlFor="default-priority">Default Priority</Label>
              <select
                id="default-priority"
                value={settings.defaultPriority}
                onChange={(e) => setSettings({ ...settings, defaultPriority: e.target.value })}
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
        </div>

        {/* SLA Settings */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">SLA Settings</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="response-time">Response Time (hours)</Label>
              <Input
                id="response-time"
                type="number"
                defaultValue={settings.slaResponseTime.toString()}
                onChange={(e) =>
                  setSettings({ ...settings, slaResponseTime: parseInt(e.target.value) })
                }
              />
            </div>
            <div>
              <Label htmlFor="resolution-time">Resolution Time (hours)</Label>
              <Input
                id="resolution-time"
                type="number"
                defaultValue={settings.slaResolutionTime.toString()}
                onChange={(e) =>
                  setSettings({ ...settings, slaResolutionTime: parseInt(e.target.value) })
                }
              />
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Notification Settings
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="email-notifications">Email Notifications</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Send email notifications for ticket updates
                </p>
              </div>
              <Switch
                id="email-notifications"
                defaultChecked={settings.enableEmailNotifications}
                onChange={(checked) =>
                  setSettings({ ...settings, enableEmailNotifications: checked })
                }
              />
            </div>
          </div>
        </div>

        {/* Customer Portal */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Customer Portal
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="customer-portal">Enable Customer Portal</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Allow customers to view and manage their tickets
                </p>
              </div>
              <Switch
                id="customer-portal"
                defaultChecked={settings.enableCustomerPortal}
                onChange={(checked) => setSettings({ ...settings, enableCustomerPortal: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="public-tickets">Allow Public Tickets</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Allow unauthenticated users to create tickets
                </p>
              </div>
              <Switch
                id="public-tickets"
                defaultChecked={settings.allowPublicTickets}
                onChange={(checked) => setSettings({ ...settings, allowPublicTickets: checked })}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button>Save Settings</Button>
        </div>
      </div>
    </div>
  );
}

