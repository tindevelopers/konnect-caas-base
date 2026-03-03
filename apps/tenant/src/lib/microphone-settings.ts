/**
 * Preferred microphone device for Telnyx widget (voice input).
 * Stored in localStorage; device IDs are browser-specific so we don't persist to server.
 */

const STORAGE_KEY = "telnyx_widget_preferred_microphone_id";

export function getPreferredMicrophoneId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setPreferredMicrophoneId(deviceId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (deviceId) {
      localStorage.setItem(STORAGE_KEY, deviceId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

export interface AudioInputDevice {
  deviceId: string;
  label: string;
  groupId: string;
}

/**
 * Enumerate audio input devices. Requires user to have granted mic permission at least once.
 */
export async function getAudioInputDevices(): Promise<AudioInputDevice[]> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
    return [];
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === "audioinput")
      .map((d) => ({
        deviceId: d.deviceId,
        label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
        groupId: d.groupId,
      }));
  } catch {
    return [];
  }
}

/**
 * Build MediaTrackConstraints for getUserMedia from preferred deviceId.
 */
export function getAudioConstraints(preferredDeviceId: string | null): MediaTrackConstraints {
  if (preferredDeviceId?.trim()) {
    return { deviceId: { exact: preferredDeviceId.trim() } };
  }
  return { audio: true };
}
