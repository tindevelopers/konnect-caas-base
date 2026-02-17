"use client";

import React, { useEffect, useMemo, useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import {
  integrationsCatalog,
  type IntegrationCatalogItem,
} from "../integrations/integrationsCatalog";

type CapabilityResponse = {
  stt: Array<{
    provider: string;
    realtime: boolean;
    fileTranscription: boolean;
    diarization: boolean;
    sentiment: boolean;
    topics: boolean;
    summaries: boolean;
    notes: string;
  }>;
  tts: Array<{
    provider: string;
    expressive: boolean;
    multilingual: boolean;
    voiceCloning: boolean;
    notes: string;
  }>;
};

const defaultCaps: CapabilityResponse = { stt: [], tts: [] };

export default function AgentProvidersPage() {
  const [capabilities, setCapabilities] = useState<CapabilityResponse>(defaultCaps);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCaps() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/agents/providers/capabilities");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load capability matrix.");
        setCapabilities(data as CapabilityResponse);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load capability matrix."
        );
      } finally {
        setIsLoading(false);
      }
    }
    void loadCaps();
  }, []);

  const providerCatalog = useMemo(() => {
    const wanted = new Set([
      "telnyx",
      "abacus",
      "deepgram",
      "assemblyai",
      "resemble",
      "elevenlabs",
      "google-calendar",
      "calcom",
      "nylas",
      "wasabi",
    ]);
    return integrationsCatalog.filter((item) => wanted.has(item.provider));
  }, []);

  const grouped = useMemo(() => {
    const byCategory = new Map<string, IntegrationCatalogItem[]>();
    for (const item of providerCatalog) {
      const list = byCategory.get(item.category) ?? [];
      list.push(item);
      byCategory.set(item.category, list);
    }
    return Array.from(byCategory.entries());
  }, [providerCatalog]);

  return (
    <div className="space-y-6">
      <PageBreadcrumb pageTitle="Agent Providers" />
      <div>
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
          Agent Providers & API Registry
        </h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          Configure and track provider capabilities across chat, voice, STT, and
          scheduling for tiered agents.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs uppercase text-gray-500 dark:text-gray-400">
            Registered Providers
          </p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
            {providerCatalog.length}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs uppercase text-gray-500 dark:text-gray-400">
            STT Options
          </p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
            {capabilities.stt.length}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs uppercase text-gray-500 dark:text-gray-400">
            TTS Options
          </p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
            {capabilities.tts.length}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Provider Catalog
        </h2>
        <div className="mt-4 space-y-4">
          {grouped.map(([category, items]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold uppercase text-gray-500 dark:text-gray-400">
                {category}
              </h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {items.map((item) => (
                  <div
                    key={item.provider}
                    className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {item.displayName}
                      </p>
                      <span className="text-xs text-gray-500">{item.provider}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            STT Capability Matrix
          </h2>
          {isLoading ? (
            <p className="mt-3 text-sm text-gray-500">Loading...</p>
          ) : (
            <div className="mt-3 space-y-3">
              {capabilities.stt.map((item) => (
                <div
                  key={item.provider}
                  className="rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-700"
                >
                  <div className="font-medium text-gray-900 dark:text-white">
                    {item.provider}
                  </div>
                  <div className="mt-1 text-gray-500 dark:text-gray-400">
                    Realtime: {item.realtime ? "Yes" : "No"} · File:{" "}
                    {item.fileTranscription ? "Yes" : "No"} · Diarization:{" "}
                    {item.diarization ? "Yes" : "No"} · Sentiment:{" "}
                    {item.sentiment ? "Yes" : "No"}
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {item.notes}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            TTS Capability Matrix
          </h2>
          {isLoading ? (
            <p className="mt-3 text-sm text-gray-500">Loading...</p>
          ) : (
            <div className="mt-3 space-y-3">
              {capabilities.tts.map((item) => (
                <div
                  key={item.provider}
                  className="rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-700"
                >
                  <div className="font-medium text-gray-900 dark:text-white">
                    {item.provider}
                  </div>
                  <div className="mt-1 text-gray-500 dark:text-gray-400">
                    Expressive: {item.expressive ? "Yes" : "No"} · Multilingual:{" "}
                    {item.multilingual ? "Yes" : "No"} · Voice cloning:{" "}
                    {item.voiceCloning ? "Yes" : "No"}
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {item.notes}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

