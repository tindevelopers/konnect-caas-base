"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Switch from "@/components/form/switch/Switch";
import React, { useState } from "react";

export default function EmailNotificationSettingsPage() {
  const [settings, setSettings] = useState({
    smtpHost: "smtp.example.com",
    smtpPort: 587,
    smtpUsername: "noreply@example.com",
    smtpPassword: "••••••••",
    fromEmail: "noreply@example.com",
    fromName: "SaaS Platform",
    enableBounceHandling: true,
    enableUnsubscribe: true,
    rateLimitPerHour: 1000,
  });

  return (
    <div>
      <PageBreadcrumb pageTitle="Email Notification Settings" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
            Email Notification Settings
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Configure SMTP settings and email notification preferences
          </p>
        </div>

        {/* SMTP Configuration */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">SMTP Configuration</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="smtp-host">SMTP Host</Label>
              <Input
                id="smtp-host"
                type="text"
                defaultValue={settings.smtpHost}
                onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="smtp-port">SMTP Port</Label>
              <Input
                id="smtp-port"
                type="number"
                defaultValue={settings.smtpPort.toString()}
                onChange={(e) => setSettings({ ...settings, smtpPort: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="smtp-username">SMTP Username</Label>
              <Input
                id="smtp-username"
                type="text"
                defaultValue={settings.smtpUsername}
                onChange={(e) => setSettings({ ...settings, smtpUsername: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="smtp-password">SMTP Password</Label>
              <Input
                id="smtp-password"
                type="password"
                defaultValue={settings.smtpPassword}
                onChange={(e) => setSettings({ ...settings, smtpPassword: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* From Address */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">From Address</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="from-email">From Email</Label>
              <Input
                id="from-email"
                type="email"
                defaultValue={settings.fromEmail}
                onChange={(e) => setSettings({ ...settings, fromEmail: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="from-name">From Name</Label>
              <Input
                id="from-name"
                type="text"
                defaultValue={settings.fromName}
                onChange={(e) => setSettings({ ...settings, fromName: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Email Preferences */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Email Preferences</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="bounce-handling">Enable Bounce Handling</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Automatically handle bounced emails
                </p>
              </div>
              <Switch
                id="bounce-handling"
                defaultChecked={settings.enableBounceHandling}
                onChange={(checked) => setSettings({ ...settings, enableBounceHandling: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="unsubscribe">Enable Unsubscribe</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Allow users to unsubscribe from emails
                </p>
              </div>
              <Switch
                id="unsubscribe"
                defaultChecked={settings.enableUnsubscribe}
                onChange={(checked) => setSettings({ ...settings, enableUnsubscribe: checked })}
              />
            </div>
            <div>
              <Label htmlFor="rate-limit">Rate Limit (emails per hour)</Label>
              <Input
                id="rate-limit"
                type="number"
                defaultValue={settings.rateLimitPerHour.toString()}
                onChange={(e) =>
                  setSettings({ ...settings, rateLimitPerHour: parseInt(e.target.value) })
                }
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

