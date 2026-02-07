"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Switch from "@/components/form/switch/Switch";
import Label from "@/components/form/Label";
import React, { useState } from "react";

export default function IntegrationSettingsPage() {
  const [settings, setSettings] = useState({
    allowPublicIntegrations: false,
    requireApproval: true,
    enableWebhooks: true,
    webhookSecret: "whsec_abc123...",
    rateLimitPerMinute: 100,
  });

  return (
    <div>
      <PageBreadcrumb pageTitle="Integration Settings" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
            Integration Settings
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Configure integration and API settings
          </p>
        </div>

        {/* General Settings */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            General Settings
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="public-integrations">Allow Public Integrations</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Allow users to create their own integrations
                </p>
              </div>
              <Switch
                id="public-integrations"
                defaultChecked={settings.allowPublicIntegrations}
                onChange={(checked) =>
                  setSettings({ ...settings, allowPublicIntegrations: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="require-approval">Require Approval</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Require admin approval for new integrations
                </p>
              </div>
              <Switch
                id="require-approval"
                defaultChecked={settings.requireApproval}
                onChange={(checked) => setSettings({ ...settings, requireApproval: checked })}
              />
            </div>
          </div>
        </div>

        {/* Webhook Settings */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Webhook Settings
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="enable-webhooks">Enable Webhooks</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Allow integrations to receive webhook events
                </p>
              </div>
              <Switch
                id="enable-webhooks"
                defaultChecked={settings.enableWebhooks}
                onChange={(checked) => setSettings({ ...settings, enableWebhooks: checked })}
              />
            </div>
            <div>
              <Label htmlFor="webhook-secret">Webhook Secret</Label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  id="webhook-secret"
                  type="password"
                  defaultValue={settings.webhookSecret}
                  readOnly
                  className="h-11 flex-1 rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                />
                <Button variant="outline" size="sm">
                  Regenerate
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Rate Limiting */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Rate Limiting</h2>
          <div>
            <Label htmlFor="rate-limit">API Requests per Minute</Label>
            <input
              id="rate-limit"
              type="number"
              defaultValue={settings.rateLimitPerMinute.toString()}
              onChange={(e) =>
                setSettings({ ...settings, rateLimitPerMinute: parseInt(e.target.value) })
              }
              className="mt-2 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button>Save Settings</Button>
        </div>
      </div>
    </div>
  );
}

