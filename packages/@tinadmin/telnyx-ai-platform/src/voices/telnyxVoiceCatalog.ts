export type VoiceProviderId = "telnyx";

export type VoiceModelId = "KokoroTTS";

export type VoiceOption = {
  /** Full VoiceConfig value used by Telnyx Call Control, e.g. Telnyx.KokoroTTS.af_bella */
  value: string;
  /** Short voice id portion (after Telnyx.<model>.) */
  voiceId: string;
  /** Human-friendly label */
  label: string;
  /** Optional tags for grouping/search in the future */
  tags?: string[];
};

export type ModelOption = { id: VoiceModelId; label: string };

export const voiceProviders: Array<{ id: VoiceProviderId; label: string }> = [
  { id: "telnyx", label: "Telnyx" },
];

export const modelsByProvider: Record<VoiceProviderId, ModelOption[]> = {
  telnyx: [{ id: "KokoroTTS", label: "KokoroTTS" }],
};

const kokoroVoices: Array<{ voiceId: string; label: string; tags?: string[] }> =
  [
    // Minimal curated set to start; expand as needed.
    { voiceId: "af", label: "American Female (af) — Default", tags: ["en-US", "female"] },
    { voiceId: "af_bella", label: "American Female — Bella", tags: ["en-US", "female"] },
    { voiceId: "af_nicole", label: "American Female — Nicole", tags: ["en-US", "female"] },
    { voiceId: "af_sarah", label: "American Female — Sarah", tags: ["en-US", "female"] },
    { voiceId: "af_sky", label: "American Female — Sky", tags: ["en-US", "female"] },
    { voiceId: "am_adam", label: "American Male — Adam", tags: ["en-US", "male"] },
    { voiceId: "am_michael", label: "American Male — Michael", tags: ["en-US", "male"] },
    { voiceId: "bf_emma", label: "British Female — Emma", tags: ["en-GB", "female"] },
    { voiceId: "bf_isabella", label: "British Female — Isabella", tags: ["en-GB", "female"] },
    { voiceId: "bm_george", label: "British Male — George", tags: ["en-GB", "male"] },
    { voiceId: "bm_lewis", label: "British Male — Lewis", tags: ["en-GB", "male"] },
  ];

export const voicesByProviderModel: Record<
  VoiceProviderId,
  Partial<Record<VoiceModelId, VoiceOption[]>>
> = {
  telnyx: {
    KokoroTTS: kokoroVoices.map((v) => ({
      value: `Telnyx.KokoroTTS.${v.voiceId}`,
      voiceId: v.voiceId,
      label: v.label,
      tags: v.tags,
    })),
  },
};

export function parseTelnyxVoiceConfig(voice: string): {
  provider: VoiceProviderId;
  model: string;
  voiceId: string;
} | null {
  const trimmed = voice?.trim?.() ? voice.trim() : "";
  if (!trimmed.startsWith("Telnyx.")) return null;
  const parts = trimmed.split(".");
  if (parts.length < 3) return null;
  const [, model, ...rest] = parts;
  const voiceId = rest.join(".");
  if (!model || !voiceId) return null;
  return { provider: "telnyx", model, voiceId };
}

export function isVoiceInCatalog(value: string): boolean {
  const v = value?.trim?.() ? value.trim() : "";
  if (!v) return false;
  const providers = Object.values(voicesByProviderModel);
  for (const byModel of providers) {
    for (const list of Object.values(byModel)) {
      if (!list) continue;
      if (list.some((opt) => opt.value === v)) return true;
    }
  }
  return false;
}

