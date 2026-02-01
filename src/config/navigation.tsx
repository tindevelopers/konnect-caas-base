/**
 * Centralized Navigation Configuration
 * 
 * This file contains all navigation items for the application sidebar.
 * Navigation items can be filtered by permissions/roles in the future.
 * 
 * Note: Icons are provided as React components and will be rendered in AppSidebar.
 */

import React from "react";
import {
  AiIcon,
  BoxCubeIcon,
  CalenderIcon,
  CallIcon,
  CartIcon,
  ChatIcon,
  GridIcon,
  ListIcon,
  LockIcon,
  MailIcon,
  PageIcon,
  PieChartIcon,
  PlugInIcon,
  ShootingStarIcon,
  TableIcon,
  TaskIcon,
  UserCircleIcon,
} from "@/icons";

export type NavItem = {
  name: string;
  icon?: React.ReactNode;
  path?: string;
  new?: boolean;
  pro?: boolean;
  subItems?: NavItem[];
  // Future: Add permission/role requirements
  // requiredRole?: string[];
  // requiredPermission?: string[];
};

/**
 * Main navigation items (top section)
 */
export const mainNavItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    path: "/saas/dashboard",
  },
  {
    name: "Agents",
    icon: <AiIcon />,
    new: true,
    subItems: [
      { name: "Voice Agents", path: "/saas/agents/voice" },
      { name: "Chat Agents", path: "/saas/agents/chat" },
    ],
  },
  {
    name: "AI Assistant",
    icon: <AiIcon />,
    new: true,
    subItems: [
      {
        name: "Text Generator",
        path: "/text-generator",
      },
      {
        name: "Image Generator",
        path: "/image-generator",
      },
      {
        name: "Code Generator",
        path: "/code-generator",
      },
      {
        name: "Video Generator",
        path: "/video-generator",
      },
    ],
  },
  {
    name: "E-commerce",
    icon: <CartIcon />,
    new: true,
    subItems: [
      { name: "Products", path: "/products-list" },
      { name: "Add Product", path: "/add-product" },
      { name: "Billing", path: "/billing" },
      { name: "Invoices", path: "/invoices" },
      { name: "Single Invoice", path: "/single-invoice" },
      { name: "Create Invoice", path: "/create-invoice" },
      { name: "Transactions", path: "/transactions" },
      { name: "Single Transaction", path: "/single-transaction" },
    ],
  },
  {
    name: "Billing & Plans",
    icon: <CartIcon />,
    subItems: [
      { name: "Billing Dashboard", path: "/saas/billing/dashboard" },
      { name: "Cancel Subscription", path: "/saas/billing/cancel-subscription" },
      { name: "Upgrade to Pro", path: "/saas/billing/upgrade-to-pro" },
      { name: "Update Billing Address", path: "/saas/billing/update-billing-address" },
      { name: "Add New Card", path: "/saas/billing/add-new-card" },
      {
        name: "Invoicing",
        subItems: [
          { name: "Invoices", path: "/saas/invoicing/invoices" },
          { name: "Payment History", path: "/saas/invoicing/payment-history" },
          { name: "Failed Payments", path: "/saas/invoicing/failed-payments" },
          { name: "Refunds", path: "/saas/invoicing/refunds" },
          { name: "Tax Settings", path: "/saas/invoicing/tax-settings" },
        ],
      },
    ],
  },
  {
    name: "Admin",
    icon: <UserCircleIcon />,
    subItems: [
      { name: "User Management", path: "/saas/admin/entity/user-management" },
      { name: "Tenant Management", path: "/saas/admin/entity/tenant-management" },
      { name: "Organization Management", path: "/saas/admin/entity/organization-management" },
      { name: "Role Management", path: "/saas/admin/entity/role-management" },
    ],
  },
  {
    name: "System Admin",
    icon: <LockIcon />,
    subItems: [
      { name: "Organization Admins", path: "/saas/admin/system-admin/organization-admins" },
      { name: "API Configuration", path: "/saas/admin/system-admin/api-configuration" },
      { name: "Multi-Tenant", path: "/multi-tenant", new: true },
      {
        name: "Subscriptions",
        subItems: [
          { name: "Plans", path: "/saas/subscriptions/plans" },
          { name: "Features", path: "/saas/subscriptions/features" },
          { name: "Usage Limits", path: "/saas/subscriptions/usage-limits" },
          { name: "History", path: "/saas/subscriptions/history" },
          { name: "Migration", path: "/saas/subscriptions/migration" },
        ],
      },
      {
        name: "Webhooks",
        subItems: [
          { name: "Management", path: "/saas/webhooks/management" },
          { name: "Events", path: "/saas/webhooks/events" },
          { name: "Logs", path: "/saas/webhooks/logs" },
          { name: "Testing", path: "/saas/webhooks/testing" },
        ],
      },
      {
        name: "White-Label",
        subItems: [
          { name: "Branding", path: "/saas/white-label/branding" },
          { name: "Domain Settings", path: "/saas/white-label/domain-settings" },
          { name: "Email Customization", path: "/saas/white-label/email-customization" },
          { name: "Theme Settings", path: "/saas/white-label/theme-settings" },
          { name: "Custom CSS", path: "/saas/white-label/custom-css" },
        ],
      },
    ],
  },
  {
    name: "SaaS",
    icon: <ShootingStarIcon />,
    new: true,
    subItems: [
      { name: "Dashboard", path: "/saas/dashboard" },
      {
        name: "Usage & Metering",
        subItems: [
          { name: "Dashboard", path: "/saas/usage-metering/dashboard" },
          { name: "Metered Billing", path: "/saas/usage-metering/metered-billing" },
          { name: "Reports", path: "/saas/usage-metering/reports" },
          { name: "Alerts", path: "/saas/usage-metering/alerts" },
          { name: "Rate Limits", path: "/saas/usage-metering/rate-limits" },
        ],
      },
      {
        name: "Security",
        subItems: [
          { name: "Settings", path: "/saas/security/settings" },
          { name: "SSO Configuration", path: "/saas/security/sso-configuration" },
          { name: "Session Management", path: "/saas/security/session-management" },
          { name: "IP Restrictions", path: "/saas/security/ip-restrictions" },
          { name: "Audit Logs", path: "/saas/security/audit-logs" },
          { name: "Compliance", path: "/saas/security/compliance" },
        ],
      },
      {
        name: "Email & Notifications",
        subItems: [
          { name: "Templates", path: "/saas/email-notifications/templates" },
          { name: "Settings", path: "/saas/email-notifications/settings" },
          { name: "Logs", path: "/saas/email-notifications/logs" },
          { name: "Campaigns", path: "/saas/email-notifications/campaigns" },
        ],
      },
      {
        name: "Feature Flags",
        subItems: [
          { name: "Flags", path: "/saas/feature-flags/flags" },
          { name: "Environments", path: "/saas/feature-flags/environments" },
          { name: "Targeting", path: "/saas/feature-flags/targeting" },
          { name: "History", path: "/saas/feature-flags/history" },
        ],
      },
      {
        name: "Analytics",
        subItems: [
          { name: "Dashboard", path: "/saas/analytics/dashboard" },
          { name: "Custom Reports", path: "/saas/analytics/custom-reports" },
          { name: "Events", path: "/saas/analytics/events" },
          { name: "Exports", path: "/saas/analytics/exports" },
        ],
      },
      {
        name: "Integrations",
        subItems: [
          { name: "All Integrations", path: "/saas/integrations/list" },
          { name: "CRM", path: "/saas/integrations/crm" },
          { name: "Email Marketing", path: "/saas/integrations/email-marketing" },
          { name: "Telephony", path: "/saas/integrations/telephony" },
          { name: "Payments", path: "/saas/integrations/payments" },
          { name: "Analytics", path: "/saas/integrations/analytics" },
          { name: "Accounting", path: "/saas/integrations/accounting" },
          { name: "E-commerce", path: "/saas/integrations/ecommerce" },
          { name: "Social Media", path: "/saas/integrations/social-media" },
          { name: "Customer Support", path: "/saas/integrations/customer-support" },
          { name: "API Connections", path: "/saas/integrations/api-connections" },
          { name: "OAuth Apps", path: "/saas/integrations/oauth-apps" },
          { name: "Settings", path: "/saas/integrations/settings" },
        ],
      },
      {
        name: "Data Management",
        subItems: [
          { name: "Export Jobs", path: "/saas/data-management/export-jobs" },
          { name: "Import Templates", path: "/saas/data-management/import-templates" },
          { name: "Data Mapping", path: "/saas/data-management/data-mapping" },
          { name: "History", path: "/saas/data-management/history" },
        ],
      },
      {
        name: "Custom Report Builder",
        subItems: [
          { name: "Builder", path: "/saas/custom-report-builder/builder" },
          { name: "Saved Reports", path: "/saas/custom-report-builder/saved-reports" },
          { name: "Templates", path: "/saas/custom-report-builder/templates" },
          { name: "Data Sources", path: "/saas/custom-report-builder/data-sources" },
          { name: "Sharing", path: "/saas/custom-report-builder/sharing" },
        ],
      },
    ],
  },
  {
    icon: <CalenderIcon />,
    name: "Calendar",
    path: "/calendar",
  },
  {
    icon: <UserCircleIcon />,
    name: "User Profile",
    subItems: [
      { name: "Edit Profile", path: "/profile?tab=profile" },
      { name: "Account Settings", path: "/profile?tab=account" },
      { name: "Change Password", path: "/profile?tab=password" },
    ],
  },
  {
    name: "Task",
    icon: <TaskIcon />,
    subItems: [
      { name: "List", path: "/task-list", pro: false },
      { name: "Kanban", path: "/task-kanban", pro: false },
    ],
  },
  {
    name: "Forms",
    icon: <ListIcon />,
    subItems: [
      { name: "Form Elements", path: "/form-elements", pro: false },
      { name: "Form Layout", path: "/form-layout", pro: false },
    ],
  },
  {
    name: "Tables",
    icon: <TableIcon />,
    subItems: [
      { name: "Basic Tables", path: "/basic-tables", pro: false },
      { name: "Data Tables", path: "/data-tables", pro: false },
    ],
  },
  {
    name: "Pages",
    icon: <PageIcon />,
    subItems: [
      { name: "File Manager", path: "/file-manager" },
      { name: "Pricing Tables", path: "/pricing-tables" },
      { name: "FAQ", path: "/faq" },
      { name: "API Keys", path: "/api-keys", new: true },
      { name: "Integrations", path: "/integrations", new: true },
      { name: "Blank Page", path: "/blank" },
      { name: "404 Error", path: "/error-404" },
      { name: "500 Error", path: "/error-500" },
      { name: "503 Error", path: "/error-503" },
      { name: "Coming Soon", path: "/coming-soon" },
      { name: "Maintenance", path: "/maintenance" },
      { name: "Success", path: "/success" },
    ],
  },
];

