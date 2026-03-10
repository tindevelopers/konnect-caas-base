"use client";

import React, { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/button/Button";

interface EmbedPreviewSectionProps {
  assistantId: string;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  });
}

export default function EmbedPreviewSection({
  assistantId,
}: EmbedPreviewSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [agentPublicKey, setAgentPublicKey] = useState<string | null>(null);
  const [platformAgentId, setPlatformAgentId] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  const [telnyxSnippet, setTelnyxSnippet] = useState("");
  const [snippetSaved, setSnippetSaved] = useState(false);

  const [copied, setCopied] = useState<string | null>(null);

  const loadPublicKey = useCallback(async () => {
    setLoadingKey(true);
    setKeyError(null);
    try {
      const res = await fetch(`/api/agents?provider=telnyx&search=${encodeURIComponent(assistantId)}&limit=1`);
      if (!res.ok) throw new Error("Failed to look up agent");
      const data = await res.json();
      const agents = data.data ?? data.agents ?? data;
      const match = Array.isArray(agents)
        ? agents.find(
            (a: Record<string, unknown>) =>
              a.external_ref === assistantId || a.id === assistantId
          )
        : null;
      if (match?.public_key) {
        setAgentPublicKey(match.public_key as string);
        if (match.id) setPlatformAgentId(match.id as string);
      } else {
        setKeyError(
          "No platform agent found for this assistant. Create one in Agent Manager to get a publicKey."
        );
      }
    } catch (err) {
      setKeyError(
        err instanceof Error ? err.message : "Failed to load agent public key."
      );
    } finally {
      setLoadingKey(false);
    }
  }, [assistantId]);

  useEffect(() => {
    if (isExpanded && !agentPublicKey && !loadingKey && !keyError) {
      void loadPublicKey();
    }
  }, [isExpanded, agentPublicKey, loadingKey, keyError, loadPublicKey]);

  const handleCopy = useCallback((text: string, label: string) => {
    copyToClipboard(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const chatWidgetSnippet = agentPublicKey
    ? `<script src="${typeof window !== "undefined" ? window.location.origin : ""}/api/public/agents/widget?publicKey=${agentPublicKey}"></script>`
    : "";

  const answerApiExample = agentPublicKey
    ? `fetch("${typeof window !== "undefined" ? window.location.origin : ""}/api/public/agents/answer", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    publicKey: "${agentPublicKey}",
    message: "What products do you offer?",
    channel: "webchat"
  })
})`
    : "";

  return (
    <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-800">
      <button
        type="button"
        className="flex w-full items-center justify-between px-5 py-4 text-left"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            Website Embed & Unified Answer Preview
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Embed voice + chat widgets on websites. Preview the unified Answer API.
          </p>
        </div>
        <span className="text-gray-400">{isExpanded ? "−" : "+"}</span>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-200 px-5 pb-5 dark:border-gray-800">
          {/* Section 1: Platform Chat Widget Snippet */}
          <div className="mt-4">
            <h5 className="text-sm font-medium text-gray-800 dark:text-white/90">
              Platform Chat Widget (Text)
            </h5>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Embed this script tag on any website. Routes through your platform agent
              (supports Telnyx, Enhanced, or Abacus brain).
            </p>
            {loadingKey && (
              <p className="mt-2 text-xs text-gray-500">Loading agent public key...</p>
            )}
            {keyError && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{keyError}</p>
            )}
            {agentPublicKey && (
              <div className="mt-2">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-mono">publicKey: {agentPublicKey}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(agentPublicKey, "publicKey")}
                    className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
                  >
                    {copied === "publicKey" ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/60">
                  <pre className="whitespace-pre-wrap break-all text-xs font-mono text-gray-700 dark:text-gray-300">
                    {chatWidgetSnippet}
                  </pre>
                  <button
                    type="button"
                    onClick={() => handleCopy(chatWidgetSnippet, "chatSnippet")}
                    className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
                  >
                    {copied === "chatSnippet" ? "Copied!" : "Copy snippet"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Telnyx AI Agent — Embed on any website (chat + voice) */}
          <div className="mt-6">
            <h5 className="text-sm font-medium text-gray-800 dark:text-white/90">
              Embed on external website (Telnyx AI Agent)
            </h5>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Copy this code and paste it into your website’s HTML (e.g. before{" "}
              <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">&lt;/body&gt;</code>
              ). Uses the official Telnyx widget for chat + browser call. No backend required.
            </p>
            <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/60">
              <pre className="whitespace-pre-wrap break-all text-xs font-mono text-gray-700 dark:text-gray-300">
                {`<!-- Telnyx AI Agent widget: chat + voice -->
<telnyx-ai-agent
  agent-id="${assistantId}"
  environment="production">
</telnyx-ai-agent>
<script async src="https://unpkg.com/@telnyx/ai-agent-widget@next"></script>`}
              </pre>
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    `<!-- Telnyx AI Agent widget: chat + voice -->\n<telnyx-ai-agent\n  agent-id="${assistantId}"\n  environment="production">\n</telnyx-ai-agent>\n<script async src="https://unpkg.com/@telnyx/ai-agent-widget@next"></script>`,
                    "telnyxEmbed"
                  )
                }
                className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
              >
                {copied === "telnyxEmbed" ? "Copied!" : "Copy embed code"}
              </button>
            </div>
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
              <strong>Note:</strong> The JSON from the Widget tab (theme, start_call_text, etc.) is
              configuration saved in Telnyx Mission Control — do not paste it as script. The widget
              above uses that config automatically when you set <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">agent-id</code>.
            </p>
            {/* Optional: user can still paste a custom snippet if they have one */}
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-gray-600 dark:text-gray-400">
                I have a custom snippet from Telnyx Mission Control
              </summary>
              <textarea
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-mono dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                rows={3}
                placeholder='<telnyx-ai-agent agent-id="..." ...></telnyx-ai-agent>\n<script src="..."></script>'
                value={telnyxSnippet}
                onChange={(e) => {
                  setTelnyxSnippet(e.target.value);
                  setSnippetSaved(false);
                }}
              />
              <div className="mt-2 flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!telnyxSnippet.trim()}
                  onClick={() => setSnippetSaved(true)}
                >
                  {snippetSaved ? "Saved" : "Save Snippet"}
                </Button>
                {snippetSaved && (
                  <span className="text-xs text-green-600 dark:text-green-400">
                    Snippet stored for this session.
                  </span>
                )}
              </div>
            </details>
          </div>

          {/* Section 3: Answer API Example */}
          {agentPublicKey && (
            <div className="mt-6">
              <h5 className="text-sm font-medium text-gray-800 dark:text-white/90">
                Answer API (Custom UI)
              </h5>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Build your own UI and call the Answer API directly. Returns{" "}
                <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">voice_text</code>,{" "}
                <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">chat_markdown</code>,{" "}
                citations, and product recommendations.
              </p>
              <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/60">
                <pre className="whitespace-pre-wrap break-all text-xs font-mono text-gray-700 dark:text-gray-300">
                  {answerApiExample}
                </pre>
                <button
                  type="button"
                  onClick={() => handleCopy(answerApiExample, "apiExample")}
                  className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
                >
                  {copied === "apiExample" ? "Copied!" : "Copy example"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
