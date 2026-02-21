"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";

interface TestChatModalProps {
  assistantId: string;
  isOpen: boolean;
  onClose: () => void;
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
  error?: string;
}

export default function TestChatModal({
  assistantId,
  isOpen,
  onClose,
}: TestChatModalProps) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatConversationId, setChatConversationId] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSend = useCallback(async () => {
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
      const res = await fetch(`/api/agents/${assistantId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId: chatConversationId ?? undefined,
          channel: "webchat",
        }),
      });
      const data: AnswerApiResponse = await res.json();

      if (!res.ok) {
        const err = data.error ?? "Request failed";
        setChatError(err);
        return;
      }

      if (data.conversationId) setChatConversationId(data.conversationId);

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.chat_markdown ?? data.voice_text ?? "No response",
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Network error");
    } finally {
      setChatLoading(false);
    }
  }, [assistantId, chatInput, chatLoading, chatConversationId]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="relative w-full max-w-[520px] m-5 sm:m-0 rounded-2xl bg-white dark:bg-gray-900 flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <h4 className="text-base font-semibold text-gray-900 dark:text-white">
          Test Chat
        </h4>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <p className="px-4 pb-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
        Same assistant and knowledge as voice. Uses the unified Answer API.
      </p>
      <div
        className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900/40 space-y-3 min-h-[280px] max-h-[400px]"
        style={{ minHeight: 280 }}
      >
        {chatMessages.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
            Send a message to test the chat. Same backend as your voice assistant.
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
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {chatLoading && (
          <div className="flex justify-start">
            <div className="rounded-xl bg-white border border-gray-200 px-3 py-2 dark:bg-gray-800 dark:border-gray-700">
              <div className="flex gap-1">
                <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
              </div>
            </div>
          </div>
        )}
        {chatError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
            <p className="text-sm text-amber-800 dark:text-amber-200">{chatError}</p>
            {chatError.includes("Agent Manager") && (
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                <Link
                  href="/ai/agent-manager"
                  className="font-medium underline hover:no-underline"
                >
                  Open Agent Manager
                </Link>
                {" "}→ create or select an agent and set its external ref to this assistant’s ID so chat can use the same backend as voice.
              </p>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="border-t border-gray-200 dark:border-gray-700 p-3 flex gap-2 bg-white dark:bg-gray-900">
        <input
          type="text"
          className="flex-1 rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-600 dark:text-white/90"
          placeholder="Type a message..."
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          disabled={chatLoading}
        />
        <Button
          size="sm"
          onClick={() => void handleSend()}
          disabled={!chatInput.trim() || chatLoading}
        >
          Send
        </Button>
      </div>
    </Modal>
  );
}
