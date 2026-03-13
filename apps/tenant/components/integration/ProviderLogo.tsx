"use client";

import React from "react";

const providerIconSlugMap: Record<string, string> = {
  abacus: "abacusai",
  activecampaign: "activecampaign",
  amplitude: "amplitude",
  anthropic: "anthropic",
  assemblyai: "assemblyai",
  "bigcommerce": "bigcommerce",
  braintree: "braintree",
  calcom: "caldotcom",
  calendly: "calendly",
  deepgram: "deepgram",
  "elevenlabs": "elevenlabs",
  facebook: "facebook",
  "facebook-pages": "facebook",
  freshbooks: "freshbooks",
  freshdesk: "freshdesk",
  "google-ads": "googleads",
  "google-analytics": "googleanalytics",
  "google-calendar": "googlecalendar",
  "google-gemini": "googlegemini",
  gohighlevel: "highlevel",
  hubspot: "hubspot",
  instagram: "instagram",
  intercom: "intercom",
  linkedin: "linkedin",
  make: "make",
  mailchimp: "mailchimp",
  "meta-ads": "meta",
  mixpanel: "mixpanel",
  nylas: "nylas",
  openai: "openai",
  paypal: "paypal",
  pipedrive: "pipedrive",
  quickbooks: "quickbooks",
  resend: "resend",
  resemble: "resembledotai",
  salesforce: "salesforce",
  sendgrid: "sendgrid",
  shopify: "shopify",
  square: "square",
  stripe: "stripe",
  telnyx: "telnyx",
  "tiktok-ads": "tiktok",
  trello: "trello",
  twilio: "twilio",
  vapi: "vapi",
  vonage: "vonage",
  wasabi: "wasabi",
  webhooks: "webhook",
  "whatsapp-business": "whatsapp",
  woocommerce: "woocommerce",
  xero: "xero",
  zapier: "zapier",
  zendesk: "zendesk",
};

function initialsFromName(name: string) {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export interface ProviderLogoProps {
  provider: string;
  displayName: string;
  className?: string;
}

export default function ProviderLogo({
  provider,
  displayName,
  className = "",
}: ProviderLogoProps) {
  const slug = providerIconSlugMap[provider];
  const fallback = initialsFromName(displayName) || "IN";
  const classes =
    className ||
    "flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200";

  if (!slug) {
    return <div className={classes}>{fallback}</div>;
  }

  return (
    <div className={classes} title={displayName}>
      <img
        src={`https://cdn.simpleicons.org/${slug}`}
        alt={`${displayName} logo`}
        className="h-5 w-5 object-contain"
        loading="lazy"
      />
    </div>
  );
}
