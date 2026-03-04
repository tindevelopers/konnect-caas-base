/**
 * Email Core - Public API
 * 
 * This is the ONLY file that application code should import from.
 * All implementation details are hidden.
 * 
 * Usage:
 *   import { sendEmail, sendTemplateEmail } from '@/core/email';
 */

// Main email service functions
export {
  sendEmail,
  sendBulkEmails,
  sendTemplateEmail,
  checkEmailHealth,
} from './email-service';

// Types that applications need
export type {
  SendEmailParams,
  SendEmailResult,
  EmailAttachment,
  EmailError,
  EmailTemplateProps,
} from './email-interface';

// Configuration utilities (for advanced use cases)
export {
  getProviderConfigFromEnv,
  getFallbackProviderConfig,
} from './config/provider-config';

// Common templates
export { default as ProductLinksEmail } from "./templates/product-links/product-links-email";
export type {
  ProductLinksEmailProps,
  ProductLinkItem,
} from "./templates/product-links/product-links-email";

/**
 * Example Usage:
 * 
 * // Simple email
 * import { sendEmail } from '@/core/email';
 * 
 * await sendEmail({
 *   to: 'user@example.com',
 *   from: 'noreply@yoursaas.com',
 *   subject: 'Welcome!',
 *   html: '<h1>Welcome to our platform</h1>',
 * });
 * 
 * // Template email
 * import { sendTemplateEmail } from '@/core/email';
 * import WelcomeEmail from '@/core/email/templates/auth/welcome';
 * 
 * await sendTemplateEmail(
 *   {
 *     to: 'user@example.com',
 *     from: 'noreply@yoursaas.com',
 *     subject: 'Welcome!',
 *   },
 *   WelcomeEmail,
 *   {
 *     userName: 'John Doe',
 *     tenantName: 'Acme Corp',
 *   }
 * );
 * 
 * // With white-label
 * await sendEmail({
 *   to: 'user@example.com',
 *   from: 'noreply@yoursaas.com',
 *   subject: 'Welcome!',
 *   html: '<h1>Welcome</h1>',
 *   tenantId: 'tenant-uuid',
 *   customDomain: 'tenant-domain.com',
 * });
 */




