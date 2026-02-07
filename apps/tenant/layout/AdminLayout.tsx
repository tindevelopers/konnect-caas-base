"use client";

import { useSidebar } from "@/context/SidebarContext";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";
import React from "react";
import { usePathname } from "next/navigation";

type AdminLayoutProps = {
  children: React.ReactNode;
  /**
   * Custom content padding classes. If not provided, uses default padding.
   * Set to empty string for full-width pages.
   */
  contentPadding?: string;
  /**
   * Routes that should have no padding (full-width)
   */
  fullWidthRoutes?: string[];
};

/**
 * Shared Admin Layout Component
 * 
 * This component provides the standard admin layout with sidebar, header, and backdrop.
 * Used by all admin routes to ensure consistent layout across the application.
 * 
 * @example
 * ```tsx
 * // In a layout.tsx file
 * import AdminLayout from "@/layout/AdminLayout";
 * 
 * export default function MyLayout({ children }) {
 *   return <AdminLayout>{children}</AdminLayout>;
 * }
 * ```
 */
export default function AdminLayout({
  children,
  contentPadding,
  fullWidthRoutes = ["/text-generator", "/code-generator", "/image-generator", "/video-generator"],
}: AdminLayoutProps) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const pathname = usePathname();

  // Determine content padding based on route
  const getContentPadding = () => {
    if (contentPadding !== undefined) {
      return contentPadding;
    }
    
    if (fullWidthRoutes.includes(pathname)) {
      return "";
    }
    
    return "p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6";
  };

  // Dynamic class for main content margin based on sidebar state
  const mainContentMargin = isMobileOpen
    ? "ml-0"
    : isExpanded || isHovered
    ? "xl:ml-[290px]"
    : "xl:ml-[90px]";

  return (
    <div className="min-h-screen xl:flex">
      {/* Sidebar and Backdrop */}
      <AppSidebar />
      <Backdrop />
      {/* Main Content Area */}
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${mainContentMargin}`}
      >
        {/* Header */}
        <AppHeader />
        {/* Page Content */}
        <div className={getContentPadding()}>{children}</div>
      </div>
    </div>
  );
}
