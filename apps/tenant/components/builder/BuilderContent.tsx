"use client";

import { builder, BuilderComponent } from "@builder.io/react";
import { useEffect, useState } from "react";
import { BUILDER_API_KEY } from "@/lib/builder";

interface BuilderContentProps {
  model?: string;
  content?: any;
  options?: {
    userAttributes?: Record<string, any>;
    preview?: boolean;
    [key: string]: any;
  };
}

export default function BuilderContent({
  model = "page",
  content,
  options = {},
}: BuilderContentProps) {
  const [builderContent, setBuilderContent] = useState(content);
  const [isLoading, setIsLoading] = useState(!content);

  useEffect(() => {
    if (!BUILDER_API_KEY) {
      console.warn("NEXT_PUBLIC_BUILDER_API_KEY is not set");
      setIsLoading(false);
      return;
    }

    // Initialize Builder.io
    builder.init(BUILDER_API_KEY);

    // Only fetch if content wasn't provided (client-side fetch)
    if (!content) {
      setIsLoading(true);
      builder
        .get(model, {
          ...options,
          prerender: false,
        })
        .promise()
        .then((data) => {
          setBuilderContent(data);
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("Error loading Builder.io content:", error);
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [model, content, options]);

  if (!BUILDER_API_KEY) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
        <p className="text-sm text-yellow-800 dark:text-yellow-400">
          Builder.io API key not configured. Please set NEXT_PUBLIC_BUILDER_API_KEY in your
          environment variables.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-gray-500 dark:text-gray-400">Loading Builder.io content...</div>
      </div>
    );
  }

  if (!builderContent) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-800 dark:bg-gray-900">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No Builder.io content found for this page.
        </p>
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
          Create content in Builder.io and publish it to see it here.
        </p>
      </div>
    );
  }

  return (
    <BuilderComponent
      model={model}
      content={builderContent}
      options={options}
    />
  );
}
