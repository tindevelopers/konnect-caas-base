"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

interface AbacusChatbotEmbedProps {
  appId: string;
  /** Height of the embedded chatbot container */
  height?: number;
  /** Whether to hide the top bar in the chatbot */
  hideTopBar?: boolean;
  /** Optional class name for the outer wrapper */
  className?: string;
}

const ABACUS_SDK_BASE =
  "https://api.abacus.ai/api/v0/getChatBotWidgetSDKLink";
const ABACUS_CHAT_BASE = "https://apps.abacus.ai/chatllm/";

/**
 * Embeds an Abacus.AI chatbot using the SDK script approach.
 *
 * Loads the chatbot SDK dynamically, scoped to a container. The SDK creates
 * the chat UI inside the page. Falls back to rendering a sandboxed object
 * embed if the SDK fails.
 */
export default function AbacusChatbotEmbed({
  appId,
  height = 600,
  hideTopBar = true,
  className,
}: AbacusChatbotEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  const sdkUrl = `${ABACUS_SDK_BASE}?externalApplicationId=${encodeURIComponent(appId)}`;
  const chatUrl = `${ABACUS_CHAT_BASE}?appId=${encodeURIComponent(appId)}${hideTopBar ? "&hideTopBar=2" : ""}`;

  const loadSdk = useCallback(() => {
    if (scriptRef.current) return;

    const existing = document.querySelector(
      `script[src*="externalApplicationId=${appId}"]`
    );
    if (existing) {
      setSdkLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = sdkUrl;
    script.async = true;
    script.onload = () => {
      setSdkLoaded(true);
      setSdkError(null);
    };
    script.onerror = () => {
      setSdkError("Failed to load Abacus chatbot SDK. Using fallback.");
      setUseFallback(true);
    };
    scriptRef.current = script;
    document.head.appendChild(script);
  }, [appId, sdkUrl]);

  useEffect(() => {
    loadSdk();

    return () => {
      if (scriptRef.current?.parentNode) {
        scriptRef.current.remove();
        scriptRef.current = null;
      }
    };
  }, [loadSdk]);

  useEffect(() => {
    if (!sdkLoaded) return;
    const timer = setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;
      const hasWidget =
        container.querySelector("[class*='abacus']") ||
        document.querySelector("[class*='abacus-chat']") ||
        document.querySelector("[id*='abacus']") ||
        document.querySelector("[class*='chatbot-widget']");
      if (!hasWidget) {
        setUseFallback(true);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [sdkLoaded]);

  return (
    <div
      className={`relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 ${className ?? ""}`}
      style={{ height }}
    >
      <div
        ref={containerRef}
        className="absolute inset-0 z-10"
        style={{ display: useFallback ? "none" : "block" }}
      />

      {!sdkLoaded && !sdkError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-50/80 dark:bg-gray-900/80">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Loading Abacus chatbot...
            </p>
          </div>
        </div>
      )}

      {sdkError && !useFallback && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 text-center">
            <p>{sdkError}</p>
            <button
              type="button"
              onClick={() => setUseFallback(true)}
              className="mt-2 text-xs underline hover:no-underline"
            >
              Use embedded view instead
            </button>
          </div>
        </div>
      )}

      {useFallback && (
        <object
          data={chatUrl}
          type="text/html"
          className="absolute inset-0 w-full h-full border-0"
          aria-label="Abacus AI Chatbot"
        >
          <p className="p-4 text-sm text-gray-500">
            Your browser does not support embedded content.{" "}
            <a
              href={chatUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              Open chatbot in new tab
            </a>
          </p>
        </object>
      )}
    </div>
  );
}
