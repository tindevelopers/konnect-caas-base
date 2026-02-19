"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Alert from "@/components/ui/alert/Alert";
import { ISO_COUNTRIES, isIsoAlpha2 } from "@/src/lib/isoCountries";
import {
  getOutboundVoiceProfileAction,
  listOutboundVoiceProfilesAction,
  updateOutboundVoiceProfileDestinationsAction,
  type TelnyxOutboundVoiceProfile,
} from "@/app/actions/telnyx/outbound-voice-profiles";

export default function VoiceSettingsClient() {
  const [profiles, setProfiles] = useState<TelnyxOutboundVoiceProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [whitelisted, setWhitelisted] = useState<string[]>([]);
  const [savedWhitelisted, setSavedWhitelisted] = useState<string[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [destinationQuery, setDestinationQuery] = useState("");

  const selectAll = useMemo(() => whitelisted.length === ISO_COUNTRIES.length, [whitelisted.length]);

  const filteredCountries = useMemo(() => {
    const q = destinationQuery.trim().toLowerCase();
    if (!q) return ISO_COUNTRIES;
    return ISO_COUNTRIES.filter(
      (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }, [destinationQuery]);

  useEffect(() => {
    let cancelled = false;
    setLoadingProfiles(true);
    setProfileError(null);
    listOutboundVoiceProfilesAction()
      .then((res) => {
        if (cancelled) return;
        setProfiles(res.data ?? []);
        if (res.error) setProfileError(res.error);
        if (res.data?.length && !selectedProfileId) setSelectedProfileId(res.data[0].id);
      })
      .finally(() => {
        if (!cancelled) setLoadingProfiles(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedProfileId) {
      setWhitelisted([]);
      setSavedWhitelisted([]);
      return;
    }
    let cancelled = false;
    setLoadingProfile(true);
    getOutboundVoiceProfileAction(selectedProfileId)
      .then((res) => {
        if (cancelled) return;
        const list = res.data?.whitelisted_destinations ?? [];
        const normalized = list.map((c) => String(c).toUpperCase()).filter(isIsoAlpha2);
        setWhitelisted(normalized);
        setSavedWhitelisted(normalized);
      })
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProfileId]);

  const handleSelectAll = useCallback(() => {
    if (selectAll) {
      setWhitelisted([]);
    } else {
      setWhitelisted(ISO_COUNTRIES.map((c) => c.code));
    }
  }, [selectAll]);

  const handleSave = useCallback(async () => {
    if (!selectedProfileId) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const codes = whitelisted.map((c) => c.toUpperCase()).filter(isIsoAlpha2);
      const res = await updateOutboundVoiceProfileDestinationsAction(selectedProfileId, codes);
      if (res.error) {
        setSaveError(res.error);
        return;
      }
      setSavedWhitelisted(codes);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }, [selectedProfileId, whitelisted]);

  const handleReset = useCallback(() => {
    setWhitelisted([...savedWhitelisted]);
  }, [savedWhitelisted]);

  const isDirty = useMemo(() => {
    if (whitelisted.length !== savedWhitelisted.length) return true;
    const a = new Set(whitelisted);
    const b = new Set(savedWhitelisted);
    if (a.size !== b.size) return true;
    for (const c of a) if (!b.has(c)) return true;
    return false;
  }, [whitelisted, savedWhitelisted]);

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Outbound voice profiles</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Manage allowed destinations (whitelisted countries) for outbound calls. If you see &quot;Dialed number is not
          included in whitelisted countries&quot; (D13), add that country below and save.
        </p>
      </div>

      {profileError && (
        <Alert variant="warning" title="Profiles" onDismiss={() => setProfileError(null)}>
          {profileError}
        </Alert>
      )}

      <div>
        <Label htmlFor="voice-profile">Profile</Label>
        {loadingProfiles ? (
          <p className="text-sm text-gray-500">Loading profiles…</p>
        ) : profiles.length === 0 ? (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            No outbound voice profiles found. Create one in your Telephony provider (e.g. Telnyx) and link it to your
            Call Control connection.
          </p>
        ) : (
          <select
            id="voice-profile"
            className="mt-1 w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white/90"
            value={selectedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.connections_count != null ? `(${p.connections_count} connections)` : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedProfileId && (
        <>
          <div className="border-t border-gray-200 pt-6 dark:border-gray-800">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white/90">Allowed Destinations</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Select which countries can be called using this outbound voice profile. Outbound calls to other
              countries will be blocked (D13).
            </p>
          </div>

          {loadingProfile ? (
            <p className="text-sm text-gray-500">Loading destinations…</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-4">
                <Button type="button" variant="secondary" size="sm" onClick={handleSelectAll}>
                  {selectAll ? "Deselect all" : "Select all destinations"}
                </Button>
                <div className="min-w-[200px] flex-1">
                  <Input
                    id="dest-search"
                    placeholder="Search countries…"
                    value={destinationQuery}
                    onChange={(e) => setDestinationQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="max-h-[420px] overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
                <div className="grid grid-cols-1 gap-0 sm:grid-cols-2">
                  {filteredCountries.map((c) => {
                    const checked = whitelisted.includes(c.code);
                    return (
                      <label
                        key={c.code}
                        className="flex cursor-pointer items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 last:border-b-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/[0.03]"
                      >
                        <span className="text-sm text-gray-800 dark:text-white/90">
                          {c.name} <span className="text-xs text-gray-500">({c.code})</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setWhitelisted((prev) =>
                              checked ? prev.filter((x) => x !== c.code) : [...prev, c.code]
                            );
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                {whitelisted.length} selected. Same list is used by the OB profile associated with your Call Control
                connection.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={saving || !isDirty}
                  onClick={handleSave}
                >
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!isDirty || saving}
                  onClick={handleReset}
                >
                  Reset
                </Button>
                {saveSuccess && (
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">Saved.</span>
                )}
              </div>

              {saveError && (
                <Alert variant="error" title="Save failed" onDismiss={() => setSaveError(null)}>
                  {saveError}
                </Alert>
              )}
            </>
          )}
        </>
      )}

      {selectedProfile && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Profile &quot;{selectedProfile.name}&quot; is applied to Call Control connections that use this outbound
          voice profile. Update allowed destinations here to fix D13 errors without using the provider portal.
        </p>
      )}
    </div>
  );
}