/**
 * Support navigation items (middle section)
 */
export const supportNavItems: NavItem[] = [
  {
    icon: <ChatIcon />,
    name: "Chat",
    path: "/chat",
  },
  {
    icon: <CallIcon />,
    name: "Support",
    new: true,
    subItems: [
      { name: "Support List", path: "/support-tickets" },
      { name: "Support Reply", path: "/support-ticket-reply" },
      { name: "Tickets", path: "/saas/support/tickets" },
      { name: "Categories", path: "/saas/support/categories" },
      { name: "Knowledge Base", path: "/saas/support/knowledge-base" },
      { name: "Settings", path: "/saas/support/settings" },
    ],
  },
  {
    icon: <MailIcon />,
    name: "Email",
    subItems: [
      { name: "Inbox", path: "/inbox" },
      { name: "Details", path: "/inbox-details" },
    ],
  },
];

/**
 * Others navigation items (bottom section)
 */
export const othersNavItems: NavItem[] = [
  {
    icon: <PieChartIcon />,
    name: "Charts",
    subItems: [
      { name: "Line Chart", path: "/line-chart", pro: false },
      { name: "Bar Chart", path: "/bar-chart", pro: false },
      { name: "Pie Chart", path: "/pie-chart", pro: false },
    ],
  },
  {
    icon: <BoxCubeIcon />,
    name: "UI Elements",
    subItems: [
      { name: "Alerts", path: "/alerts" },
      { name: "Avatar", path: "/avatars" },
      { name: "Badge", path: "/badge" },
      { name: "Breadcrumb", path: "/breadcrumb" },
      { name: "Buttons", path: "/buttons" },
      { name: "Buttons Group", path: "/buttons-group" },
      { name: "Cards", path: "/cards" },
      { name: "Carousel", path: "/carousel" },
      { name: "Dropdowns", path: "/dropdowns" },
      { name: "Images", path: "/images" },
      { name: "Links", path: "/links" },
      { name: "List", path: "/list" },
      { name: "Modals", path: "/modals" },
      { name: "Notification", path: "/notifications" },
      { name: "Pagination", path: "/pagination" },
      { name: "Popovers", path: "/popovers" },
      { name: "Progressbar", path: "/progress-bar" },
      { name: "Ribbons", path: "/ribbons" },
      { name: "Spinners", path: "/spinners" },
      { name: "Tabs", path: "/tabs" },
      { name: "Tooltips", path: "/tooltips" },
      { name: "Videos", path: "/videos" },
    ],
  },
  {
    icon: <PlugInIcon />,
    name: "Authentication",
    subItems: [
      { name: "Sign In", path: "/signin", pro: false },
      { name: "Sign Up", path: "/signup", pro: false },
      { name: "Reset Password", path: "/reset-password" },
      {
        name: "Two Step Verification",
        path: "/two-step-verification",
      },
    ],
  },
];

/**
 * Get all navigation items grouped by section
 */
export function getNavigationItems() {
  return {
    main: mainNavItems,
    support: supportNavItems,
    others: othersNavItems,
  };
}

/**
 * Find navigation item by path (useful for breadcrumbs, active state, etc.)
 */
export function findNavItemByPath(
  path: string,
  items: NavItem[] = [...mainNavItems, ...supportNavItems, ...othersNavItems]
): NavItem | null {
  for (const item of items) {
    if (item.path === path) {
      return item;
    }
    if (item.subItems) {
      const found = findNavItemByPath(path, item.subItems);
      if (found) return found;
    }
  }
  return null;
}
