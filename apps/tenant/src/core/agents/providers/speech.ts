import "server-only";

export type SttProvider = "deepgram" | "assemblyai" | "telnyx_deepgram";
export type TtsProvider = "telnyx_resemble" | "elevenlabs";

export interface SpeechProviderCapability {
  provider: SttProvider;
  realtime: boolean;
  fileTranscription: boolean;
  diarization: boolean;
  sentiment: boolean;
  topics: boolean;
  summaries: boolean;
  notes: string;
}

export interface VoiceProviderCapability {
  provider: TtsProvider;
  expressive: boolean;
  multilingual: boolean;
  voiceCloning: boolean;
  notes: string;
}

export interface TranscribeRecordingInput {
  provider: SttProvider;
  audioUrl: string;
  language?: string;
  diarize?: boolean;
}

export interface TranscribeRecordingResult {
  provider: SttProvider;
  status: "queued" | "completed";
  transcript?: string;
  raw?: unknown;
  externalId?: string;
}

export const speechProviderCapabilityMatrix: SpeechProviderCapability[] = [
  {
    provider: "deepgram",
    realtime: true,
    fileTranscription: true,
    diarization: true,
    sentiment: true,
    topics: true,
    summaries: true,
    notes:
      "Best for low-latency realtime assist and direct STT/Audio Intelligence usage.",
  },
  {
    provider: "assemblyai",
    realtime: true,
    fileTranscription: true,
    diarization: true,
    sentiment: true,
    topics: true,
    summaries: true,
    notes:
      "Strong for post-call analytics, summarization, PII redaction, and richer transcript intelligence.",
  },
  {
    provider: "telnyx_deepgram",
    realtime: false,
    fileTranscription: true,
    diarization: true,
    sentiment: false,
    topics: false,
    summaries: false,
    notes:
      "Use when customers want Deepgram STT via Telnyx provider abstraction for call recordings.",
  },
];

export const voiceProviderCapabilityMatrix: VoiceProviderCapability[] = [
  {
    provider: "telnyx_resemble",
    expressive: true,
    multilingual: true,
    voiceCloning: true,
    notes:
      "Premium Telnyx voice option backed by Resemble/Chatterbox with expressive speech.",
  },
  {
    provider: "elevenlabs",
    expressive: true,
    multilingual: true,
    voiceCloning: true,
    notes: "High-quality direct synthesis fallback for premium voice experiences.",
  },
];

export function getSpeechProviderCapabilities() {
  return speechProviderCapabilityMatrix;
}

export function getVoiceProviderCapabilities() {
  return voiceProviderCapabilityMatrix;
}

async function transcribeWithDeepgram(
  input: TranscribeRecordingInput
): Promise<TranscribeRecordingResult> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error(
      "DEEPGRAM_API_KEY is missing. Configure Deepgram integration first."
    );
  }

  const params = new URLSearchParams({
    smart_format: "true",
    diarize: String(input.diarize ?? true),
    model: "nova-3",
  });
  if (input.language) params.set("language", input.language);

  const response = await fetch(
    `https://api.deepgram.com/v1/listen?${params.toString()}`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: input.audioUrl }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Deepgram transcription failed (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const transcript =
    ((payload.results as Record<string, unknown> | undefined)
      ?.channels as Array<Record<string, unknown>> | undefined)?.[0]?.alternatives &&
    Array.isArray(
      (
        ((payload.results as Record<string, unknown> | undefined)
          ?.channels as Array<Record<string, unknown>> | undefined)?.[0]
          ?.alternatives as unknown
      )
    )
      ? String(
          (
            (
              ((payload.results as Record<string, unknown> | undefined)
                ?.channels as Array<Record<string, unknown>> | undefined)?.[0]
                ?.alternatives as Array<Record<string, unknown>>
            )?.[0]?.transcript ?? ""
          )
        )
      : "";

  return {
    provider: "deepgram",
    status: "completed",
    transcript,
    raw: payload,
  };
}

async function transcribeWithAssembly(
  input: TranscribeRecordingInput
): Promise<TranscribeRecordingResult> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ASSEMBLYAI_API_KEY is missing. Configure AssemblyAI integration first."
    );
  }

  const response = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      audio_url: input.audioUrl,
      speaker_labels: input.diarize ?? true,
      language_code: input.language,
      sentiment_analysis: true,
      auto_chapters: true,
      summarization: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `AssemblyAI transcription request failed (${response.status}): ${text}`
    );
  }

  const payload = (await response.json()) as Record<string, unknown>;
  return {
    provider: "assemblyai",
    status: "queued",
    externalId: String(payload.id ?? ""),
    raw: payload,
  };
}

async function transcribeViaTelnyxDeepgram(
  input: TranscribeRecordingInput
): Promise<TranscribeRecordingResult> {
  return {
    provider: "telnyx_deepgram",
    status: "queued",
    raw: {
      mode: "telnyx_managed",
      audioUrl: input.audioUrl,
      note: "Use Telnyx Voice API/TeXML transcription settings with Deepgram provider selection.",
    },
  };
}

export async function transcribeRecording(
  input: TranscribeRecordingInput
): Promise<TranscribeRecordingResult> {
  if (input.provider === "deepgram") {
    return transcribeWithDeepgram(input);
  }
  if (input.provider === "assemblyai") {
    return transcribeWithAssembly(input);
  }
  return transcribeViaTelnyxDeepgram(input);
}

