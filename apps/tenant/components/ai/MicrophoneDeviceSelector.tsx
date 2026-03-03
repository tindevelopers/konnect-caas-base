"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  getAudioInputDevices,
  getPreferredMicrophoneId,
  setPreferredMicrophoneId,
  type AudioInputDevice,
} from "@/src/lib/microphone-settings";

export default function MicrophoneDeviceSelector() {
  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionPrompt, setPermissionPrompt] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setPermissionPrompt(false);
    try {
      let list = await getAudioInputDevices();
      if (list.length > 0 && list.every((d) => !d.label || d.label.startsWith("Microphone "))) {
        setPermissionPrompt(true);
      } else {
        setPermissionPrompt(false);
      }
      setDevices(list);
      const preferred = getPreferredMicrophoneId();
      setSelectedId(preferred && list.some((d) => d.deviceId === preferred) ? preferred : list[0]?.deviceId ?? null);
    } catch {
      setDevices([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  const requestPermissionAndReload = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      // ignore
    }
    await loadDevices();
  }, [loadDevices]);

  const handleSave = useCallback(() => {
    setPreferredMicrophoneId(selectedId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [selectedId]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        Microphone for Telnyx widget (voice)
      </h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Choose which microphone to use when starting a voice conversation in the Test Chat widget.
        Stored in this browser only.
      </p>
      {permissionPrompt && (
        <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
          Microphone names are hidden until you grant access. Click &quot;Allow microphone&quot; to
          see device names, then pick your preferred device (e.g. Bluetooth).
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {loading ? (
          <p className="text-sm text-gray-500">Loading devices…</p>
        ) : devices.length === 0 ? (
          <p className="text-sm text-gray-500">
            No microphones found. Grant microphone access and refresh.
          </p>
        ) : (
          <>
            <select
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(e.target.value || null)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              aria-label="Preferred microphone"
            >
              <option value="">Default (browser choice)</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              {saved ? "Saved" : "Save"}
            </button>
            {permissionPrompt && (
              <button
                type="button"
                onClick={() => void requestPermissionAndReload()}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
              >
                Allow microphone & refresh
              </button>
            )}
            <button
              type="button"
              onClick={() => void loadDevices()}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              Refresh list
            </button>
          </>
        )}
      </div>
    </div>
  );
}
