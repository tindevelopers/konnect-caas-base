/**
 * Builder.io configuration and utilities
 */

export const BUILDER_API_KEY = process.env.NEXT_PUBLIC_BUILDER_API_KEY || "";

export const builderConfig = {
  apiKey: BUILDER_API_KEY,
  // Enable preview mode in development
  preview: process.env.NODE_ENV === "development",
};
