"use client";

import React, { useCallback, useEffect, useState } from "react";
import AbacusChatbotEmbed from "@/components/ai/AbacusChatbotEmbed";

const DEFAULT_APP_ID = "d7dea936a";

const PRESETS: Array<{ label: string; appId: string }> = [
  { label: "Ask PSD (Pet Store)", appId: "d7dea936a" },
];

export default function ChatbotEmbedPage() {
  const [appId, setAppId] = useState(DEFAULT_APP_ID);
  const [inputAppId, setInputAppId] = useState(DEFAULT_APP_ID);
  const [embedHeight, setEmbedHeight] = useState(620);
  const [hideTopBar, setHideTopBar] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [embedMode, setEmbedMode] = useState<"sdk" | "object">("sdk");

  const chatUrl = `https://apps.abacus.ai/chatllm/?appId=${encodeURIComponent(appId)}${hideTopBar ? "&hideTopBar=2" : ""}`;
  const sdkScript = `<script src="https://api.abacus.ai/api/v0/getChatBotWidgetSDKLink?externalApplicationId=${appId}"></script>`;

  const handleApply = useCallback(() => {
    const trimmed = inputAppId.trim();
    if (trimmed) setAppId(trimmed);
  }, [inputAppId]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Chatbot Embed
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Preview and test Abacus.AI chatbots embedded directly in the platform.
          Uses the Abacus widget SDK — no iframe needed.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              App ID:
            </span>
            <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {appId}
            </span>
            {PRESETS.find((p) => p.appId === appId) && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                {PRESETS.find((p) => p.appId === appId)!.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
              <button
                type="button"
                onClick={() => setEmbedMode("sdk")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  embedMode === "sdk"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
                }`}
              >
                SDK Widget
              </button>
              <button
                type="button"
                onClick={() => setEmbedMode("object")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  embedMode === "object"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
                }`}
              >
                Direct Embed
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowConfig((v) => !v)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              {showConfig ? "Hide Config" : "Configure"}
            </button>
          </div>
        </div>

        {showConfig && (
          <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-400">
                  Application ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputAppId}
                    onChange={(e) => setInputAppId(e.target.value)}
                    placeholder="e.g. 171da6b0d8"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleApply();
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleApply}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Apply
                  </button>
                </div>
                {PRESETS.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {PRESETS.map((p) => (
                      <button
                        key={p.appId}
                        type="button"
                        onClick={() => {
                          setInputAppId(p.appId);
                          setAppId(p.appId);
                        }}
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          appId === p.appId
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-400">
                  Height (px)
                </label>
                <input
                  type="number"
                  value={embedHeight}
                  onChange={(e) =>
                    setEmbedHeight(Math.max(300, Number(e.target.value) || 600))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={hideTopBar}
                    onChange={(e) => setHideTopBar(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  Hide top bar
                </label>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-400">
                  SDK Script (for external websites)
                </p>
                <div className="relative rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900/60">
                  <pre className="whitespace-pre-wrap break-all text-xs font-mono text-gray-700 dark:text-gray-300">
                    {sdkScript}
                  </pre>
                  <button
                    type="button"
                    onClick={() => handleCopy(sdkScript)}
                    className="mt-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-400">
                  Chat URL (direct link)
                </p>
                <div className="relative rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900/60">
                  <pre className="whitespace-pre-wrap break-all text-xs font-mono text-gray-700 dark:text-gray-300">
                    {chatUrl}
                  </pre>
                  <button
                    type="button"
                    onClick={() => handleCopy(chatUrl)}
                    className="mt-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="p-4">
          {embedMode === "sdk" ? (
            <AbacusChatbotEmbed
              key={appId}
              appId={appId}
              height={embedHeight}
              hideTopBar={hideTopBar}
            />
          ) : (
            <div
              className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
              style={{ height: embedHeight }}
            >
              <object
                data={chatUrl}
                type="text/html"
                className="w-full h-full border-0"
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
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          How Embedding Works
        </h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-3 text-xs text-gray-600 dark:text-gray-400">
          <div className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
            <p className="font-medium text-gray-900 dark:text-white">
              SDK Widget
            </p>
            <p className="mt-1">
              Loads the Abacus chatbot SDK via script tag. Creates a floating
              chat widget overlay. Best for customer-facing websites.
            </p>
          </div>
          <div className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
            <p className="font-medium text-gray-900 dark:text-white">
              Direct Embed
            </p>
            <p className="mt-1">
              Embeds the chatbot UI directly in the page using HTML object
              element. No JavaScript injection. Content renders inline.
            </p>
          </div>
          <div className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
            <p className="font-medium text-gray-900 dark:text-white">
              Platform Answer API
            </p>
            <p className="mt-1">
              Use the Answer API from the Embed section on any assistant page
              for a fully custom chat UI with your own branding.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
