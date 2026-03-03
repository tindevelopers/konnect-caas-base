"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { TelnyxAIAgent } from "@telnyx/ai-agent-lib";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";

/** Renders inline markdown: [text](url), **bold**, and bare URLs as clickable links. */
function renderInlineContent(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const pattern = /(\[([^\]]+)\]\((https?:\/\/[^)]+)\))|(\*\*([^*]+)\*\*)|(https?:\/\/[^\s)<\]]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      parts.push(
        <a key={`l-${key++}`} href={match[3]} target="_blank" rel="noopener noreferrer"
          className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400">
          {match[2]}
        </a>
      );
    } else if (match[4]) {
      parts.push(<strong key={`b-${key++}`}>{match[5]}</strong>);
    } else if (match[6]) {
      parts.push(
        <a key={`u-${key++}`} href={match[6]} target="_blank" rel="noopener noreferrer"
          className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400">
          {match[6]}
        </a>
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

interface TestChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  assistantId: string;
}

interface TranscriptItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function TestChatModal({ isOpen, onClose, assistantId }: TestChatModalProps) {
  const [connectionState, setConnectionState] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("disconnected");
  const [isConversationActive, setIsConversationActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [message, setMessage] = useState("");

  const agentRef = useRef<TelnyxAIAgent | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  useEffect(() => {
    if (!isOpen || !assistantId) return;

    const agent = new TelnyxAIAgent({
      agentId: assistantId,
      environment: "production",
    });
    agentRef.current = agent;

    agent.on("agent.connected", () => {
      setConnectionState("connected");
      setError(null);
    });

    agent.on("agent.disconnected", () => {
      setConnectionState("disconnected");
      setIsConversationActive(false);
    });

    agent.on("agent.error", (err: any) => {
      const errCode = err?.error?.code;
      const errMsg = err?.error?.message || err?.message;
      if (errCode === -32001 || (typeof errMsg === "string" && errMsg.includes("Login Incorrect"))) {
        setError("WIDGET_NOT_CONFIGURED");
      } else {
        let detail = "Connection error";
        try {
          detail = typeof err === "string" ? err : errMsg || JSON.stringify(err);
        } catch {
          detail = String(err);
        }
        setError(detail);
      }
      setConnectionState("error");
    });

    agent.on("transcript.item", (item: TranscriptItem) => {
      setTranscript((prev) => [...prev, item]);
    });

    agent.on("conversation.update", (notification: any) => {
      const callState = notification?.call?.state;
      if (callState === "active") {
        setIsConversationActive(true);
      }
      if (callState === "hangup" || callState === "destroy") {
        setIsConversationActive(false);
      }
    });

    setConnectionState("connecting");
    agent.connect().catch((err: any) => {
      let detail = "Failed to connect";
      try {
        detail = typeof err === "string" ? err : err?.message || JSON.stringify(err);
      } catch {
        detail = String(err);
      }
      setError(detail);
      setConnectionState("error");
    });

    return () => {
      try {
        agent.disconnect();
      } catch {
        // ignore
      }
      agentRef.current = null;
    };
  }, [isOpen, assistantId]);

  const handleStart = useCallback(async () => {
    if (!agentRef.current || connectionState !== "connected") {
      setError("Not connected yet. Please wait for connection.");
      return;
    }
    setError(null);
    try {
      await agentRef.current.startConversation({ callerName: "Test Chat User" });
    } catch (err: any) {
      setError(err?.message || "Failed to start conversation");
    }
  }, [connectionState]);

  const handleEnd = useCallback(() => {
    try {
      agentRef.current?.endConversation();
    } catch {
      // ignore
    }
    setIsConversationActive(false);
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed) return;
    if (!agentRef.current || !isConversationActive) {
      setError("Start the conversation first to send messages.");
      return;
    }
    try {
      agentRef.current.sendConversationMessage(trimmed);
      setMessage("");
    } catch (err: any) {
      setError(err?.message || "Failed to send message");
    }
  }, [isConversationActive, message]);

  const handleClose = useCallback(() => {
    handleEnd();
    try {
      agentRef.current?.disconnect();
    } catch {
      // ignore
    }
    setConnectionState("disconnected");
    setTranscript([]);
    setMessage("");
    setError(null);
    onClose();
  }, [handleEnd, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      className="relative w-full max-w-[720px] m-5 sm:m-0 rounded-3xl bg-white p-6 lg:p-8 dark:bg-gray-900"
    >
      <div>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Test Chat</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              This uses Telnyx WebRTC under the hood. You may be prompted for microphone access.
            </p>
          </div>
          <div className="text-right text-xs text-gray-500 dark:text-gray-400">
            <div>
              <span className="font-medium">Connection:</span>{" "}
              <span
                className={
                  connectionState === "connected"
                    ? "text-green-600"
                    : connectionState === "error"
                      ? "text-red-600"
                      : "text-gray-600"
                }
              >
                {connectionState}
              </span>
            </div>
            <div className="mt-1">
              <span className="font-medium">Assistant:</span>{" "}
              <span className="font-mono">{assistantId}</span>
            </div>
          </div>
        </div>

        {error === "WIDGET_NOT_CONFIGURED" && (
          <div className="mb-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
            <div className="font-semibold mb-2">Widget Setup Required</div>
            <p className="text-xs">
              To use Test Chat, enable the Widget for this assistant in the Telnyx portal (AI → Assistants → Edit →
              Widget tab), then retry.
            </p>
          </div>
        )}

        {error && error !== "WIDGET_NOT_CONFIGURED" && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-3">
          {!isConversationActive && (
            <Button onClick={handleStart} disabled={connectionState !== "connected"}>
              Start Chat
            </Button>
          )}
          {isConversationActive && (
            <Button onClick={handleEnd} className="bg-red-600 hover:bg-red-700 text-white">
              End Chat
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/60">
          <div className="max-h-80 overflow-y-auto pr-2">
            {transcript.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No messages yet. Click <span className="font-medium">Start Chat</span> to begin.
              </p>
            ) : (
              transcript.map((item) => (
                <div key={item.id} className="mb-3 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span
                      className={
                        item.role === "assistant"
                          ? "font-semibold text-blue-700 dark:text-blue-400"
                          : "font-semibold text-gray-800 dark:text-gray-200"
                      }
                    >
                      {item.role === "assistant" ? "Assistant" : "You"}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="mt-1 text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {item.role === "assistant" ? renderInlineContent(item.content) : item.content}
                  </div>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              className="dark:bg-dark-900 shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 h-11 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
              placeholder={isConversationActive ? "Type a message…" : "Start chat to send messages…"}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
              disabled={!isConversationActive}
            />
            <Button onClick={handleSend} disabled={!isConversationActive || !message.trim()}>
              Send
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
