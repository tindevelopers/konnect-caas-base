"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import { TelnyxAIAgent } from "@telnyx/ai-agent-lib";

interface WebcallModalProps {
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

interface Suggestion {
  kind: string;
  title: string;
  why: string;
  rep_script: string;
  confidence: number;
}

interface SuggestionState {
  suggestions: Suggestion[];
  voiceText: string;
  loading: boolean;
}

export default function WebcallModal({
  isOpen,
  onClose,
  assistantId,
}: WebcallModalProps) {
  const [connectionState, setConnectionState] = useState<string>("disconnected");
  const [agentState, setAgentState] = useState<string>("listening");
  const [isCalling, setIsCalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [latency, setLatency] = useState<number | null>(null);
  const [suggestionState, setSuggestionState] = useState<SuggestionState>({
    suggestions: [],
    voiceText: "",
    loading: false,
  });

  const agentRef = useRef<TelnyxAIAgent | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const suggestionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAnalyzedRef = useRef<string>("");

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Initialize and connect agent when modal opens
  useEffect(() => {
    if (!isOpen || !assistantId) return;

    const agent = new TelnyxAIAgent({
      agentId: assistantId,
      environment: "production",
    });

    agentRef.current = agent;

    // Connection events
    agent.on("agent.connected", () => {
      setConnectionState("connected");
      setError(null);
    });

    agent.on("agent.disconnected", () => {
      setConnectionState("disconnected");
      setIsCalling(false);
    });

    agent.on("agent.error", (err: any) => {
      // Check for "Login Incorrect" — widget not configured
      const errCode = err?.error?.code;
      const errMsg = err?.error?.message || err?.message;
      if (errCode === -32001 || (typeof errMsg === 'string' && errMsg.includes("Login Incorrect"))) {
        setError("WIDGET_NOT_CONFIGURED");
      } else {
        let errDetail = 'Connection error';
        try { errDetail = typeof err === 'string' ? err : (errMsg || JSON.stringify(err)); } catch { errDetail = String(err); }
        setError(errDetail);
      }
      setConnectionState("error");
    });

    // Transcript events — also trigger suggestion analysis on user messages
    agent.on("transcript.item", (item: TranscriptItem) => {
      setTranscript((prev) => [...prev, item]);

      if (item.role === "user" && item.content.trim().length > 10) {
        if (suggestionTimerRef.current) clearTimeout(suggestionTimerRef.current);
        suggestionTimerRef.current = setTimeout(() => {
          const text = item.content.trim();
          if (text === lastAnalyzedRef.current) return;
          lastAnalyzedRef.current = text;
          setSuggestionState((prev) => ({ ...prev, loading: true }));
          fetch(`/api/agents/${assistantId}/answer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: text,
              channel: "voice",
            }),
          })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (!data) return;
              setSuggestionState({
                suggestions: data.product_recommendations ?? [],
                voiceText: data.voice_text ?? "",
                loading: false,
              });
            })
            .catch(() => {
              setSuggestionState((prev) => ({ ...prev, loading: false }));
            });
        }, 2000);
      }
    });

    // Conversation events
    agent.on("conversation.update", (notification: any) => {
      const call = notification?.call;
      if (!call) return;

      if (call.state === "active") {
        setIsCalling(true);
        setError(null);

        // Attach remote audio stream
        if (call.remoteStream && audioRef.current) {
          audioRef.current.srcObject = call.remoteStream;
        }
      } else if (call.state === "hangup" || call.state === "destroy") {
        setIsCalling(false);
      }
    });

    // Agent state events (listening, speaking, thinking)
    agent.on("conversation.agent.state", (data: any) => {
      setAgentState(data.state);
      if (data.userPerceivedLatencyMs !== undefined) {
        setLatency(data.userPerceivedLatencyMs);
      }
    });

    // Connect to Telnyx
    setConnectionState("connecting");
    agent.connect().catch((err: any) => {
      let errDetail = 'Failed to connect';
      try { errDetail = typeof err === 'string' ? err : (err?.message || JSON.stringify(err)); } catch { errDetail = String(err); }
      setError(errDetail);
      setConnectionState("error");
    });

    // Cleanup
    return () => {
      try { agent.disconnect(); } catch { /* ignore */ }
      agentRef.current = null;
    };
  }, [isOpen, assistantId]);

  const handleStartCall = useCallback(async () => {
    if (!agentRef.current || connectionState !== "connected") {
      setError("Not connected. Please wait for connection.");
      return;
    }

    setError(null);

    try {
      await agentRef.current.startConversation({
        callerName: "Webcall User",
      });
    } catch (err: any) {
      setError(err?.message || "Failed to start call");
    }
  }, [connectionState]);

  const handleEndCall = useCallback(() => {
    try {
      agentRef.current?.endConversation();
    } catch { /* ignore */ }
    setIsCalling(false);
  }, []);

  const handleClose = useCallback(() => {
    handleEndCall();
    try { agentRef.current?.disconnect(); } catch { /* ignore */ }
    if (suggestionTimerRef.current) clearTimeout(suggestionTimerRef.current);
    setConnectionState("disconnected");
    setTranscript([]);
    setError(null);
    setLatency(null);
    setSuggestionState({ suggestions: [], voiceText: "", loading: false });
    lastAnalyzedRef.current = "";
    onClose();
  }, [handleEndCall, onClose]);

  // Agent state indicator
  const getAgentStateDisplay = () => {
    switch (agentState) {
      case "speaking": return { text: "Speaking", color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/20" };
      case "thinking": return { text: "Thinking...", color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/20" };
      case "listening": return { text: "Listening", color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/20" };
      default: return { text: agentState, color: "text-gray-600", bg: "bg-gray-100 dark:bg-gray-800" };
    }
  };

  const stateDisplay = getAgentStateDisplay();

  const hasSuggestions = suggestionState.suggestions.length > 0 || suggestionState.voiceText || suggestionState.loading;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      className={`relative w-full ${hasSuggestions ? "max-w-[860px]" : "max-w-[520px]"} m-5 sm:m-0 rounded-3xl bg-white p-8 dark:bg-gray-900`}
    >
      <div className={hasSuggestions ? "flex gap-6" : ""}>
        {/* Left: Call + Transcript */}
        <div className={`text-center ${hasSuggestions ? "flex-1 min-w-0" : ""}`}>
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            {isCalling ? "In Call" : connectionState === "connected" ? "Ready to Call" : connectionState === "connecting" ? "Connecting..." : "Disconnected"}
          </h3>

          {/* Agent State Indicator */}
          {isCalling && (
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${stateDisplay.bg} mb-4`}>
              <span className={`inline-block w-2 h-2 rounded-full ${
                agentState === "speaking" ? "bg-green-500 animate-pulse" :
                agentState === "thinking" ? "bg-amber-500 animate-pulse" :
                "bg-blue-500"
              }`} />
              <span className={`text-sm font-medium ${stateDisplay.color}`}>{stateDisplay.text}</span>
              {latency !== null && (
                <span className="text-xs text-gray-500">({latency}ms)</span>
              )}
            </div>
          )}

          {/* Transcript */}
          {transcript.length > 0 && (
            <div className="mb-4 max-h-64 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-left">
              {transcript.map((item) => (
                <div key={item.id} className={`mb-2 text-sm ${
                  item.role === "assistant" ? "text-blue-700 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"
                }`}>
                  <span className="font-semibold capitalize">{item.role}: </span>
                  <span>{item.content}</span>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          )}

          {/* Status Info */}
          <div className="mb-4 space-y-1 text-sm text-gray-600 dark:text-gray-400">
            <div>
              <span className="font-medium">Connection:</span>{" "}
              <span className={`capitalize ${
                connectionState === "connected" ? "text-green-600" :
                connectionState === "error" ? "text-red-600" :
                "text-gray-600"
              }`}>{connectionState}</span>
            </div>
            <div>
              <span className="font-medium">Assistant:</span>{" "}
              <span className="font-mono text-xs">{assistantId}</span>
            </div>
          </div>

          {/* Hidden audio element */}
          <audio
            ref={audioRef}
            autoPlay
            playsInline
            style={{ display: "none" }}
          />

          {/* Widget Not Configured Error */}
          {error === "WIDGET_NOT_CONFIGURED" && (
            <div className="mb-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 text-left">
              <div className="font-semibold mb-2 text-base text-center">Widget Setup Required</div>
              <p className="text-xs mb-3">
                To use webcall, you need to enable the Widget for this assistant in your provider console.
                This is a one-time setup that generates the credentials for browser-based calls.
              </p>
              <ol className="text-xs space-y-1 list-decimal list-inside mb-3">
                <li>
                  Go to{" "}
                  <a
                    href="https://portal.telnyx.com/#/ai/assistants"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium"
                  >
                    Provider Console &gt; AI &gt; Assistants
                  </a>
                </li>
                <li>Click <strong>Edit</strong> on your assistant</li>
                <li>Go to the <strong>&quot;Widget&quot;</strong> tab</li>
                <li>Enable and save the widget configuration</li>
                <li>Come back here and try again</li>
              </ol>
              <p className="text-xs text-amber-600 dark:text-amber-500">
                The widget enables browser-based WebRTC calls using the same technology as the provider portal webcall.
              </p>
            </div>
          )}

          {/* Generic Error Display */}
          {error && error !== "WIDGET_NOT_CONFIGURED" && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-3 justify-center flex-wrap">
            {!isCalling && connectionState === "connected" && (
              <Button
                onClick={handleStartCall}
                className="min-w-[120px] bg-green-600 hover:bg-green-700 text-white"
              >
                Start Call
              </Button>
            )}
            {isCalling && (
              <Button
                onClick={handleEndCall}
                className="min-w-[120px] bg-red-600 hover:bg-red-700 text-white"
              >
                Hang Up
              </Button>
            )}
            {connectionState === "error" && (
              <Button
                variant="outline"
                onClick={() => {
                  setError(null);
                  setConnectionState("disconnected");
                  handleClose();
                }}
                className="min-w-[120px]"
              >
                Retry
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleClose}
              className="min-w-[120px]"
            >
              Close
            </Button>
          </div>
        </div>

        {/* Right: Agent Assist Suggestions */}
        {hasSuggestions && (
          <div className="w-72 shrink-0 border-l border-gray-200 pl-6 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Agent Assist
            </h4>

            {suggestionState.loading && (
              <p className="text-xs text-gray-500 dark:text-gray-400 animate-pulse">
                Analyzing conversation...
              </p>
            )}

            {suggestionState.voiceText && (
              <div className="mb-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-800 dark:bg-indigo-950/30">
                <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">
                  Suggested Response
                </p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400">
                  {suggestionState.voiceText}
                </p>
              </div>
            )}

            {suggestionState.suggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Recommendations
                </p>
                {suggestionState.suggestions.map((rec, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-700 dark:bg-gray-800"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="rounded bg-indigo-100 px-1 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                        {rec.kind}
                      </span>
                      <span className="text-xs font-medium text-gray-800 dark:text-white/90 truncate">
                        {rec.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600 dark:text-gray-400">{rec.why}</p>
                    {rec.rep_script && (
                      <div className="mt-1.5 rounded bg-gray-100 px-2 py-1 dark:bg-gray-900/60">
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Say this:</p>
                        <p className="text-[11px] text-gray-700 dark:text-gray-300">{rec.rep_script}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!suggestionState.loading && !suggestionState.voiceText && suggestionState.suggestions.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Suggestions will appear as the conversation progresses.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
