"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/button/Button";
import { CopyIcon } from "@/icons";

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

          {/* Section 2: Telnyx Voice Widget Snippet */}
          <div className="mt-6">
            <h5 className="text-sm font-medium text-gray-800 dark:text-white/90">
              Telnyx Voice Widget
            </h5>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Paste the embed snippet from{" "}
              <a
                href="https://portal.telnyx.com/#/ai/assistants"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Telnyx Mission Control
              </a>{" "}
              (AI Assistants → Widget tab). This enables voice + transcript on your website.
            </p>
            <textarea
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-mono dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              rows={4}
              placeholder='<script src="https://...telnyx widget snippet..."></script>'
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
                      <p className="whitespace-pre-wrap text-xs">{msg.content}</p>
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
