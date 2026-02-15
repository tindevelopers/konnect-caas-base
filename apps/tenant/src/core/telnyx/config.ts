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
   * Webhook public key for ED25519 verification (API v2 signing).
   * Set via TELNYX_PUBLIC_KEY environment variable.
   * Find this in Telnyx Mission Control → API Keys → Public Key
   */
  publicKey: process.env.TELNYX_PUBLIC_KEY || "",

  /**
   * Check if Telnyx webhook verification is configured
   */
  isConfigured(): boolean {
    return Boolean(this.webhookSecret && this.webhookSecret.trim().length > 0);
  },

  /**
   * Check if ED25519 (Voice API v2) verification is configured.
   */
  isEd25519Configured(): boolean {
    return Boolean(this.publicKey && this.publicKey.trim().length > 0);
  },
};
