"use client";

import React, { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/button/Button";

interface AudioStreamPlayerProps {
  streamUrl: string;
  isActive: boolean;
  onError?: (error: Error) => void;
}

/**
 * AudioStreamPlayer component for playing real-time audio from Telnyx WebSocket stream
 * 
 * This component connects to a WebSocket URL and plays the audio stream in real-time.
 * The WebSocket receives base64-encoded RTP payloads from Telnyx and converts them
 * to playable audio using Web Audio API.
 */
export default function AudioStreamPlayer({
  streamUrl,
  isActive,
  onError,
}: AudioStreamPlayerProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferQueueRef = useRef<AudioBuffer[]>([]);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    if (!isActive || !streamUrl) {
      disconnect();
      return;
    }

    connect();
    return () => {
      disconnect();
    };
  }, [isActive, streamUrl]);

  const connect = async () => {
    try {
      setError(null);
      
      // TELEMETRY: Connection attempt
      console.log("[TELEMETRY] AudioStreamPlayer connecting", {
        timestamp: new Date().toISOString(),
        streamUrl: streamUrl.substring(0, 100) + (streamUrl.length > 100 ? '...' : ''),
        isActive,
        userAgent: navigator.userAgent,
      });
      
      // Initialize Web Audio API
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("Web Audio API is not supported in this browser");
      }

      audioContextRef.current = new AudioContextClass({ sampleRate: 8000 });
      
      // Connect to WebSocket
      const ws = new WebSocket(streamUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[TELEMETRY] AudioStreamPlayer WebSocket connected", {
          timestamp: new Date().toISOString(),
          streamUrl: streamUrl.substring(0, 100),
          readyState: ws.readyState,
        });
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("[TELEMETRY] AudioStreamPlayer message received", {
            timestamp: new Date().toISOString(),
            event: message.event,
            messageSize: event.data.length,
          });
          handleWebSocketMessage(message);
        } catch (err) {
          console.error("[TELEMETRY] AudioStreamPlayer error parsing message", {
            timestamp: new Date().toISOString(),
            error: err instanceof Error ? err.message : String(err),
            dataPreview: event.data.substring(0, 100),
          });
        }
      };

      ws.onerror = (err) => {
        console.error("[TELEMETRY] AudioStreamPlayer WebSocket error", {
          timestamp: new Date().toISOString(),
          error: err,
          streamUrl: streamUrl.substring(0, 100),
          readyState: ws.readyState,
        });
        const errorMsg = "WebSocket connection error";
        setError(errorMsg);
        onError?.(new Error(errorMsg));
      };

      ws.onclose = (event) => {
        console.log("[TELEMETRY] AudioStreamPlayer WebSocket closed", {
          timestamp: new Date().toISOString(),
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
        setIsConnected(false);
        setIsPlaying(false);
        // Surface close reason so user sees "Unauthorized", "Connection refused", etc.
        if (event.code !== 1000 && event.code !== 1005) {
          const detail = event.reason || `Code ${event.code}`;
          setError(`WebSocket connection error: ${detail}`);
          onError?.(new Error(detail));
        }
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to connect to audio stream";
      console.error("[TELEMETRY] AudioStreamPlayer connection failed", {
        timestamp: new Date().toISOString(),
        error: errorMsg,
        streamUrl: streamUrl.substring(0, 100),
      });
      setError(errorMsg);
      onError?.(err instanceof Error ? err : new Error(errorMsg));
    }
  };

  const handleWebSocketMessage = async (message: any) => {
    if (!audioContextRef.current) {
      console.warn("[TELEMETRY] AudioStreamPlayer message received but AudioContext not ready", {
        timestamp: new Date().toISOString(),
        event: message.event,
      });
      return;
    }

    try {
      // Handle different event types from Telnyx WebSocket
      if (message.event === "connected") {
        console.log("[TELEMETRY] AudioStreamPlayer stream connected", {
          timestamp: new Date().toISOString(),
          version: message.version,
          clientId: message.clientId,
          callControlId: message.callControlId,
        });
        return;
      }

      if (message.event === "start") {
        console.log("[TELEMETRY] AudioStreamPlayer stream started", {
          timestamp: new Date().toISOString(),
          startDetails: message.start,
          callControlId: message.start?.call_control_id,
        });
        setIsPlaying(true);
        return;
      }

      if (message.event === "media") {
        // TELEMETRY: Media chunk received
        const mediaSize = message.media?.payload?.length || 0;
        console.log("[TELEMETRY] AudioStreamPlayer media chunk received", {
          timestamp: new Date().toISOString(),
          payloadSize: mediaSize,
          queueLength: audioBufferQueueRef.current.length,
        });
        // Decode base64 RTP payload and play audio
        await processAudioChunk(message.media);
        return;
      }

      if (message.event === "stop") {
        console.log("[TELEMETRY] AudioStreamPlayer stream stopped", {
          timestamp: new Date().toISOString(),
        });
        setIsPlaying(false);
        return;
      }

      if (message.event === "error") {
        const errorMsg = message.payload?.detail || "Stream error";
        console.error("[TELEMETRY] AudioStreamPlayer stream error", {
          timestamp: new Date().toISOString(),
          error: errorMsg,
          payload: message.payload,
        });
        setError(errorMsg);
        onError?.(new Error(errorMsg));
        return;
      }
      
      console.log("[TELEMETRY] AudioStreamPlayer unknown event", {
        timestamp: new Date().toISOString(),
        event: message.event,
        message,
      });
    } catch (err) {
      console.error("[TELEMETRY] AudioStreamPlayer error processing message", {
        timestamp: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
        event: message.event,
      });
    }
  };

  const processAudioChunk = async (media: any) => {
    if (!audioContextRef.current || !media.payload) {
      console.warn("[TELEMETRY] AudioStreamPlayer skipping chunk - missing context or payload", {
        timestamp: new Date().toISOString(),
        hasContext: !!audioContextRef.current,
        hasPayload: !!media.payload,
      });
      return;
    }

    try {
      const startTime = performance.now();
      
      // Decode base64 RTP payload
      const binaryString = atob(media.payload);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert μ-law (PCMU) to linear PCM
      // Note: This is a simplified conversion. For production, use a proper codec library
      const pcmData = new Int16Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) {
        // Simple μ-law to linear PCM conversion
        const sign = (bytes[i] & 0x80) ? -1 : 1;
        const exponent = (bytes[i] & 0x70) >> 4;
        const mantissa = (bytes[i] & 0x0F) | 0x10;
        pcmData[i] = sign * ((mantissa << (exponent + 1)) - 33 - 0x84);
      }

      // Create audio buffer (8kHz, mono)
      const buffer = audioContextRef.current.createBuffer(1, pcmData.length, 8000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < pcmData.length; i++) {
        channelData[i] = pcmData[i] / 32768.0; // Normalize to [-1, 1]
      }

      // Queue audio buffer for playback
      audioBufferQueueRef.current.push(buffer);
      
      const processingTime = performance.now() - startTime;
      console.log("[TELEMETRY] AudioStreamPlayer chunk processed", {
        timestamp: new Date().toISOString(),
        payloadSize: media.payload.length,
        bufferLength: buffer.length,
        duration: buffer.duration,
        queueLength: audioBufferQueueRef.current.length,
        processingTimeMs: processingTime.toFixed(2),
      });
      
      // Process queue if not already processing
      if (!isProcessingRef.current) {
        processAudioQueue();
      }
    } catch (err) {
      console.error("[TELEMETRY] AudioStreamPlayer error processing chunk", {
        timestamp: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        payloadPreview: media.payload?.substring(0, 50),
      });
    }
  };

  const processAudioQueue = async () => {
    if (!audioContextRef.current || isProcessingRef.current) return;
    
    isProcessingRef.current = true;

    while (audioBufferQueueRef.current.length > 0 && audioContextRef.current.state === "running") {
      const buffer = audioBufferQueueRef.current.shift();
      if (!buffer) break;

      try {
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.start();

        // Wait for buffer to finish playing (approximate)
        await new Promise((resolve) => {
          source.onended = resolve;
          setTimeout(resolve, buffer.duration * 1000);
        });
      } catch (err) {
        console.error("[AudioStreamPlayer] Error playing audio buffer:", err);
      }
    }

    isProcessingRef.current = false;
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }

    audioBufferQueueRef.current = [];
    setIsConnected(false);
    setIsPlaying(false);
  };

  if (!isActive) {
    return null;
  }

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/60">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Audio Stream
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {isConnected
                ? isPlaying
                  ? "Playing audio..."
                  : "Connected, waiting for audio..."
                : "Connecting..."}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`h-3 w-3 rounded-full ${
                isConnected ? "bg-green-500" : "bg-gray-400"
              }`}
            />
          </div>
        </div>
        {error && (
          <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
        )}
      </div>
      
      {error && (
        <div className="mt-2 space-y-1 text-xs text-red-600 dark:text-red-400">
          <p>The call is connected; this only affects hearing the stream in the browser.</p>
          {streamUrl && /localhost|127\.0\.0\.1/.test(streamUrl) ? (
            <p>Ensure the local WebSocket server is running: <code className="rounded bg-gray-200 px-1 dark:bg-gray-700">pnpm ws:server</code> (port 3012).</p>
          ) : (
            <>
              <p>Remote stream (e.g. Railway):</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>If you see <strong>Unauthorized</strong>: set <code className="rounded bg-gray-200 px-1 dark:bg-gray-700">WEBSOCKET_AUTH_TOKEN</code> in <code className="rounded bg-gray-200 px-1 dark:bg-gray-700">.env.local</code> to the <em>same</em> value as in Railway variables.</li>
                <li>Check the server is up: <code className="rounded bg-gray-200 px-1 dark:bg-gray-700">curl https://your-railway-url/health</code></li>
                <li>Browser console (F12) shows the close code and reason.</li>
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
