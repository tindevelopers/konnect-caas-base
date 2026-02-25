/** Telnyx media streaming codec options (stream_codec). Shared for UI and server actions. */
export const STREAM_CODEC_OPTIONS = [
  { value: "PCMU", label: "PCMU (μ-law, 8 kHz)" },
  { value: "OPUS", label: "Opus" },
  { value: "PCMA", label: "PCMA (A-law, 8 kHz)" },
  { value: "L16", label: "L16 (16-bit PCM, 16 kHz)" },
] as const;

export type StreamCodecValue = (typeof STREAM_CODEC_OPTIONS)[number]["value"];
