"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Switch from "@/components/form/switch/Switch";
import { CheckIcon, XMarkIcon, ClockIcon, KeyIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { useParams } from "next/navigation";
import React, { useState, useEffect } from "react";
import { saveIntegrationConfig, fetchIntegrationConfig } from "@/app/actions/integrations/config";
import { connectGoHighLevelIntegration } from "@/app/actions/integrations/gohighlevel";

interface IntegrationConfig {
  name: string;
  category: string;
  description: string;
  status: "connected" | "disconnected" | "pending";
  fields: Array<{
    name: string;
    label: string;
    type: "text" | "password" | "url" | "email" | "select";
    required: boolean;
    placeholder?: string;
    options?: string[];
  }>;
  additionalSettings?: Array<{
    name: string;
    label: string;
    type: "switch" | "select" | "text";
    options?: string[];
  }>;
}

const integrationConfigs: Record<string, IntegrationConfig> = {
  // CRM
  "salesforce": {
    name: "Salesforce",
    category: "CRM",
    description: "Connect to Salesforce CRM to sync contacts, leads, and opportunities",
    status: "connected",
    fields: [
      { name: "apiKey", label: "API Key", type: "password", required: true },
      { name: "apiSecret", label: "API Secret", type: "password", required: true },
      { name: "instanceUrl", label: "Instance URL", type: "url", required: true, placeholder: "https://yourinstance.salesforce.com" },
    ],
  },
  "hubspot": {
    name: "HubSpot",
    category: "CRM",
    description: "Sync contacts and deals with HubSpot CRM",
    status: "disconnected",
    fields: [
      { name: "apiKey", label: "API Key", type: "password", required: true },
    ],
  },
  "gohighlevel": {
    name: "GoHighLevel",
    category: "CRM",
    description: "Connect to GoHighLevel for CRM and marketing automation",
    status: "pending",
    fields: [
      { name: "apiKey", label: "API Key", type: "password", required: true },
      { name: "locationId", label: "Location ID", type: "text", required: true },
    ],
  },
  
  // Email Marketing
  "mailchimp": {
    name: "Mailchimp",
    category: "Email Marketing",
    description: "Sync contacts and send campaigns via Mailchimp",
    status: "connected",
    fields: [
      { name: "apiKey", label: "API Key", type: "password", required: true },
      { name: "serverPrefix", label: "Server Prefix", type: "text", required: false, placeholder: "us1" },
    ],
  },
  "sendgrid": {
    name: "SendGrid",
    category: "Email Marketing",
    description: "Send transactional emails via SendGrid",
    status: "connected",
    fields: [
      { name: "apiKey", label: "API Key", type: "password", required: true },
    ],
  },
  
  // Telephony
  "twilio": {
    name: "Twilio",
    category: "Telephony",
    description: "Send SMS and make phone calls via Twilio",
    status: "connected",
    fields: [
      { name: "accountSid", label: "Account SID", type: "text", required: true },
      { name: "authToken", label: "Auth Token", type: "password", required: true },
      { name: "phoneNumber", label: "Phone Number", type: "text", required: false },
    ],
  },
  "telnyx": {
    name: "Telnyx",
    category: "Telephony",
    description:
      "Organization-level Telnyx credentials for AI Assistants and communications. Overrides the system default; use this for enterprise or dedicated Telnyx accounts.",
    status: "disconnected",
    fields: [
      { name: "apiKey", label: "API Key", type: "password", required: true },
      { name: "messagingProfileId", label: "Messaging Profile ID", type: "text", required: false },
    ],
  },
  
  // Payments
  "stripe": {
    name: "Stripe",
    category: "Payments",
    description: "Process payments and manage subscriptions",
    status: "connected",
    fields: [
      { name: "publishableKey", label: "Publishable Key", type: "text", required: true },
      { name: "secretKey", label: "Secret Key", type: "password", required: true },
      { name: "webhookSecret", label: "Webhook Secret", type: "password", required: false },
    ],
  },
  "paypal": {
    name: "PayPal",
    category: "Payments",
    description: "Accept PayPal payments",
    status: "disconnected",
    fields: [
      { name: "clientId", label: "Client ID", type: "text", required: true },
      { name: "clientSecret", label: "Client Secret", type: "password", required: true },
    ],
    additionalSettings: [
      { name: "mode", label: "Mode", type: "select" as const, options: ["sandbox", "live"] },
    ],
  },
  
  "square": {
    name: "Square",
    category: "Payments",
    description: "Payment processing and POS system",
    status: "disconnected",
    fields: [
      { name: "applicationId", label: "Application ID", type: "text", required: true },
      { name: "accessToken", label: "Access Token", type: "password", required: true },
      { name: "locationId", label: "Location ID", type: "text", required: false },
    ],
  },
  "braintree": {
    name: "Braintree",
    category: "Payments",
    description: "Payment processing gateway",
    status: "disconnected",
    fields: [
      { name: "merchantId", label: "Merchant ID", type: "text", required: true },
      { name: "publicKey", label: "Public Key", type: "text", required: true },
      { name: "privateKey", label: "Private Key", type: "password", required: true },
    ],
    additionalSettings: [
      { name: "environment", label: "Environment", type: "select" as const, options: ["sandbox", "production"] },
    ],
  },
  
  // Analytics
  "google-analytics": {
    name: "Google Analytics",
    category: "Analytics",
    description: "Track website and app analytics",
    status: "connected",
    fields: [
      { name: "trackingId", label: "Tracking ID", type: "text", required: true, placeholder: "UA-XXXXXXXXX-X" },
      { name: "measurementId", label: "Measurement ID", type: "text", required: false, placeholder: "G-XXXXXXXXXX" },
    ],
  },
  "mixpanel": {
    name: "Mixpanel",
    category: "Analytics",
    description: "Product analytics platform",
    status: "disconnected",
    fields: [
      { name: "projectToken", label: "Project Token", type: "text", required: true },
      { name: "apiSecret", label: "API Secret", type: "password", required: false },
    ],
  },
  "amplitude": {
    name: "Amplitude",
    category: "Analytics",
    description: "Product analytics and data",
    status: "disconnected",
    fields: [
      { name: "apiKey", label: "API Key", type: "text", required: true },
      { name: "secretKey", label: "Secret Key", type: "password", required: true },
    ],
  },
  
  // Accounting
  "quickbooks": {
    name: "QuickBooks",
    category: "Accounting",
    description: "Accounting software integration",
    status: "disconnected",
    fields: [
      { name: "clientId", label: "Client ID", type: "text", required: true },
      { name: "clientSecret", label: "Client Secret", type: "password", required: true },
      { name: "realmId", label: "Realm ID", type: "text", required: false },
    ],
  },
  "xero": {
    name: "Xero",
    category: "Accounting",
    description: "Cloud-based accounting software",
    status: "disconnected",
    fields: [
      { name: "clientId", label: "Client ID", type: "text", required: true },
      { name: "clientSecret", label: "Client Secret", type: "password", required: true },
    ],
  },
  "freshbooks": {
    name: "FreshBooks",
    category: "Accounting",
    description: "Cloud accounting software",
    status: "disconnected",
    fields: [
      { name: "clientId", label: "Client ID", type: "text", required: true },
      { name: "clientSecret", label: "Client Secret", type: "password", required: true },
    ],
  },
  
  // E-commerce
  "shopify": {
    name: "Shopify",
    category: "E-commerce",
    description: "E-commerce platform integration",
    status: "connected",
    fields: [
      { name: "shopDomain", label: "Shop Domain", type: "text", required: true, placeholder: "yourstore.myshopify.com" },
      { name: "apiKey", label: "API Key", type: "text", required: true },
      { name: "apiSecret", label: "API Secret", type: "password", required: true },
      { name: "accessToken", label: "Access Token", type: "password", required: true },
    ],
  },
  "woocommerce": {
    name: "WooCommerce",
    category: "E-commerce",
    description: "WordPress e-commerce plugin",
    status: "disconnected",
    fields: [
      { name: "storeUrl", label: "Store URL", type: "url", required: true, placeholder: "https://yourstore.com" },
      { name: "consumerKey", label: "Consumer Key", type: "text", required: true },
      { name: "consumerSecret", label: "Consumer Secret", type: "password", required: true },
    ],
  },
  "bigcommerce": {
    name: "BigCommerce",
    category: "E-commerce",
    description: "E-commerce platform",
    status: "disconnected",
    fields: [
      { name: "storeHash", label: "Store Hash", type: "text", required: true },
      { name: "clientId", label: "Client ID", type: "text", required: true },
      { name: "accessToken", label: "Access Token", type: "password", required: true },
    ],
  },
  
  // Social Media
  "facebook": {
    name: "Facebook",
    category: "Social Media",
    description: "Facebook Pages and Ads integration",
    status: "disconnected",
    fields: [
      { name: "appId", label: "App ID", type: "text", required: true },
      { name: "appSecret", label: "App Secret", type: "password", required: true },
      { name: "accessToken", label: "Access Token", type: "password", required: false },
    ],
  },
  "twitter": {
    name: "Twitter/X",
    category: "Social Media",
    description: "Twitter/X API integration",
    status: "disconnected",
    fields: [
      { name: "apiKey", label: "API Key", type: "text", required: true },
      { name: "apiSecret", label: "API Secret", type: "password", required: true },
      { name: "bearerToken", label: "Bearer Token", type: "password", required: false },
    ],
  },
  "linkedin": {
    name: "LinkedIn",
    category: "Social Media",
    description: "LinkedIn Pages and Ads integration",
    status: "disconnected",
    fields: [
      { name: "clientId", label: "Client ID", type: "text", required: true },
      { name: "clientSecret", label: "Client Secret", type: "password", required: true },
    ],
  },
  "instagram": {
    name: "Instagram",
    category: "Social Media",
    description: "Instagram Business API integration",
    status: "disconnected",
    fields: [
      { name: "appId", label: "App ID", type: "text", required: true },
      { name: "appSecret", label: "App Secret", type: "password", required: true },
      { name: "accessToken", label: "Access Token", type: "password", required: false },
    ],
  },
  
  // Customer Support
  "zendesk": {
    name: "Zendesk",
    category: "Customer Support",
    description: "Sync tickets and customer data with Zendesk",
    status: "connected",
    fields: [
      { name: "subdomain", label: "Subdomain", type: "text", required: true, placeholder: "yourcompany" },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "apiToken", label: "API Token", type: "password", required: true },
    ],
  },
  "intercom": {
    name: "Intercom",
    category: "Customer Support",
    description: "Customer messaging and support platform",
    status: "disconnected",
    fields: [
      { name: "appId", label: "App ID", type: "text", required: true },
      { name: "apiKey", label: "API Key", type: "password", required: true },
    ],
  },
  "freshdesk": {
    name: "Freshdesk",
    category: "Customer Support",
    description: "Customer support software",
    status: "disconnected",
    fields: [
      { name: "domain", label: "Domain", type: "text", required: true, placeholder: "yourcompany.freshdesk.com" },
      { name: "apiKey", label: "API Key", type: "password", required: true },
    ],
  },
  
  // Additional CRM
  "pipedrive": {
    name: "Pipedrive",
    category: "CRM",
    description: "Sales-focused CRM",
    status: "disconnected",
    fields: [
      { name: "apiToken", label: "API Token", type: "password", required: true },
      { name: "companyDomain", label: "Company Domain", type: "text", required: false },
    ],
  },
  
  // Additional Email Marketing
  "convertkit": {
    name: "ConvertKit",
    category: "Email Marketing",
    description: "Email marketing for creators",
    status: "disconnected",
    fields: [
      { name: "apiKey", label: "API Key", type: "password", required: true },
      { name: "apiSecret", label: "API Secret", type: "password", required: false },
    ],
  },
  "activecampaign": {
    name: "ActiveCampaign",
    category: "Email Marketing",
    description: "Marketing automation platform",
    status: "disconnected",
    fields: [
      { name: "apiUrl", label: "API URL", type: "url", required: true, placeholder: "https://yourcompany.api-us1.com" },
      { name: "apiKey", label: "API Key", type: "password", required: true },
    ],
  },
  
  // Additional Telephony
  "vonage": {
    name: "Vonage",
    category: "Telephony",
    description: "Cloud communications platform",
    status: "disconnected",
    fields: [
      { name: "apiKey", label: "API Key", type: "text", required: true },
      { name: "apiSecret", label: "API Secret", type: "password", required: true },
    ],
  },
};

