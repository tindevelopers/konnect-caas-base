/**
 * Telnyx webhook configuration
 * Stores webhook signing secret for signature verification
 */

export const telnyxWebhookConfig = {
  /**
   * Webhook signing secret from Telnyx Messaging Profile
   * Set via TELNYX_WEBHOOK_SECRET environment variable
   * Find this in Telnyx Mission Control → Messaging → Messaging Profiles → [Your Profile] → Webhook Settings
   */
  webhookSecret: process.env.TELNYX_WEBHOOK_SECRET || "",

  /**
   * Check if Telnyx webhook verification is configured
   */
  isConfigured(): boolean {
    return Boolean(this.webhookSecret && this.webhookSecret.trim().length > 0);
  },
};
