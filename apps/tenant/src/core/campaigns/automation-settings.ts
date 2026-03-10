export type CampaignAutomationSettings = {
  enableProductPurchaseFlow?: boolean;
  webhookUrl?: string;
};

/** Read automation settings from campaign.settings with safe defaults (backward compatible). */
export function getCampaignAutomationSettings(
  settings: Record<string, unknown> | undefined
): CampaignAutomationSettings {
  if (!settings || typeof settings !== "object") {
    return { enableProductPurchaseFlow: false, webhookUrl: "" };
  }
  const webhookUrl =
    typeof settings.webhookUrl === "string"
      ? settings.webhookUrl.trim()
      : typeof settings.railwayWebhookUrl === "string"
        ? settings.railwayWebhookUrl.trim()
        : "";
  return {
    enableProductPurchaseFlow: settings.enableProductPurchaseFlow === true,
    webhookUrl,
  };
}

