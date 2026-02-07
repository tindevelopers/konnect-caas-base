"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import React from "react";

const emailIntegrations = [
  { name: "Mailchimp", slug: "mailchimp", status: "connected", description: "Email marketing and automation" },
  { name: "SendGrid", slug: "sendgrid", status: "connected", description: "Email delivery service" },
  { name: "ConvertKit", slug: "convertkit", status: "disconnected", description: "Email marketing for creators" },
  { name: "ActiveCampaign", slug: "activecampaign", status: "disconnected", description: "Marketing automation platform" },
];

const statusIcons = {
  connected: CheckIcon,
  disconnected: XMarkIcon,
};

const statusColors = {
  connected: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500",
  disconnected: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export default function EmailMarketingIntegrationsPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Email Marketing Integrations" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
            Email Marketing Integrations
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Connect email marketing platforms to sync contacts and send campaigns
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {emailIntegrations.map((integration) => {
            const Icon = statusIcons[integration.status as keyof typeof statusIcons];
            return (
              <Link
                key={integration.slug}
                href={`/saas/integrations/email-marketing/${integration.slug}`}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {integration.name}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {integration.description}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      statusColors[integration.status as keyof typeof statusColors]
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {integration.status}
                  </span>
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  {integration.status === "connected" ? "Configure" : "Connect"}
                </Button>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

