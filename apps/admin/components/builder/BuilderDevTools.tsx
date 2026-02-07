"use client";

import { useEffect } from "react";
import { BUILDER_API_KEY } from "@/lib/builder";

/**
 * Builder.io Dev Tools Component
 * Only loads in development mode
 */
export default function BuilderDevTools() {
  useEffect(() => {
    if (process.env.NODE_ENV === "development" && BUILDER_API_KEY) {
      // Dynamically import Builder.io dev tools only in development
      import("@builder.io/dev-tools/react")
        .then((module) => {
          // Dev tools are automatically initialized when imported
          console.log("Builder.io dev tools loaded");
        })
        .catch((error) => {
          console.warn("Failed to load Builder.io dev tools:", error);
        });
    }
  }, []);

  return null;
}
