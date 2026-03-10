/**
 * In-memory voice/widget diagnostics for Telnyx widget (microphone, getUserMedia, etc.).
 * Used to capture logs for "Copy diagnostics" and support troubleshooting.
 */

const MAX_ENTRIES = 80;

export interface DiagnosticEntry {
  ts: string;
  tag: string;
  message: string;
  detail?: Record<string, unknown>;
}

const buffer: DiagnosticEntry[] = [];

function iso(): string {
  return new Date().toISOString();
}

export function voiceDiagnosticsLog(
  tag: string,
  message: string,
  detail?: Record<string, unknown>
): void {
  const entry: DiagnosticEntry = { ts: iso(), tag, message, detail };
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer.shift();
  console.log(`[VoiceDiag] ${tag} ${message}`, detail ?? "");
}

export function voiceDiagnosticsGetBuffer(): DiagnosticEntry[] {
  return [...buffer];
}

export function voiceDiagnosticsGetCopyText(): string {
  return buffer
    .map((e) => {
      const d = e.detail ? ` ${JSON.stringify(e.detail)}` : "";
      return `${e.ts} [${e.tag}] ${e.message}${d}`;
    })
    .join("\n");
}

export function voiceDiagnosticsClear(): void {
  buffer.length = 0;
}

/**
 * Patch navigator.mediaDevices.getUserMedia to log audio requests and results.
 * Returns an uninstall function.
 */
export function installGetUserMediaLogger(): () => void {
  const nav = typeof navigator !== "undefined" ? navigator : null;
  const mediaDevices = nav?.mediaDevices;
  if (!mediaDevices?.getUserMedia) return () => {};

  const original = mediaDevices.getUserMedia.bind(mediaDevices);
  mediaDevices.getUserMedia = function (
    constraints: MediaStreamConstraints
  ): Promise<MediaStream> {
    const audio = constraints.audio;
    const deviceId =
      typeof audio === "object" && audio && "deviceId" in audio
        ? (audio as { deviceId?: { exact?: string } }).deviceId
        : undefined;
    voiceDiagnosticsLog("getUserMedia", "request", {
      hasAudio: !!constraints.audio,
      hasVideo: !!constraints.video,
      deviceId: deviceId && typeof deviceId === "object" && "exact" in deviceId ? (deviceId as { exact?: string }).exact : deviceId,
    });
    return original(constraints).then(
      (stream) => {
        const audioTracks = stream.getAudioTracks();
        voiceDiagnosticsLog("getUserMedia", "success", {
          audioTrackCount: audioTracks.length,
          labels: audioTracks.map((t) => t.label),
          enabled: audioTracks.map((t) => t.enabled),
        });
        return stream;
      },
      (err) => {
        voiceDiagnosticsLog("getUserMedia", "error", {
          name: err?.name,
          message: err?.message,
        });
        throw err;
      }
    );
  };

  return () => {
    mediaDevices.getUserMedia = original;
  };
}
