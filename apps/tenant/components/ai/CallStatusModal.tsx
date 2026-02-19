"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import AudioStreamPlayer from "./AudioStreamPlayer";

interface CallStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  callControlId: string;
  conversationId?: string | null;
  onHangUp: () => void | Promise<void>;
  isHangingUp?: boolean;
  streamUrl?: string; // Optional WebSocket URL for audio streaming
}

export default function CallStatusModal({
  isOpen,
  onClose,
  callControlId,
  conversationId,
  onHangUp,
  isHangingUp = false,
  streamUrl,
}: CallStatusModalProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevels, setAudioLevels] = useState<number[]>([]);
  const [clientId] = useState(() => `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  // Local WebSocket port for playback when on localhost (must match pnpm ws:server / WEBSOCKET_PORT)
  const LOCAL_WS_PORT = 3012;

  // Generate WebSocket URL with routing identifiers (preserve any existing query params like token).
  // When on localhost and streamUrl is ngrok (unreliable from browser), use local playback URL.
  // For Railway/other stable remotes, use the same URL so the browser connects to the deployed server.
  const wsUrl = useMemo(() => {
    if (!streamUrl) {
      console.warn("[TELEMETRY] CallStatusModal - No streamUrl provided", {
        timestamp: new Date().toISOString(),
        callControlId,
        clientId,
      });
      return undefined;
    }
    try {
      const sanitizedUrl = streamUrl.trim();
      const isLocalhost = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
      const isNgrokUrl = /ngrok/i.test(sanitizedUrl);

      // Only override to local playback when using ngrok (browser can be flaky through ngrok).
      // Railway and other remotes: browser uses same URL so no local ws:server needed.
      let baseUrl = sanitizedUrl;
      if (isLocalhost && isNgrokUrl) {
        baseUrl = `ws://localhost:${LOCAL_WS_PORT}/api/websocket/stream`;
        console.log("[TELEMETRY] CallStatusModal - Using local playback URL (browser on localhost, stream URL is ngrok)", {
          timestamp: new Date().toISOString(),
          playbackUrl: baseUrl,
          callControlId,
        });
      }

      const url = new URL(baseUrl);
      url.searchParams.set("clientId", clientId);
      url.searchParams.set("callControlId", callControlId);
      // Preserve token from original streamUrl for auth
      const originalUrl = new URL(sanitizedUrl);
      const token = originalUrl.searchParams.get("token");
      if (token) url.searchParams.set("token", token);
      const finalUrl = url.toString();

      console.log("[TELEMETRY] CallStatusModal - WebSocket URL generated", {
        timestamp: new Date().toISOString(),
        callControlId,
        clientId,
        originalStreamUrl: sanitizedUrl.substring(0, 100) + (sanitizedUrl.length > 100 ? "..." : ""),
        finalUrl: finalUrl.substring(0, 100) + (finalUrl.length > 100 ? "..." : ""),
        hasToken: finalUrl.includes("token="),
      });

      return finalUrl;
    } catch (error) {
      console.error("[TELEMETRY] CallStatusModal - Error parsing streamUrl", {
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        streamUrl: streamUrl.substring(0, 100),
        callControlId,
        clientId,
      });
      const sanitizedUrl = streamUrl.trim();
      const joiner = sanitizedUrl.includes("?") ? "&" : "?";
      const fallbackUrl = `${sanitizedUrl}${joiner}clientId=${encodeURIComponent(clientId)}&callControlId=${encodeURIComponent(callControlId)}`;

      console.log("[TELEMETRY] CallStatusModal - Using fallback URL construction", {
        timestamp: new Date().toISOString(),
        fallbackUrl: fallbackUrl.substring(0, 100) + (fallbackUrl.length > 100 ? "..." : ""),
      });

      return fallbackUrl;
    }
  }, [streamUrl, clientId, callControlId, LOCAL_WS_PORT]);

  // Generate random audio waveform visualization
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      // Generate random audio levels for visualization
      const levels = Array.from({ length: 50 }, () => Math.random() * 100);
      setAudioLevels(levels);
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen]);

  const handleHangUp = () => {
    onHangUp();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="relative w-full max-w-[480px] m-5 sm:m-0 rounded-3xl bg-white p-8 dark:bg-gray-900"
    >
      <div className="text-center">
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
          Connected
        </h3>

        {/* Audio Waveform Visualization */}
        <div className="flex items-center justify-center gap-1 h-32 mb-8">
          {audioLevels.length > 0 ? (
            audioLevels.map((level, index) => (
              <div
                key={index}
                className="w-2 rounded-full transition-all duration-100"
                style={{
                  height: `${level}%`,
                  backgroundColor: `hsl(${120 + level * 0.4}, 70%, ${50 + level * 0.3}%)`,
                  minHeight: "4px",
                }}
              />
            ))
          ) : (
            // Placeholder bars while loading
            Array.from({ length: 50 }).map((_, index) => (
              <div
                key={index}
                className="w-2 rounded-full bg-gray-300 dark:bg-gray-700"
                style={{
                  height: `${20 + Math.sin(index * 0.2) * 15}%`,
                  minHeight: "4px",
                }}
              />
            ))
          )}
        </div>

        {/* Call Info */}
        <div className="mb-6 space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <div>
            <span className="font-medium">Call Control ID:</span>{" "}
            <span className="font-mono text-xs">{callControlId}</span>
          </div>
          {conversationId && (
            <div>
              <span className="font-medium">Conversation ID:</span>{" "}
              <span className="font-mono text-xs">{conversationId}</span>
            </div>
          )}
        </div>

        {/* Audio Stream Player */}
        {wsUrl && (
          <div className="mb-6">
            <AudioStreamPlayer
              streamUrl={wsUrl}
              isActive={isOpen}
              onError={(error) => {
                console.error("Audio stream error:", error);
              }}
            />
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-3 justify-center">
          <Button
            variant="outline"
            onClick={() => setIsMuted(!isMuted)}
            className="min-w-[120px]"
          >
            {isMuted ? "Unmute" : "Mute"}
          </Button>
          <Button
            onClick={handleHangUp}
            disabled={isHangingUp}
            className="min-w-[120px] bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
          >
            {isHangingUp ? "Hanging up..." : "Hang up"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
