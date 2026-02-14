"use client";
import React, { useEffect, useMemo, useRef, useCallback, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import { useTenant } from "@/core/multi-tenancy";
import { useWhiteLabel } from "@/context/WhiteLabelContext";
import {
  ChevronDownIcon,
  HorizontaLDots,
} from "../icons";
import SidebarWidget from "./SidebarWidget";
import { getNavigationItems, type NavItem as ConfigNavItem } from "@/config/navigation";

type NavItem = ConfigNavItem;

const PLATFORM_ONLY_PREFIXES = [
  "/admin",
  "/multi-tenant",
  "/saas/admin/system-admin",
  "/saas/admin/entity/tenant-management",
  "/saas/subscriptions",
  "/saas/webhooks",
];

const isPlatformOnlyPath = (path?: string) =>
  !!path && PLATFORM_ONLY_PREFIXES.some((prefix) => path.startsWith(prefix));

const navigation = getNavigationItems();

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();
  const { tenant, isLoading: isTenantLoading } = useTenant();
  const { branding } = useWhiteLabel();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  
  const logoUrl = branding.logo || "/images/logo/logo.svg";
  const logoDarkUrl = branding.logo || "/images/logo/logo-dark.svg";
  const logoIconUrl = branding.favicon || "/images/logo/logo-icon.svg";

  useEffect(() => {
    let isMounted = true;
    const loadRole = async () => {
      try {
        const response = await fetch("/api/admin/check-platform-admin");
        if (!response.ok) {
          console.log("[AppSidebar] Platform Admin check failed:", response.status);
          if (isMounted) {
            setIsPlatformAdmin(false);
          }
          return;
        }
        const data = await response.json();
        console.log("[AppSidebar] Platform Admin check result:", data);
        if (isMounted) {
          setIsPlatformAdmin(Boolean(data?.isPlatformAdmin));
        }
      } catch (error) {
        console.error("[AppSidebar] Error checking Platform Admin:", error);
        if (isMounted) {
          setIsPlatformAdmin(false);
        }
      }
    };
    loadRole();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredNavItems = useMemo(() => {
    console.log("[AppSidebar] Filtering nav items, isPlatformAdmin:", isPlatformAdmin);
    const filterChildren = (items: NavItem[]): NavItem[] =>
      items
        .map((item) => {
          if (item.subItems) {
            if (!isPlatformAdmin && isPlatformOnlyPath(item.path)) {
              console.log("[AppSidebar] Filtering out nav item (not Platform Admin):", item.name, item.path);
              return null;
            }
            const filtered = filterChildren(item.subItems ?? []);
            if (!item.path && filtered.length === 0) {
              return null;
            }
            return { ...item, subItems: filtered };
          }

          if (!isPlatformAdmin && isPlatformOnlyPath(item.path)) {
            console.log("[AppSidebar] Filtering out leaf item (not Platform Admin):", item.name, item.path);
            return null;
          }
          return item;
        })
        .filter(Boolean) as NavItem[];

    const filterRoot = (items: NavItem[]) =>
      items
        .map((item) => {
          if (!isPlatformAdmin && isPlatformOnlyPath(item.path)) {
            return null;
          }
          if (!item.subItems) {
            return item;
          }
          const filtered = filterChildren(item.subItems);
          if (!item.path && filtered.length === 0) {
            return null;
          }
          return { ...item, subItems: filtered };
        })
        .filter(Boolean) as NavItem[];

    return {
      main: filterRoot(navigation.main),
      support: filterRoot(navigation.support),
      others: filterRoot(navigation.others),
    };
  }, [isPlatformAdmin]);

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
                  const isNestedMenu = Boolean(subItem.subItems && !subItem.path);
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
                              if (nestedItem.path) {
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
                  if (subItem.path) {
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
      const items = filteredNavItems[menuType];
      for (let index = 0; index < items.length; index++) {
        const nav = items[index];
        if (nav.subItems) {
          for (let subIndex = 0; subIndex < nav.subItems.length; subIndex++) {
            const subItem = nav.subItems[subIndex];
            // Check if subItem has nested subItems
            if (subItem.subItems && !subItem.path) {
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
  }, [pathname, isActive, filteredNavItems]);

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
              {renderMenuItems(filteredNavItems.main, "main")}
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
              {renderMenuItems(filteredNavItems.support, "support")}
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
              {renderMenuItems(filteredNavItems.others, "others")}
            </div>
          </div>
        </nav>
        {isExpanded || isHovered || isMobileOpen ? <SidebarWidget /> : null}
      </div>
    </aside>
  );
};

export default AppSidebar;
