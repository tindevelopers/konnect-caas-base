"use client";

import { useEffect } from "react";
import { BUILDER_API_KEY } from "@/lib/builder";

/**
 * Builder.io Dev Tools Component
 * Only loads in development mode
 * Note: Dev tools may not work in all environments due to Node.js dependencies
 */
export default function BuilderDevTools() {
  useEffect(() => {
    // Only try to load dev tools in browser environment
    if (
      typeof window !== "undefined" &&
      process.env.NODE_ENV === "development" &&
      BUILDER_API_KEY
    ) {
      // Use a try-catch with dynamic import to handle any module resolution errors
      const loadDevTools = async () => {
        try {
          // Try to load dev tools - this may fail if server-side dependencies are required
          await import("@builder.io/dev-tools/next");
          console.log("Builder.io dev tools loaded");
        } catch (error: any) {
          // Silently fail - dev tools are optional
          if (error?.message?.includes("async_hooks") || error?.message?.includes("Cannot find module")) {
            // Expected error in browser environment - dev tools require Node.js
            console.debug("Builder.io dev tools not available in browser environment");
          } else {
            console.warn("Failed to load Builder.io dev tools:", error);
          }
        }
      };
      
      loadDevTools();
    }
  }, []);

  return null;
}
