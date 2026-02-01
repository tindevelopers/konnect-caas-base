"use client";
import React, { useEffect, useRef, useCallback, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import { useTenant } from "@/core/multi-tenancy";
import { useWhiteLabel } from "@/context/WhiteLabelContext";
import {
  AiIcon,
  BoxCubeIcon,
  CalenderIcon,
  CallIcon,
  CartIcon,
  ChatIcon,
  ChevronDownIcon,
  GridIcon,
  HorizontaLDots,
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
} from "../icons";
import SidebarWidget from "./SidebarWidget";

type NavItem = {
  name: string;
  icon?: React.ReactNode;
  path?: string;
  new?: boolean;
  pro?: boolean;
  subItems?: (NavItem | { name: string; path: string; pro?: boolean; new?: boolean })[];
};

const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    path: "/saas/dashboard",
  },
  {
    name: "CRM",
    icon: <UserCircleIcon />,
    new: true,
    subItems: [
      { name: "Contacts", path: "/crm/contacts" },
      { name: "Companies", path: "/crm/companies" },
      { name: "Deals", path: "/crm/deals" },
      { name: "Tasks", path: "/crm/tasks" },
    ],
  },
  {
    icon: <MailIcon />,
    name: "CRM Campaigns",
    new: true,
    subItems: [
      { name: "Campaigns", path: "/crm/campaigns" },
      { name: "Builder", path: "/crm/campaigns/builder" },
      { name: "Outreach", path: "/crm/campaigns/outreach" },
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
      {
        name: "Email & Notifications",
        subItems: [
          { name: "Templates", path: "/saas/email-notifications/templates" },
          { name: "Settings", path: "/saas/email-notifications/settings" },
          { name: "Logs", path: "/saas/email-notifications/logs" },
          { name: "Campaigns", path: "/saas/email-notifications/campaigns" },
        ],
      },
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
        name: "Support",
        subItems: [
          { name: "Tickets", path: "/saas/support/tickets" },
          { name: "Categories", path: "/saas/support/categories" },
          { name: "Knowledge Base", path: "/saas/support/knowledge-base" },
          { name: "Settings", path: "/saas/support/settings" },
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

const othersItems: NavItem[] = [
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

const supportItems: NavItem[] = [
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

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();
  const { tenant, isLoading: isTenantLoading } = useTenant();
  const { branding } = useWhiteLabel();
  
  const logoUrl = branding.logo || "/images/logo/logo.svg";
  const logoDarkUrl = branding.logo || "/images/logo/logo-dark.svg";
  const logoIconUrl = branding.favicon || "/images/logo/logo-icon.svg";

  const renderMenuItems = (
    navItems: NavItem[],
    menuType: "main" | "support" | "others"
  ) => (
    <ul className="flex flex-col gap-1">
      {navItems.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              aria-expanded={
                openSubmenu?.type === menuType && openSubmenu?.index === index
              }
              aria-controls={`submenu-${menuType}-${index}`}
              className={`menu-item group  ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-active"
                  : "menu-item-inactive"
              } cursor-pointer ${
                !isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
              }`}
            >
              <span
                className={` ${
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className={`menu-item-text`}>{nav.name}</span>
              )}
              {nav.new && (isExpanded || isHovered || isMobileOpen) && (
                <span
                  className={`ml-auto absolute right-10 ${
                    openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                      ? "menu-dropdown-badge-active"
                      : "menu-dropdown-badge-inactive"
                  } menu-dropdown-badge`}
                >
                  new
                </span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && nav.subItems && (
                <ChevronDownIcon
                  className={`ml-auto w-5 h-5 transition-transform duration-200  ${
                    openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                      ? "rotate-180 text-brand-500"
                      : ""
                  }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                href={nav.path}
                className={`menu-item group ${
                  isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                }`}
              >
                <span
                  className={`${
                    isActive(nav.path)
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className={`menu-item-text`}>{nav.name}</span>
                )}
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              id={`submenu-${menuType}-${index}`}
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              role="region"
              aria-labelledby={`menu-${menuType}-${index}`}
              style={{
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : "0px",
              }}
            >
              <ul className="mt-2 space-y-1 ml-9" role="menu">
                {nav.subItems.map((subItem, subIndex) => {
                  // Check if subItem is a nested menu (has subItems) or a regular link
                  const isNestedMenu = 'subItems' in subItem && subItem.subItems && !('path' in subItem);
                  const isNestedOpen = openSubmenu?.type === menuType && 
                    openSubmenu?.index === index && 
                    openSubmenu?.subIndex === subIndex;

                  if (isNestedMenu) {
                    return (
                      <li key={subItem.name} role="none">
                        <button
                          onClick={() => handleSubmenuToggle(index, menuType, subIndex)}
                          className="menu-dropdown-item w-full text-left flex items-center justify-between"
                        >
                          <span>{subItem.name}</span>
                          <ChevronDownIcon
                            className={`w-4 h-4 transition-transform duration-200 ${
                              isNestedOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                        {isNestedOpen && (
                          <ul className="mt-1 ml-4 space-y-1" role="menu">
                            {subItem.subItems?.map((nestedItem) => {
                              if ('path' in nestedItem && nestedItem.path) {
                                return (
                                  <li key={nestedItem.name} role="none">
                                    <Link
                                      href={nestedItem.path}
                                      role="menuitem"
                                      className={`menu-dropdown-item ${
                                        isActive(nestedItem.path)
                                          ? "menu-dropdown-item-active"
                                          : "menu-dropdown-item-inactive"
                                      }`}
                                    >
                                      {nestedItem.name}
                                    </Link>
                                  </li>
                                );
                              }
                              return null;
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  }

                  // Regular submenu item with path
                  if ('path' in subItem && subItem.path) {
                    return (
                      <li key={subItem.name} role="none">
                        <Link
                          href={subItem.path}
                          role="menuitem"
                          className={`menu-dropdown-item ${
                            isActive(subItem.path)
                              ? "menu-dropdown-item-active"
                              : "menu-dropdown-item-inactive"
                          }`}
                        >
                          {subItem.name}
                          <span className="flex items-center gap-1 ml-auto">
                            {subItem.new && (
                              <span
                                className={`ml-auto ${
                                  isActive(subItem.path)
                                    ? "menu-dropdown-badge-active"
                                    : "menu-dropdown-badge-inactive"
                                } menu-dropdown-badge `}
                              >
                                new
                              </span>
                            )}
                            {subItem.pro && (
                              <span
                                className={`ml-auto ${
                                  isActive(subItem.path)
                                    ? "menu-dropdown-badge-pro-active"
                                    : "menu-dropdown-badge-pro-inactive"
                                } menu-dropdown-badge-pro `}
                              >
                                pro
                              </span>
                            )}
                          </span>
                        </Link>
                      </li>
                    );
                  }

                  return null;
                })}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "support" | "others";
    index: number;
    subIndex?: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
    {}
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // const isActive = (path: string) => path === pathname;

  const isActive = useCallback((path: string) => path === pathname, [pathname]);

  useEffect(() => {
    // Check if the current path matches any submenu item (including nested)
    let submenuMatched = false;
    
    // Use a labeled loop to break out of nested loops
    outerLoop: for (const menuType of ["main", "support", "others"] as const) {
      const items =
        menuType === "main"
          ? navItems
          : menuType === "support"
          ? supportItems
          : othersItems;
      for (let index = 0; index < items.length; index++) {
        const nav = items[index];
        if (nav.subItems) {
          for (let subIndex = 0; subIndex < nav.subItems.length; subIndex++) {
            const subItem = nav.subItems[subIndex];
            // Check if subItem has nested subItems
            if ('subItems' in subItem && subItem.subItems) {
              for (const nestedItem of subItem.subItems) {
                if (nestedItem.path && isActive(nestedItem.path)) {
                  setOpenSubmenu({
                    type: menuType,
                    index,
                    subIndex,
                  });
                  submenuMatched = true;
                  break outerLoop; // Exit all loops once we find a match
                }
              }
            } else if (subItem.path && isActive(subItem.path)) {
              setOpenSubmenu({
                type: menuType,
                index,
              });
              submenuMatched = true;
              break outerLoop; // Exit all loops once we find a match
            }
          }
        }
      }
    }

    // If no submenu item matches, close the open submenu
    if (!submenuMatched) {
      setOpenSubmenu(null);
    }
  }, [pathname, isActive]);

  useEffect(() => {
    // Set the height of the submenu items when the submenu is opened
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      // Use requestAnimationFrame to ensure DOM is updated before calculating height
      requestAnimationFrame(() => {
        if (subMenuRefs.current[key]) {
          setSubMenuHeight((prevHeights) => ({
            ...prevHeights,
            [key]: subMenuRefs.current[key]?.scrollHeight || 0,
          }));
        }
      });
    } else {
      // Clear heights when submenu is closed
      setSubMenuHeight({});
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (
    index: number,
    menuType: "main" | "support" | "others",
    subIndex?: number
  ) => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index &&
        prevOpenSubmenu.subIndex === subIndex
      ) {
        return null;
      }
      return { type: menuType, index, subIndex };
    });
  };

  return (
    <aside
      className={`fixed  flex flex-col xl:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-full transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        xl:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-8 flex flex-col gap-3 ${
          !isExpanded && !isHovered ? "xl:items-center" : "items-start"
        }`}
      >
        <Link href="/">
          {isExpanded || isHovered || isMobileOpen ? (
            <>
              <Image
                className="dark:hidden"
                src={logoUrl}
                alt={branding.companyName || "Logo"}
                width={150}
                height={40}
              />
              <Image
                className="hidden dark:block"
                src={logoDarkUrl}
                alt={branding.companyName || "Logo"}
                width={150}
                height={40}
              />
            </>
          ) : (
            <Image
              src={logoIconUrl}
              alt={branding.companyName || "Logo"}
              width={32}
              height={32}
            />
          )}
        </Link>
        {/* Tenant Context Badge */}
        {(isExpanded || isHovered || isMobileOpen) && (
          <div className="w-full">
            {!isTenantLoading && tenant ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                  Workspace
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {tenant.name}
                </p>
              </div>
            ) : !isTenantLoading && !tenant ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-900/20">
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  Platform Admin
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>
      <div className="flex flex-col overflow-y-auto  duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-5 text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "xl:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Menu"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(navItems, "main")}
            </div>
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-5 text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "xl:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Support"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(supportItems, "support")}
            </div>
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-5 text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "xl:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Others"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(othersItems, "others")}
            </div>
          </div>
        </nav>
        {isExpanded || isHovered || isMobileOpen ? <SidebarWidget /> : null}
      </div>
    </aside>
  );
};

export default AppSidebar;
