import { WebSocket } from "ws";

type TranscriptEvent = {
  event: "transcript.partial" | "transcript.final";
  provider: "deepgram" | "assemblyai";
  callControlId: string;
  transcript: string;
  confidence?: number;
  speaker?: number;
  metadata?: Record<string, unknown>;
};

type SessionState = {
  provider: "deepgram" | "assemblyai";
  socket: WebSocket;
  bytesIn: number;
};

function extractDeepgramTranscript(payload: Record<string, unknown>) {
  const channel = (
    (payload.channel as Record<string, unknown> | undefined) ??
    (
      ((payload as Record<string, unknown>).channel as
        | Record<string, unknown>
        | undefined)
    )
  ) as Record<string, unknown> | undefined;
  const alternatives = (channel?.alternatives as unknown) as
    | Array<Record<string, unknown>>
    | undefined;
  const alt = alternatives?.[0];
  const transcript = String(alt?.transcript ?? "").trim();
  if (!transcript) return null;
  return {
    transcript,
    isFinal: Boolean(payload.is_final),
    confidence:
      typeof alt?.confidence === "number" ? (alt.confidence as number) : undefined,
    speaker:
      typeof alt?.speaker === "number" ? (alt.speaker as number) : undefined,
  };
}

function extractAssemblyTranscript(payload: Record<string, unknown>) {
  const messageType = String(payload.message_type ?? "");
  if (
    messageType !== "PartialTranscript" &&
    messageType !== "FinalTranscript"
  ) {
    return null;
  }
  const transcript = String(payload.text ?? "").trim();
  if (!transcript) return null;
  return {
    transcript,
    isFinal: messageType === "FinalTranscript",
    confidence:
      typeof payload.confidence === "number"
        ? (payload.confidence as number)
        : undefined,
  };
}

export class RealtimeTranscriptionPipeline {
  private sessions = new Map<string, SessionState>();
  private readonly provider: "deepgram" | "assemblyai" | "disabled";
  private readonly deepgramApiKey: string | null;
  private readonly assemblyApiKey: string | null;
  private readonly onTranscript: (event: TranscriptEvent) => void;

  constructor(args: { onTranscript: (event: TranscriptEvent) => void }) {
    this.onTranscript = args.onTranscript;
    this.provider =
      (process.env.REALTIME_STT_PROVIDER as "deepgram" | "assemblyai" | undefined) ??
      "deepgram";
    this.deepgramApiKey = process.env.DEEPGRAM_API_KEY ?? null;
    this.assemblyApiKey = process.env.ASSEMBLYAI_API_KEY ?? null;
  }

  private createDeepgramSession(callControlId: string): SessionState | null {
    if (!this.deepgramApiKey) return null;
    const url =
      "wss://api.deepgram.com/v1/listen?encoding=mulaw&sample_rate=8000&channels=1&interim_results=true&smart_format=true&diarize=true";
    const socket = new WebSocket(url, {
      headers: {
        Authorization: `Token ${this.deepgramApiKey}`,
      },
    });

    socket.on("message", (raw) => {
      try {
        const payload = JSON.parse(raw.toString()) as Record<string, unknown>;
        const parsed = extractDeepgramTranscript(payload);
        if (!parsed) return;
        this.onTranscript({
          event: parsed.isFinal ? "transcript.final" : "transcript.partial",
          provider: "deepgram",
          callControlId,
          transcript: parsed.transcript,
          confidence: parsed.confidence,
          speaker: parsed.speaker,
        });
      } catch (error) {
        console.error("[RealtimeTranscription] Deepgram message parse error:", error);
      }
    });

    socket.on("error", (error) => {
      console.error("[RealtimeTranscription] Deepgram socket error:", error);
    });

    return {
      provider: "deepgram",
      socket,
      bytesIn: 0,
    };
  }

  private createAssemblySession(callControlId: string): SessionState | null {
    if (!this.assemblyApiKey) return null;
    const url =
      "wss://api.assemblyai.com/v2/realtime/ws?sample_rate=8000&encoding=pcm_mulaw";
    const socket = new WebSocket(url, {
      headers: {
        Authorization: this.assemblyApiKey,
      },
    });

    socket.on("message", (raw) => {
      try {
        const payload = JSON.parse(raw.toString()) as Record<string, unknown>;
        const parsed = extractAssemblyTranscript(payload);
        if (!parsed) return;
        this.onTranscript({
          event: parsed.isFinal ? "transcript.final" : "transcript.partial",
          provider: "assemblyai",
          callControlId,
          transcript: parsed.transcript,
          confidence: parsed.confidence,
        });
      } catch (error) {
        console.error("[RealtimeTranscription] AssemblyAI message parse error:", error);
      }
    });

    socket.on("error", (error) => {
      console.error("[RealtimeTranscription] AssemblyAI socket error:", error);
    });

    return {
      provider: "assemblyai",
      socket,
      bytesIn: 0,
    };
  }

  private getOrCreateSession(callControlId: string) {
    const existing = this.sessions.get(callControlId);
    if (existing) return existing;

    const session =
      this.provider === "assemblyai"
        ? this.createAssemblySession(callControlId)
        : this.provider === "deepgram"
          ? this.createDeepgramSession(callControlId)
          : null;

    if (!session) return null;
    this.sessions.set(callControlId, session);
    return session;
  }

  handleMediaChunk(callControlId: string, payloadBase64: string) {
    if (!callControlId || !payloadBase64) return;
    const session = this.getOrCreateSession(callControlId);
    if (!session) return;

    if (session.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const audio = Buffer.from(payloadBase64, "base64");
    session.bytesIn += audio.length;

    if (session.provider === "deepgram") {
      session.socket.send(audio);
      return;
    }

    session.socket.send(
      JSON.stringify({
        audio_data: payloadBase64,
      })
    );
  }

  closeCall(callControlId: string) {
    const session = this.sessions.get(callControlId);
    if (!session) return;
    try {
      if (session.provider === "deepgram" && session.socket.readyState === WebSocket.OPEN) {
        session.socket.send(JSON.stringify({ type: "CloseStream" }));
      }
      if (
        session.provider === "assemblyai" &&
        session.socket.readyState === WebSocket.OPEN
      ) {
        session.socket.send(JSON.stringify({ terminate_session: true }));
      }
      session.socket.close();
    } catch (error) {
      console.error("[RealtimeTranscription] Failed closing STT session:", error);
    } finally {
      this.sessions.delete(callControlId);
    }
  }
}