export default function IntegrationDetailPage() {
  const params = useParams();
  const category = (params.category as string) || "";
  const integrationName = (params.integration as string)?.toLowerCase().replace(/\s+/g, "-");
  
  const config = integrationConfigs[integrationName] || {
    name: integrationName.charAt(0).toUpperCase() + integrationName.slice(1),
    category: category.charAt(0).toUpperCase() + category.slice(1).replace(/-/g, " "),
    description: "Configure this integration",
    status: "disconnected" as const,
    fields: [
      { name: "apiKey", label: "API Key", type: "password" as const, required: true },
    ],
  };

  const [formData, setFormData] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadConfig() {
      try {
        const existing = await fetchIntegrationConfig(integrationName);
        if (existing?.credentials && typeof existing.credentials === "object") {
          setFormData(existing.credentials as Record<string, string>);
        }
        if (existing?.status === "connected") {
          setIsConnected(true);
        }
      } catch {
        setError(null);
      } finally {
        setIsLoading(false);
      }
    }
    loadConfig();
  }, [integrationName]);

  const handleConnect = async () => {
    setError(null);
    setIsSaving(true);
    try {
      const credentials: Record<string, string> = {};
      config.fields.forEach((f) => {
        const val = formData[f.name];
        if (val) credentials[f.name] = val;
      });
      if (integrationName === "gohighlevel") {
        if (!credentials.apiKey || !credentials.locationId) {
          throw new Error("GoHighLevel API key and Location ID are required");
        }
        await connectGoHighLevelIntegration({
          credentials: {
            apiKey: credentials.apiKey,
            locationId: credentials.locationId,
          },
        });
      } else {
        await saveIntegrationConfig({
          provider: integrationName,
          category: config.category,
          credentials,
          status: "connected",
        });
      }
      setIsConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setError(null);
    setIsSaving(true);
    try {
      await saveIntegrationConfig({
        provider: integrationName,
        category: config.category,
        credentials: {},
        status: "disconnected",
      });
      setIsConnected(false);
      setFormData({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSecret = (fieldName: string) => {
    setShowSecrets({ ...showSecrets, [fieldName]: !showSecrets[fieldName] });
  };

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

  const StatusIcon = statusIcons[isConnected ? "connected" : "disconnected"];

  if (isLoading) {
    return (
      <div>
        <PageBreadcrumb pageTitle={`${config.name} Integration`} />
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageBreadcrumb pageTitle={`${config.name} Integration`} />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
              {config.name} Integration
            </h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">{config.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${
                statusColors[isConnected ? "connected" : "disconnected"]
              }`}
            >
              <StatusIcon className="h-4 w-4" />
              {isConnected ? "Connected" : "Disconnected"}
            </span>
            {isConnected ? (
              <Button variant="outline" onClick={handleDisconnect} disabled={isSaving}>
                {isSaving ? "Disconnecting…" : "Disconnect"}
              </Button>
            ) : (
              <Button onClick={handleConnect} disabled={isSaving}>
                {isSaving ? "Saving…" : "Connect"}
              </Button>
            )}
          </div>
        </div>

        {/* Connection Form */}
        {!isConnected && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Connection Settings
            </h2>
            <div className="space-y-4">
              {config.fields.map((field) => (
                <div key={field.name}>
                  <Label htmlFor={field.name}>
                    {field.label}
                    {field.required && <span className="text-red-500">*</span>}
                  </Label>
                  <div className="relative mt-2">
                    {field.type === "password" ? (
                      <>
                        <Input
                          id={field.name}
                          type={showSecrets[field.name] ? "text" : "password"}
                          value={formData[field.name] || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, [field.name]: e.target.value })
                          }
                          placeholder={field.placeholder}
                          required={field.required}
                        />
                        <button
                          type="button"
                          onClick={() => toggleSecret(field.name)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {showSecrets[field.name] ? (
                            <EyeSlashIcon className="h-5 w-5" />
                          ) : (
                            <EyeIcon className="h-5 w-5" />
                          )}
                        </button>
                      </>
                    ) : field.type === "select" ? (
                      <select
                        id={field.name}
                        value={formData[field.name] || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, [field.name]: e.target.value })
                        }
                        className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                        required={field.required}
                      >
                        <option value="">Select {field.label}</option>
                        {field.options?.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        id={field.name}
                        type={field.type}
                        value={formData[field.name] || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, [field.name]: e.target.value })
                        }
                        placeholder={field.placeholder}
                        required={field.required}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-3">
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
              <div className="flex gap-3">
                <Button variant="outline" disabled={isSaving}>Test Connection</Button>
                <Button onClick={handleConnect} disabled={isSaving}>
                  {isSaving ? "Saving…" : "Save & Connect"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Connected Settings */}
        {isConnected && (
          <div className="space-y-6">
            {/* API Key Management */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  API Credentials
                </h2>
                <Button variant="outline" size="sm">
                  <KeyIcon className="h-4 w-4" />
                  Regenerate Keys
                </Button>
              </div>
              <div className="space-y-3">
                {config.fields.map((field) => (
                  <div key={field.name} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{field.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                        {field.type === "password"
                          ? "••••••••••••"
                          : formData[field.name] || "Not set"}
                      </span>
                      {field.type === "password" && (
                        <button
                          onClick={() => toggleSecret(field.name)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {showSecrets[field.name] ? (
                            <EyeSlashIcon className="h-4 w-4" />
                          ) : (
                            <EyeIcon className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Additional Settings */}
            {config.additionalSettings && config.additionalSettings.length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                  Additional Settings
                </h2>
                <div className="space-y-4">
                  {config.additionalSettings.map((setting) => (
                    <div key={setting.name} className="flex items-center justify-between">
                      <div>
                        <Label htmlFor={setting.name}>{setting.label}</Label>
                      </div>
                      {setting.type === "switch" ? (
                        <Switch id={setting.name} defaultChecked />
                      ) : setting.type === "select" ? (
                        <select
                          id={setting.name}
                          className="h-9 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                        >
                          {setting.options?.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input id={setting.name} type="text" className="w-48" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sync Status */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                Sync Status
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Last Sync</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {new Date().toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Sync Status</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-500/15 dark:text-green-500">
                    <CheckIcon className="h-3 w-3" />
                    Active
                  </span>
                </div>
              </div>
              <div className="mt-4">
                <Button variant="outline" size="sm">
                  Sync Now
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

