import { useSidebar } from "@/context/SidebarContext";
import React from "react";

const Backdrop: React.FC = () => {
  const { isInitialized, isMobile, isMobileOpen, toggleMobileSidebar } = useSidebar();

  // Never show backdrop until layout has initialized (resize ran) and only on mobile when sidebar is open.
  // This prevents the grey overlay from flashing on login or when browser modals (e.g. Chrome password warning) appear.
  if (!isInitialized || !isMobile || !isMobileOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-gray-900/50 xl:hidden"
      onClick={toggleMobileSidebar}
      aria-hidden="true"
    />
  );
};

export default Backdrop;
