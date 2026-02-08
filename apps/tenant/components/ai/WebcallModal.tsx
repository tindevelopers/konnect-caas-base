"use client";

import React, { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import { TelnyxRTC } from "@telnyx/webrtc";

interface WebcallModalProps {
  isOpen: boolean;
  onClose: () => void;
  assistantId: string;
  credentials?: {
    login?: string;
    password?: string;
    login_token?: string;
  };
}

export default function WebcallModal({
  isOpen,
  onClose,
  assistantId,
  credentials,
}: WebcallModalProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [callState, setCallState] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  
  const clientRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Telnyx WebRTC client
  useEffect(() => {
    if (!isOpen || !credentials) return;

    const initClient = async () => {
      try {
        console.log("[TELEMETRY] WebcallModal - Initializing Telnyx WebRTC client", {
          timestamp: new Date().toISOString(),
          assistantId,
          hasCredentials: !!credentials,
          TelnyxRTCType: typeof TelnyxRTC,
        });

        if (!TelnyxRTC || typeof TelnyxRTC !== 'function') {
          throw new Error(`TelnyxRTC is not a constructor. Type: ${typeof TelnyxRTC}`);
        }

        // Create client with credentials
        const client = new TelnyxRTC({
          ...(credentials.login_token
            ? { login_token: credentials.login_token }
            : {
                login: credentials.login,
                password: credentials.password,
              }),
        });

        clientRef.current = client;

        // Set up audio element for remote audio
        // Wait a tick to ensure audio element is mounted
        await new Promise(resolve => setTimeout(resolve, 100));
        if (audioElementRef.current) {
          client.remoteElement = audioElementRef.current.id;
          console.log("[TELEMETRY] WebcallModal - Audio element configured", {
            timestamp: new Date().toISOString(),
            elementId: audioElementRef.current.id,
          });
        } else {
          console.warn("[TELEMETRY] WebcallModal - Audio element not found", {
            timestamp: new Date().toISOString(),
          });
        }

        // Event listeners
        client
          .on("telnyx.ready", () => {
            console.log("[TELEMETRY] WebcallModal - Client ready", {
              timestamp: new Date().toISOString(),
            });
            setIsConnected(true);
            setError(null);
            setPermissionError(null);
          })
          .on("telnyx.error", (error: any) => {
            console.error("[TELEMETRY] WebcallModal - Client error", {
              timestamp: new Date().toISOString(),
              error: error.message || String(error),
              errorType: error.type,
            });
            
            // Check if it's a permission error
            const errorMessage = error.message || String(error);
            if (errorMessage.includes("Permission denied") || errorMessage.includes("NotAllowedError")) {
              setPermissionError("Microphone permission denied. Please allow microphone access in your browser settings.");
            }
            
            setError(errorMessage || "Connection error");
            setIsConnected(false);
          })
          .on("telnyx.notification", (notification: any) => {
            console.log("[TELEMETRY] WebcallModal - Notification", {
              timestamp: new Date().toISOString(),
              type: notification.type,
              callState: notification.call?.state,
            });

            if (notification.type === "callUpdate") {
              const call = notification.call;
              if (call) {
                callRef.current = call;
                setCallState(call.state || "");

                // Handle call states
                if (call.state === "active") {
                  setIsCalling(true);
                  setError(null);
                  setPermissionError(null);
                } else if (call.state === "hangup" || call.state === "destroy") {
                  setIsCalling(false);
                  handleHangUp();
                }
              }
            } else if (notification.type === "userMediaError") {
              console.error("[TELEMETRY] WebcallModal - User media error", {
                timestamp: new Date().toISOString(),
                error: notification.error,
              });
              setPermissionError("Microphone access denied. Please allow microphone access in your browser settings.");
              setIsCalling(false);
            } else if (notification.type === "peerConnectionFailureError") {
              console.error("[TELEMETRY] WebcallModal - Peer connection failure", {
                timestamp: new Date().toISOString(),
                error: notification.error,
              });
              setError("Connection failed. Please check your network connection.");
            }
          });

        // Connect client
        await client.connect();
      } catch (err) {
        console.error("[TELEMETRY] WebcallModal - Initialization error", {
          timestamp: new Date().toISOString(),
          error: err instanceof Error ? err.message : String(err),
        });
        setError(err instanceof Error ? err.message : "Failed to initialize WebRTC client");
      }
    };

    initClient();

    // Cleanup on unmount
    return () => {
      if (callRef.current) {
        try {
          callRef.current.hangup();
        } catch {
          // ignore
        }
      }
      if (clientRef.current) {
        try {
          clientRef.current.disconnect();
        } catch {
          // ignore
        }
      }
    };
  }, [isOpen, credentials, assistantId]);

  // Generate audio waveform visualization
  useEffect(() => {
    if (!isOpen || !isCalling) {
      setAudioLevels([]);
      return;
    }

    const interval = setInterval(() => {
      try {
        // Generate random audio levels for visualization (in real app, use actual audio levels)
        const levels = Array.from({ length: 50 }, () => Math.random() * 100);
        setAudioLevels(levels);
      } catch (err) {
        console.error("[TELEMETRY] WebcallModal - Error generating audio levels", {
          timestamp: new Date().toISOString(),
          error: err instanceof Error ? err.message : String(err),
        });
        // Fallback to empty array if there's an error
        setAudioLevels([]);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen, isCalling]);

  const handleStartCall = async () => {
    if (!clientRef.current || !isConnected) {
      setError("Client not ready. Please wait for connection.");
      return;
    }

    try {
      // Request microphone permission before starting call
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Permission granted - stop the stream as Telnyx will handle it
        stream.getTracks().forEach(track => track.stop());
        setPermissionError(null);
      } catch (mediaError: any) {
        console.error("[TELEMETRY] WebcallModal - Microphone permission denied", {
          timestamp: new Date().toISOString(),
          error: mediaError.message || String(mediaError),
          name: mediaError.name,
        });
        
        if (mediaError.name === "NotAllowedError" || mediaError.name === "PermissionDeniedError") {
          setPermissionError("Microphone permission denied. Please allow microphone access in your browser settings and try again.");
          return;
        }
        throw mediaError;
      }

      console.log("[TELEMETRY] WebcallModal - Starting webcall", {
        timestamp: new Date().toISOString(),
        assistantId,
      });

      // For Telnyx AI Assistants webcall, we call the assistant's phone number
      // The assistant ID is used to route to the correct AI assistant
      // Format: Call the assistant's configured phone number or use assistant ID
      // Note: This may need to be adjusted based on your Telnyx configuration
      const destination = assistantId; // Use assistant ID directly, or get phone number from assistant config
      
      const call = clientRef.current.newCall({
        callerIdNumber: "webcall",
        destinationNumber: destination,
        // Add assistant context in custom headers
        customHeaders: {
          "X-Assistant-ID": assistantId,
        },
      });

      callRef.current = call;
      setIsCalling(true);
      setError(null);
      setPermissionError(null);
    } catch (err) {
      console.error("[TELEMETRY] WebcallModal - Call start error", {
        timestamp: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      setError(err instanceof Error ? err.message : "Failed to start call");
    }
  };

  const handleHangUp = () => {
    if (callRef.current) {
      try {
        callRef.current.hangup();
      } catch (err) {
        console.error("[TELEMETRY] WebcallModal - Hangup error", {
          timestamp: new Date().toISOString(),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    setIsCalling(false);
    setCallState("");
    callRef.current = null;
  };

  const handleMuteToggle = () => {
    if (callRef.current) {
      try {
        if (isMuted) {
          callRef.current.unmute();
        } else {
          callRef.current.mute();
        }
        setIsMuted(!isMuted);
      } catch (err) {
        console.error("[TELEMETRY] WebcallModal - Mute toggle error", {
          timestamp: new Date().toISOString(),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  };

  const handleClose = () => {
    handleHangUp();
    if (clientRef.current) {
      try {
        clientRef.current.disconnect();
      } catch {
        // ignore
      }
    }
    setIsConnected(false);
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      className="relative w-full max-w-[480px] m-5 sm:m-0 rounded-3xl bg-white p-8 dark:bg-gray-900"
    >
      <div className="text-center">
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
          {isCalling ? "Connected" : isConnected ? "Ready to Call" : "Connecting..."}
        </h3>

        {/* Audio Waveform Visualization */}
        {(isCalling || isConnected) && (
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
              // Placeholder bars
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
        )}

        {/* Status Info */}
        <div className="mb-6 space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <div>
            <span className="font-medium">Status:</span>{" "}
            <span className="capitalize">{callState || (isConnected ? "Ready" : "Connecting")}</span>
          </div>
          {assistantId && (
            <div>
              <span className="font-medium">Assistant ID:</span>{" "}
              <span className="font-mono text-xs">{assistantId}</span>
            </div>
          )}
        </div>

        {/* Hidden audio element for remote audio */}
        <audio
          id="remoteMedia"
          ref={audioElementRef}
          autoPlay
          playsInline
          style={{ display: "none" }}
          onError={(e) => {
            console.error("[TELEMETRY] WebcallModal - Audio element error", {
              timestamp: new Date().toISOString(),
              error: e.currentTarget.error?.message,
            });
          }}
        />

        {/* Permission Error Display */}
        {permissionError && (
          <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
            <div className="font-medium mb-1">⚠️ Microphone Permission Required</div>
            <div>{permissionError}</div>
            <div className="mt-2 text-xs">
              <strong>How to fix:</strong>
              <ol className="list-decimal list-inside mt-1 space-y-1">
                <li>Click the lock/info icon in your browser's address bar</li>
                <li>Find "Microphone" and set it to "Allow"</li>
                <li>Refresh the page and try again</li>
              </ol>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && !permissionError && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-3 justify-center">
          {!isCalling && isConnected && (
            <Button
              onClick={handleStartCall}
              className="min-w-[120px] bg-green-600 hover:bg-green-700 text-white"
            >
              Start Call
            </Button>
          )}
          {isCalling && (
            <>
              <Button
                variant="outline"
                onClick={handleMuteToggle}
                className="min-w-[120px]"
              >
                {isMuted ? "Unmute" : "Mute"}
              </Button>
              <Button
                onClick={handleHangUp}
                className="min-w-[120px] bg-red-600 hover:bg-red-700 text-white"
              >
                Hang up
              </Button>
            </>
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
    </Modal>
  );
}
