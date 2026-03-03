"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/button/Button";
import { CopyIcon } from "@/icons";
import { ensureProxyWebhookToolOnAssistantAction } from "@/app/actions/telnyx/assistants";

interface EmbedPreviewSectionProps {
  assistantId: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface AnswerApiResponse {
  conversationId?: string;
  voice_text?: string;
  chat_markdown?: string;
  citations?: Array<{ title: string; source: string; url?: string }>;
  product_recommendations?: Array<{
    kind: string;
    title: string;
    why: string;
    rep_script: string;
    confidence: number;
  }>;
  handoffSuggested?: boolean;
  handoffReason?: string;
  error?: string;
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

/** Lightweight markdown-to-JSX: renders links, bold, headers, and horizontal rules. */
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={`hr-${i}`} className="my-2 border-gray-200 dark:border-gray-700" />);
      continue;
    }

    if (/^###\s+/.test(line)) {
      nodes.push(
        <p key={`h3-${i}`} className="font-semibold text-xs mt-2 mb-1">
          {renderInline(line.replace(/^###\s+/, ""))}
        </p>
      );
      continue;
    }

    if (/^##\s+/.test(line)) {
      nodes.push(
        <p key={`h2-${i}`} className="font-bold text-xs mt-2 mb-1">
          {renderInline(line.replace(/^##\s+/, ""))}
        </p>
      );
      continue;
    }

    if (line.startsWith("- ")) {
      nodes.push(
        <p key={`li-${i}`} className="pl-3 text-xs">
          {"• "}{renderInline(line.slice(2))}
        </p>
      );
      continue;
    }

    nodes.push(
      <span key={`line-${i}`}>
        {renderInline(line)}
        {i < lines.length - 1 && <br />}
      </span>
    );
  }

  return nodes;
}

/** Renders inline markdown: [text](url), **bold**, URLs. */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const pattern = /(\[([^\]]+)\]\((https?:\/\/[^)]+)\))|(\*\*([^*]+)\*\*)|(https?:\/\/[^\s<)]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      parts.push(
        <a
          key={`lnk-${key++}`}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {match[2]}
        </a>
      );
    } else if (match[4]) {
      parts.push(<strong key={`b-${key++}`}>{match[5]}</strong>);
    } else if (match[6]) {
      parts.push(
        <a
          key={`url-${key++}`}
          href={match[6]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {match[6]}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
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
  const [syncWebhookLoading, setSyncWebhookLoading] = useState(false);
  const [syncWebhookResult, setSyncWebhookResult] = useState<{ success: boolean; error?: string } | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatConversationId, setChatConversationId] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [lastSuggestions, setLastSuggestions] = useState<AnswerApiResponse["product_recommendations"]>([]);
  const [lastCitations, setLastCitations] = useState<AnswerApiResponse["citations"]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const loadPublicKey = useCallback(async () => {
    setLoadingKey(true);
    setKeyError(null);
    try {
      // Do not filter by provider: the platform agent for this assistant may be Abacus, Telnyx, or Advanced.
      const res = await fetch(`/api/agents?search=${encodeURIComponent(assistantId)}&limit=50`);
      if (!res.ok) throw new Error("Failed to look up agent");
      const data = await res.json();
      const agents = data.data ?? data.agents ?? data;
      const match = Array.isArray(agents)
        ? agents.find(
            (a: Record<string, unknown>) =>
              (a.external_ref as string)?.trim() === assistantId.trim() || a.id === assistantId
          )
        : null;
      if (match?.public_key) {
        setAgentPublicKey(match.public_key as string);
        if (match.id) setPlatformAgentId(match.id as string);
      } else {
        setKeyError(
          `No platform agent found for this assistant. Create one in Agent Manager with External ref = this assistant's ID (${assistantId}), or edit an existing agent and set External ref to match.`
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

  const handleSendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    setChatInput("");
    setChatError(null);
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const usePublicApi = Boolean(agentPublicKey);
      const internalId = platformAgentId ?? assistantId;
      const endpoint = usePublicApi
        ? "/api/public/agents/answer"
        : `/api/agents/${internalId}/answer`;
      const body = usePublicApi
        ? {
            publicKey: agentPublicKey,
            message: text,
            conversationId: chatConversationId ?? undefined,
            channel: "webchat",
          }
        : {
            message: text,
            conversationId: chatConversationId ?? undefined,
            channel: "webchat",
          };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: AnswerApiResponse = await res.json();

      if (!res.ok) {
        setChatError(data.error ?? "Request failed");
        return;
      }

      if (data.conversationId) setChatConversationId(data.conversationId);
      if (data.product_recommendations?.length) setLastSuggestions(data.product_recommendations);
      if (data.citations?.length) setLastCitations(data.citations);

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.chat_markdown ?? data.voice_text ?? "No response",
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setChatError(
        err instanceof Error ? err.message : "Network error"
      );
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, agentPublicKey, platformAgentId, assistantId, chatConversationId]);

  const appOrigin = typeof window !== "undefined" ? window.location.origin : "";

  const chatWidgetSnippet = agentPublicKey
    ? `<script src="${appOrigin}/api/public/agents/widget?publicKey=${agentPublicKey}"></script>`
    : "";

  const answerApiExample = agentPublicKey
    ? `fetch("${appOrigin}/api/public/agents/answer", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    publicKey: "${agentPublicKey}",
    message: "What products do you offer?",
    channel: "webchat"
  })
})`
    : "";

  const telnyxProxyWebhookToolUrl = agentPublicKey
    ? `${appOrigin}/api/webhooks/telnyx/assistant-proxy?publicKey=${agentPublicKey}`
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
              <div className="mt-2 space-y-1">
                <p className="text-xs text-amber-600 dark:text-amber-400">{keyError}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  This assistant&apos;s ID: <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">{assistantId}</code>
                  {" · "}
                  <a
                    href="/ai/agent-manager"
                    className="text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    Open Agent Manager
                  </a>
                </p>
              </div>
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
                {`<!-- Telnyx AI Agent widget: chat + voice (ensure assistant has webhook tool + web_chat) -->
<telnyx-ai-agent
  agent-id="${assistantId}"
  environment="production"
  channels="voice,web_chat">
</telnyx-ai-agent>
<script async src="https://unpkg.com/@telnyx/ai-agent-widget@next"></script>`}
              </pre>
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    `<!-- Telnyx AI Agent widget: chat + voice -->\n<telnyx-ai-agent\n  agent-id="${assistantId}"\n  environment="production"\n  channels="voice,web_chat">\n</telnyx-ai-agent>\n<script async src="https://unpkg.com/@telnyx/ai-agent-widget@next"></script>`,
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
            {agentPublicKey && (
              <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-100">
                <p className="font-medium">Telnyx transport + Abacus intelligence</p>
                <p className="mt-1">
                  So widget text chat reaches your proxy (and Abacus), the Telnyx assistant must have a webhook tool
                  and web_chat enabled. Either sync automatically below or add the URL in Telnyx Mission Control.
                </p>
                <pre className="mt-2 whitespace-pre-wrap break-all rounded bg-white/80 p-2 font-mono text-[11px] dark:bg-gray-900/70">
                  {telnyxProxyWebhookToolUrl}
                </pre>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(telnyxProxyWebhookToolUrl, "telnyxProxyWebhookToolUrl")}
                    className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
                  >
                    {copied === "telnyxProxyWebhookToolUrl"
                      ? "Copied!"
                      : "Copy webhook URL"}
                  </button>
                  <button
                    type="button"
                    disabled={syncWebhookLoading || !telnyxProxyWebhookToolUrl}
                    onClick={async () => {
                      if (!telnyxProxyWebhookToolUrl) return;
                      setSyncWebhookLoading(true);
                      setSyncWebhookResult(null);
                      try {
                        const result = await ensureProxyWebhookToolOnAssistantAction(
                          assistantId,
                          telnyxProxyWebhookToolUrl
                        );
                        setSyncWebhookResult(result);
                      } finally {
                        setSyncWebhookLoading(false);
                      }
                    }}
                    className="rounded bg-sky-600 px-2 py-1 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                  >
                    {syncWebhookLoading ? "Syncing…" : "Sync webhook + enable text chat to Telnyx"}
                  </button>
                </div>
                {syncWebhookResult && (
                  <p className={`mt-2 ${syncWebhookResult.success ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {syncWebhookResult.success
                      ? "Done. Webhook tool and web_chat are set on this assistant. Use Test Chat to verify."
                      : syncWebhookResult.error}
                  </p>
                )}
              </div>
            )}
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

          {/* Section 3: Answer API Example (white-label endpoint) */}
          {agentPublicKey && (
            <div className="mt-6">
              <h5 className="text-sm font-medium text-gray-800 dark:text-white/90">
                Answer API (Custom UI) — White label endpoint
              </h5>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Use this from any frontend (different domain, white-label app). POST to the URL below with{" "}
                <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">publicKey</code> and{" "}
                <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">message</code>. Returns{" "}
                <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">voice_text</code>,{" "}
                <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">chat_markdown</code>,{" "}
                citations, and product recommendations.
              </p>
              <p className="mt-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                Endpoint: <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">{appOrigin || "..."}/api/public/agents/answer</code>
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

          {/* Section 4: In-App Chat Preview */}
          <div className="mt-6">
            <h5 className="text-sm font-medium text-gray-800 dark:text-white/90">
              Chat Preview (Unified Answer API)
            </h5>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Test the unified Answer API in-app. Same knowledge source as voice.
            </p>
            <div className="mt-2 flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden" style={{ height: 360 }}>
              <div className="flex-1 overflow-y-auto p-3 bg-gray-50 dark:bg-gray-900/40 space-y-2">
                {chatMessages.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-8">
                    Send a message to test the Answer API
                  </p>
                )}
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                        msg.role === "user"
                          ? "bg-indigo-600 text-white"
                          : "bg-white border border-gray-200 text-gray-800 dark:bg-gray-800 dark:border-gray-700 dark:text-white/90"
                      }`}
                    >
                      <div className="whitespace-pre-wrap text-xs">
                        {msg.role === "assistant"
                          ? renderMarkdown(msg.content)
                          : msg.content}
                      </div>
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="rounded-xl bg-white border border-gray-200 px-3 py-2 dark:bg-gray-800 dark:border-gray-700">
                      <div className="flex gap-1">
                        <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
                        <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
                        <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
                      </div>
                    </div>
                  </div>
                )}
                {chatError && (
                  <p className="text-xs text-red-500 text-center">{chatError}</p>
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 p-2 flex gap-2 bg-white dark:bg-gray-900">
                <input
                  type="text"
                  className="flex-1 rounded-lg border border-gray-300 bg-transparent px-3 py-1.5 text-sm dark:border-gray-600 dark:text-white/90"
                  placeholder="Ask a question..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSendChat();
                    }
                  }}
                  disabled={chatLoading}
                />
                <Button
                  size="sm"
                  onClick={handleSendChat}
                  disabled={!chatInput.trim() || chatLoading}
                >
                  Send
                </Button>
              </div>
            </div>
          </div>

          {/* Section 5: Suggestions & Citations from last response */}
          {(lastSuggestions && lastSuggestions.length > 0) && (
            <div className="mt-4">
              <h5 className="text-sm font-medium text-gray-800 dark:text-white/90">
                Product Recommendations
              </h5>
              <div className="mt-2 space-y-2">
                {lastSuggestions.map((rec, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/60"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                        {rec.kind}
                      </span>
                      <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                        {rec.title}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{rec.why}</p>
                    {rec.rep_script && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-gray-500">Rep script:</span>
                        <code className="flex-1 rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">
                          {rec.rep_script}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopy(rec.rep_script, `rep-${i}`)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
                        >
                          <CopyIcon className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(lastCitations && lastCitations.length > 0) && (
            <div className="mt-4">
              <h5 className="text-sm font-medium text-gray-800 dark:text-white/90">
                Citations
              </h5>
              <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                {lastCitations.map((c, i) => (
                  <li key={i}>
                    {i + 1}.{" "}
                    {c.url ? (
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline">
                        {c.title}
                      </a>
                    ) : (
                      c.title
                    )}{" "}
                    {c.source && <span className="text-gray-400">({c.source})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
