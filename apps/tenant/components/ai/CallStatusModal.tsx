"use client";

import React, { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";

interface CallStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  callControlId: string;
  conversationId?: string | null;
  onHangUp: () => void | Promise<void>;
  isHangingUp?: boolean;
}

export default function CallStatusModal({
  isOpen,
  onClose,
  callControlId,
  conversationId,
  onHangUp,
  isHangingUp = false,
}: CallStatusModalProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevels, setAudioLevels] = useState<number[]>([]);

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
