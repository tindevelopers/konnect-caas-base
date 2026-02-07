"use client";

export const dynamic = 'force-dynamic';

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { CheckIcon, XMarkIcon, ClockIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import React, { useState } from "react";

interface Integration {
  id: string;
  name: string;
  category: string;
  description: string;
  icon?: string;
  status: "connected" | "disconnected" | "pending";
  lastSync?: string;
}

const integrations: Integration[] = [
  // CRM
  { id: "1", name: "Salesforce", category: "CRM", description: "Customer relationship management", status: "connected", lastSync: "2025-01-16 10:00 AM" },
  { id: "2", name: "HubSpot", category: "CRM", description: "Inbound marketing and sales platform", status: "disconnected" },
  { id: "3", name: "Pipedrive", category: "CRM", description: "Sales-focused CRM", status: "disconnected" },
  { id: "4", name: "GoHighLevel", category: "CRM", description: "All-in-one CRM and marketing automation", status: "pending" },
  
  // Email Marketing
  { id: "5", name: "Mailchimp", category: "Email Marketing", description: "Email marketing and automation", status: "connected", lastSync: "2025-01-16 09:30 AM" },
  { id: "6", name: "SendGrid", category: "Email Marketing", description: "Email delivery service", status: "connected", lastSync: "2025-01-16 09:15 AM" },
  { id: "7", name: "ConvertKit", category: "Email Marketing", description: "Email marketing for creators", status: "disconnected" },
  { id: "8", name: "ActiveCampaign", category: "Email Marketing", description: "Marketing automation platform", status: "disconnected" },
  
  // Telephony
  { id: "9", name: "Twilio", category: "Telephony", description: "Cloud communications platform", status: "connected", lastSync: "2025-01-16 10:15 AM" },
  { id: "10", name: "Telnyx", category: "Telephony", description: "Global communications API", status: "disconnected" },
  { id: "11", name: "Vonage", category: "Telephony", description: "Cloud communications", status: "disconnected" },
  
  // Payments
  { id: "12", name: "Stripe", category: "Payments", description: "Online payment processing", status: "connected", lastSync: "2025-01-16 10:30 AM" },
  { id: "13", name: "PayPal", category: "Payments", description: "Online payment system", status: "disconnected" },
  { id: "14", name: "Square", category: "Payments", description: "Payment processing and POS", status: "disconnected" },
  { id: "15", name: "Braintree", category: "Payments", description: "Payment gateway", status: "disconnected" },
  
  // Analytics
  { id: "16", name: "Google Analytics", category: "Analytics", description: "Web analytics service", status: "connected", lastSync: "2025-01-16 09:00 AM" },
  { id: "17", name: "Mixpanel", category: "Analytics", description: "Product analytics platform", status: "disconnected" },
  { id: "18", name: "Amplitude", category: "Analytics", description: "Product analytics and data", status: "disconnected" },
  
  // Accounting
  { id: "19", name: "QuickBooks", category: "Accounting", description: "Accounting software", status: "disconnected" },
  { id: "20", name: "Xero", category: "Accounting", description: "Cloud-based accounting", status: "disconnected" },
  { id: "21", name: "FreshBooks", category: "Accounting", description: "Cloud accounting software", status: "disconnected" },
  
  // E-commerce
  { id: "22", name: "Shopify", category: "E-commerce", description: "E-commerce platform", status: "connected", lastSync: "2025-01-16 08:00 AM" },
  { id: "23", name: "WooCommerce", category: "E-commerce", description: "WordPress e-commerce plugin", status: "disconnected" },
  { id: "24", name: "BigCommerce", category: "E-commerce", description: "E-commerce platform", status: "disconnected" },
  
  // Social Media
  { id: "25", name: "Facebook", category: "Social Media", description: "Social media platform", status: "disconnected" },
  { id: "26", name: "Twitter/X", category: "Social Media", description: "Social media platform", status: "disconnected" },
  { id: "27", name: "LinkedIn", category: "Social Media", description: "Professional networking", status: "disconnected" },
  { id: "28", name: "Instagram", category: "Social Media", description: "Photo and video sharing", status: "disconnected" },
  
  // Customer Support
  { id: "29", name: "Zendesk", category: "Customer Support", description: "Customer service platform", status: "connected", lastSync: "2025-01-16 09:45 AM" },
  { id: "30", name: "Intercom", category: "Customer Support", description: "Customer messaging platform", status: "disconnected" },
  { id: "31", name: "Freshdesk", category: "Customer Support", description: "Customer support software", status: "disconnected" },
];

const categories = [
  "All",
  "CRM",
  "Email Marketing",
  "Telephony",
  "Payments",
  "Analytics",
  "Accounting",
  "E-commerce",
  "Social Media",
  "Customer Support",
];

const statusIcons = {
  connected: CheckIcon,
  disconnected: XMarkIcon,
  pending: ClockIcon,
};

const statusColors = {
  connected: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500",
  disconnected: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-500",
};

export default function IntegrationsListPage() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredIntegrations = integrations.filter((integration) => {
    const matchesSearch =
      integration.name.toLowerCase().includes(search.toLowerCase()) ||
      integration.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "All" || integration.category === selectedCategory;
    const matchesStatus = statusFilter === "all" || integration.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const groupedByCategory = categories.slice(1).map((category) => ({
    category,
    integrations: filteredIntegrations.filter((i) => i.category === category),
  }));

  return (
    <div>
      <PageBreadcrumb pageTitle="Integrations" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Integrations</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Connect and manage third-party integrations
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search integrations..."
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
            />
          </div>
          <div className="flex gap-2">
            {["all", "connected", "disconnected", "pending"].map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "primary" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(status)}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800 pb-4">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                selectedCategory === category
                  ? "bg-brand-500 text-white"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Integrations by Category */}
        {selectedCategory === "All" ? (
          <div className="space-y-8">
            {groupedByCategory.map(({ category, integrations: categoryIntegrations }) => (
              <div key={category}>
                <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
                  {category}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {categoryIntegrations.map((integration) => {
                    const Icon = statusIcons[integration.status];
                    return (
                      <Link
                        key={integration.id}
                        href={`/saas/integrations/${integration.category.toLowerCase().replace(/\s+/g, "-")}/${integration.name.toLowerCase().replace(/\s+/g, "-")}`}
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
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[integration.status]}`}
                          >
                            <Icon className="h-3 w-3" />
                            {integration.status}
                          </span>
                        </div>
                        {integration.lastSync && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Last sync: {integration.lastSync}
                          </p>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredIntegrations.map((integration) => {
              const Icon = statusIcons[integration.status];
              return (
                <Link
                  key={integration.id}
                  href={`/templates/saas/integrations/${integration.category.toLowerCase().replace(/\s+/g, "-")}/${integration.name.toLowerCase().replace(/\s+/g, "-")}`}
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
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[integration.status]}`}
                    >
                      <Icon className="h-3 w-3" />
                      {integration.status}
                    </span>
                  </div>
                  {integration.lastSync && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Last sync: {integration.lastSync}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
