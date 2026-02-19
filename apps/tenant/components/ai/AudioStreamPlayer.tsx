"use client";

import React, { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/button/Button";

interface AudioStreamPlayerProps {
  streamUrl: string;
  isActive: boolean;
  onError?: (error: Error) => void;
}

/** Telnyx media format from WebSocket "start" event (see Telnyx Media Streaming docs). */
interface MediaFormat {
  encoding: string;
  sample_rate: number;
  channels: number;
}

const DEFAULT_MEDIA_FORMAT: MediaFormat = {
  encoding: "PCMU",
  sample_rate: 8000,
  channels: 1,
};

/** Detect Web Codecs Opus support (AudioDecoder + opus codec). */
function isOpusDecodeSupported(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return typeof (window as any).AudioDecoder === "function" && typeof (window as any).EncodedAudioChunk === "function";
  } catch {
    return false;
  }
}

/**
 * AudioStreamPlayer component for playing real-time audio from Telnyx WebSocket stream.
 * Uses media_format from Telnyx "start" event (encoding, sample_rate, channels).
 * Supported codecs: PCMU (μ-law), PCMA (A-law), L16 (raw 16-bit PCM), OPUS (Web Codecs), G.722 (unsupported – chunk skipped).
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
  const didOpenRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferQueueRef = useRef<AudioBuffer[]>([]);
  const isProcessingRef = useRef(false);
  const mediaFormatRef = useRef<MediaFormat>({ ...DEFAULT_MEDIA_FORMAT });
  const opusDecoderRef = useRef<InstanceType<typeof AudioDecoder> | null>(null);
  const opusTimestampRef = useRef<number>(0);

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
      didOpenRef.current = false;

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
        setError(null); // clear any prior 1006 from a closed-before-open connection
        didOpenRef.current = true;
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
        // Only show error if we had actually opened (avoids 1006 "closed before connection established" from effect cleanup)
        if (event.code !== 1000 && event.code !== 1005 && didOpenRef.current) {
          const detail = event.reason || (event.code === 1006 ? "Connection failed or dropped (1006)" : `Code ${event.code}`);
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
        setError(null); // clear any prior 1006 so UI shows "Playing audio..." once media arrives
        return;
      }

      if (message.event === "start") {
        const start = message.start ?? {};
        const mf = start.media_format;
        if (mf && typeof mf === "object" && typeof mf.encoding === "string") {
          mediaFormatRef.current = {
            encoding: String(mf.encoding).toUpperCase(),
            sample_rate: typeof mf.sample_rate === "number" ? mf.sample_rate : 8000,
            channels: typeof mf.channels === "number" ? mf.channels : 1,
          };
        } else {
          mediaFormatRef.current = { ...DEFAULT_MEDIA_FORMAT };
        }
        opusTimestampRef.current = 0; // reset for new stream (Opus timestamp in µs)
        console.log("[TELEMETRY] AudioStreamPlayer stream started", {
          timestamp: new Date().toISOString(),
          mediaFormat: mediaFormatRef.current,
          callControlId: start.call_control_id,
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
      const fmt = mediaFormatRef.current;
      const sampleRate = fmt.sample_rate > 0 ? fmt.sample_rate : 8000;

      // Decode base64 RTP payload (no RTP headers per Telnyx docs)
      const binaryString = atob(media.payload);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // G.722: not yet supported in browser without WASM; skip chunk to avoid wrong audio
      if (fmt.encoding === "G722" || fmt.encoding === "G.722") {
        console.warn("[TELEMETRY] AudioStreamPlayer G.722 not supported, skipping chunk", {
          timestamp: new Date().toISOString(),
          payloadSize: bytes.length,
        });
        return;
      }

      // Opus: decode via Web Codecs API (raw Opus packets per W3C spec)
      if (fmt.encoding === "OPUS") {
        if (!isOpusDecodeSupported()) {
          console.warn("[TELEMETRY] AudioStreamPlayer Opus not supported (no Web Codecs)", {
            timestamp: new Date().toISOString(),
          });
          return;
        }
        const opusRate = sampleRate > 0 ? sampleRate : 48000;
        if (!opusDecoderRef.current) {
          const AudioDecoderClass = (window as any).AudioDecoder;
          const EncodedAudioChunkClass = (window as any).EncodedAudioChunk;
          opusDecoderRef.current = new AudioDecoderClass({
            output: (audioData: any) => {
              try {
                if (!audioContextRef.current) {
                  audioData.close();
                  return;
                }
                const ctx = audioContextRef.current;
                const numChannels = audioData.numberOfChannels;
                const numFrames = audioData.numberOfFrames;
                const sr = audioData.sampleRate;
                const buffer = ctx.createBuffer(numChannels, numFrames, sr);
                for (let i = 0; i < numChannels; i++) {
                  audioData.copyTo(buffer.getChannelData(i) as ArrayBuffer, { planeIndex: i });
                }
                audioData.close();
                audioBufferQueueRef.current.push(buffer);
                if (!isProcessingRef.current) processAudioQueue();
              } catch (e) {
                console.error("[AudioStreamPlayer] Opus output error:", e);
                try {
                  audioData.close();
                } catch {
                  // ignore
                }
              }
            },
            error: (e: Error) => {
              console.error("[TELEMETRY] AudioStreamPlayer Opus decoder error", e);
            },
          });
          opusDecoderRef.current.configure({
            codec: "opus",
            sampleRate: opusRate,
            numberOfChannels: 1,
          });
        }
        const EncodedAudioChunkClass = (window as any).EncodedAudioChunk;
        const timestamp = opusTimestampRef.current;
        opusTimestampRef.current += (bytes.length / (64000 / 8)) * 1e6; // rough: 64kbps -> duration in µs
        const chunk = new EncodedAudioChunkClass({
          type: "key",
          timestamp,
          data: bytes,
        });
        await opusDecoderRef.current.decode(chunk);
        const processingTime = performance.now() - startTime;
        console.log("[TELEMETRY] AudioStreamPlayer Opus chunk queued", {
          timestamp: new Date().toISOString(),
          payloadSize: media.payload.length,
          processingTimeMs: processingTime.toFixed(2),
        });
        return;
      }

      let pcmData: Int16Array;

      if (fmt.encoding === "L16") {
        // L16: raw 16-bit signed PCM, little-endian (Telnyx bidirectional streaming)
        const numSamples = bytes.length >> 1;
        pcmData = new Int16Array(numSamples);
        for (let i = 0; i < numSamples; i++) {
          pcmData[i] = bytes[i * 2] | (bytes[i * 2 + 1] << 8);
        }
      } else if (fmt.encoding === "PCMA") {
        // PCMA (A-law / G.711) – ITU-T standard decoding
        const ALAW_BIAS = 0x08;
        pcmData = new Int16Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) {
          const alaw = bytes[i] ^ 0x55;
          const sign = (alaw & 0x80) ? -1 : 1;
          const exponent = (alaw >> 4) & 0x07;
          const mantissa = alaw & 0x0f;
          const linear13 = sign * ((((mantissa << 4) + ALAW_BIAS) << exponent) - ALAW_BIAS);
          pcmData[i] = Math.max(-32768, Math.min(32767, linear13 * 4));
        }
      } else {
        // PCMU (μ-law / G.711) – default per Telnyx; also used when encoding unknown
        const MULAW_BIAS = 0x84;
        pcmData = new Int16Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) {
          const mulaw = bytes[i] ^ 0xff;
          const sign = (mulaw & 0x80) ? -1 : 1;
          const exponent = (mulaw >> 4) & 0x07;
          const mantissa = mulaw & 0x0f;
          const linear14 = sign * ((((mantissa << 3) + MULAW_BIAS) << exponent) - MULAW_BIAS);
          pcmData[i] = Math.max(-32768, Math.min(32767, linear14 * 4));
        }
      }

      // Create audio buffer using stream sample_rate from Telnyx media_format
      const buffer = audioContextRef.current.createBuffer(1, pcmData.length, sampleRate);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < pcmData.length; i++) {
        channelData[i] = pcmData[i] / 32768.0;
      }

      audioBufferQueueRef.current.push(buffer);

      const processingTime = performance.now() - startTime;
      console.log("[TELEMETRY] AudioStreamPlayer chunk processed", {
        timestamp: new Date().toISOString(),
        encoding: fmt.encoding,
        sampleRate,
        payloadSize: media.payload.length,
        bufferLength: buffer.length,
        duration: buffer.duration,
        queueLength: audioBufferQueueRef.current.length,
        processingTimeMs: processingTime.toFixed(2),
      });

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

    if (opusDecoderRef.current) {
      try {
        opusDecoderRef.current.close();
      } catch (e) {
        console.warn("[AudioStreamPlayer] Opus decoder close error:", e);
      }
      opusDecoderRef.current = null;
    }
    opusTimestampRef.current = 0;

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
                {error?.includes("1006") && (
                  <li><strong>Code 1006</strong> = connection failed or dropped (no close frame). Verify Railway is up: run <code className="rounded bg-gray-200 px-1 dark:bg-gray-700">curl https://web-socket-streaming-video-production.up.railway.app/health</code> — it should return {`{"status":"ok"}`}.</li>
                )}
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
