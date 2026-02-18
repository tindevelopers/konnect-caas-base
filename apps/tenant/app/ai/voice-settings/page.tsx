"use client";

import React, { useEffect, useState } from "react";

type Capabilities = {
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

function providerLabel(provider: string) {
  if (provider === "telnyx_deepgram") return "Premium STT (Deepgram)";
  if (provider === "telnyx") return "Premium Agent Provider";
  return provider;
}

export default function VoiceSettingsPage() {
  const [caps, setCaps] = useState<Capabilities>({ stt: [], tts: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState("deepgram");
  const [audioUrl, setAudioUrl] = useState("");
  const [transcribeResult, setTranscribeResult] = useState<string>("");
  const [isTranscribing, setIsTranscribing] = useState(false);

  useEffect(() => {
    async function loadCapabilities() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/agents/providers/capabilities");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load capabilities.");
        setCaps(data as Capabilities);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load capabilities."
        );
      } finally {
        setIsLoading(false);
      }
    }
    void loadCapabilities();
  }, []);

  async function runTranscriptionTest(event: React.FormEvent) {
    event.preventDefault();
    if (!audioUrl.trim()) return;
    setIsTranscribing(true);
    setTranscribeResult("");
    setError(null);
    try {
      const res = await fetch("/api/agents/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          audioUrl: audioUrl.trim(),
          diarize: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transcription failed.");
      setTranscribeResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed.");
    } finally {
      setIsTranscribing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Voice & Speech Settings
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Configure premium voice providers (Resemble, ElevenLabs) and STT
          providers (Deepgram, AssemblyAI, Premium STT via Deepgram).
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            STT Providers
          </h2>
          {isLoading ? (
            <p className="mt-3 text-sm text-gray-500">Loading...</p>
          ) : (
            <div className="mt-3 space-y-3">
              {caps.stt.map((item) => (
                <div
                  key={item.provider}
                  className="rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-700"
                >
                  <p className="font-medium text-gray-900 dark:text-white">
                    {providerLabel(item.provider)}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400">
                    Realtime: {item.realtime ? "Yes" : "No"} · File:{" "}
                    {item.fileTranscription ? "Yes" : "No"} · Diarization:{" "}
                    {item.diarization ? "Yes" : "No"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {item.notes}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            TTS Providers
          </h2>
          {isLoading ? (
            <p className="mt-3 text-sm text-gray-500">Loading...</p>
          ) : (
            <div className="mt-3 space-y-3">
              {caps.tts.map((item) => (
                <div
                  key={item.provider}
                  className="rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-700"
                >
                  <p className="font-medium text-gray-900 dark:text-white">
                    {providerLabel(item.provider)}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400">
                    Expressive: {item.expressive ? "Yes" : "No"} · Multilingual:{" "}
                    {item.multilingual ? "Yes" : "No"} · Voice cloning:{" "}
                    {item.voiceCloning ? "Yes" : "No"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {item.notes}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={runTranscriptionTest}
        className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Recording Transcription Test
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <option value="deepgram">deepgram</option>
            <option value="assemblyai">assemblyai</option>
            <option value="telnyx_deepgram">Premium STT (Deepgram)</option>
          </select>
          <input
            value={audioUrl}
            onChange={(e) => setAudioUrl(e.target.value)}
            placeholder="https://example.com/audio.wav"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 sm:col-span-2"
          />
        </div>
        <button
          type="submit"
          disabled={isTranscribing}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isTranscribing ? "Transcribing..." : "Run Test"}
        </button>
        {transcribeResult && (
          <pre className="max-h-96 overflow-auto rounded-lg bg-gray-100 p-3 text-xs text-gray-900 dark:bg-gray-800 dark:text-gray-300">
            {transcribeResult}
          </pre>
        )}
      </form>
    </div>
  );
}

