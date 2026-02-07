/**
 * Tenant Breadcrumbs Component
 * 
 * Shows tenant context in breadcrumb navigation
 */

"use client";

import { useTenant } from "@/core/multi-tenancy";
import { ChevronRightIcon, BuildingOffice2Icon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface TenantBreadcrumbsProps {
  items?: Array<{ label: string; href?: string }>;
  showTenant?: boolean;
}

export default function TenantBreadcrumbs({
  items = [],
  showTenant = true,
}: TenantBreadcrumbsProps) {
  const { tenant, isLoading } = useTenant();
  const pathname = usePathname();

  // Auto-generate breadcrumbs from pathname if not provided
  const breadcrumbs = items.length > 0 
    ? items 
    : (() => {
        const segments = pathname.split("/").filter(Boolean);
        const crumbs: Array<{ label: string; href?: string }> = [];
        
        let currentPath = "";
        segments.forEach((segment, index) => {
          currentPath += `/${segment}`;
          const isLast = index === segments.length - 1;
          crumbs.push({
            label: segment
              .split("-")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" "),
            href: isLast ? undefined : currentPath,
          });
        });
        
        return crumbs;
      })();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <nav className="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
      {showTenant && tenant && (
        <>
          <Link
            href="/saas/dashboard"
            className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <BuildingOffice2Icon className="h-4 w-4" />
            <span className="font-medium">{tenant.name}</span>
          </Link>
          {breadcrumbs.length > 0 && (
            <ChevronRightIcon className="h-4 w-4 text-gray-400" />
          )}
        </>
      )}

      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;
        
        return (
          <div key={index} className="flex items-center gap-2">
            {crumb.href && !isLast ? (
              <Link
                href={crumb.href}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="text-gray-900 dark:text-white font-medium">
                {crumb.label}
              </span>
            )}
            {!isLast && (
              <ChevronRightIcon className="h-4 w-4 text-gray-400" />
            )}
          </div>
        );
      })}
    </nav>
  );
}


