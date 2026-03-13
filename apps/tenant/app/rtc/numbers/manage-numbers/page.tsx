"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Alert from "@/components/ui/alert/Alert";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Switch from "@/components/form/switch/Switch";
import {
  listOwnedPhoneNumbersAction,
  updateOwnedPhoneNumberAction,
  getPhoneNumberVoiceAgentAction,
  setPhoneNumberVoiceAgentAction,
  type TelnyxPhoneNumber,
} from "@/app/actions/telnyx/numbers";
import { listPlatformNumbersAction } from "@/app/actions/twilio/numbers";
import { assignPhoneNumberToMessagingProfileAction } from "@/app/actions/telnyx/messagingProfiles";
import { listTenantAssistantsForVoiceAction } from "@/app/actions/telnyx/assistants";

type UnifiedPhoneNumber = {
  id: string;
  phone_number: string;
  status?: string;
  phone_number_type?: string;
  connection_name?: string | null;
  connection_id?: string | null;
  messaging_profile_id?: string | null;
  messaging_profile_name?: string | null;
  billing_group_id?: string | null;
  customer_reference?: string | null;
  tags?: string[];
  deletion_lock_enabled?: boolean;
  emergency_enabled?: boolean;
  supplier: "telnyx" | "twilio" | "bandwidth";
  record_type?: string;
};

function parseTags(raw: string) {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function ManageNumbersPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [country, setCountry] = useState("");

  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [rows, setRows] = useState<UnifiedPhoneNumber[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  // Edit fields
  const [tagsRaw, setTagsRaw] = useState("");
  const [customerReference, setCustomerReference] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [billingGroupId, setBillingGroupId] = useState("");
  const [deletionLockEnabled, setDeletionLockEnabled] = useState(false);
  const [emergencyEnabled, setEmergencyEnabled] = useState(false);

  const [messagingProfileId, setMessagingProfileId] = useState("");
  const [messagingProduct, setMessagingProduct] = useState("A2P");

  // Voice / AI Assistant (tenant-scoped)
  const [voiceAssistants, setVoiceAssistants] = useState<Array<{ id: string; name: string }>>([]);
  const [voiceAssistantSearch, setVoiceAssistantSearch] = useState("");
  const [selectedVoiceAssistantId, setSelectedVoiceAssistantId] = useState<string>("");
  const [currentNumberVoiceAgentId, setCurrentNumberVoiceAgentId] = useState<string | null>(null);
  const [isLoadingVoiceAgent, setIsLoadingVoiceAgent] = useState(false);
  const [isSavingVoiceAgent, setIsSavingVoiceAgent] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  async function load() {
    setIsLoading(true);
    setError(null);
    setInfo(null);

    try {
      const [telnyxRes, platformRes] = await Promise.allSettled([
        listOwnedPhoneNumbersAction({
          phoneNumberContains: query.trim() || undefined,
          status: status.trim() || undefined,
          countryIsoAlpha2: country.trim() || undefined,
          pageNumber,
          pageSize,
          handleMessagingProfileError: true,
        }),
        listPlatformNumbersAction({ supplier: "twilio" }),
      ]);

      const telnyxNumbers: UnifiedPhoneNumber[] =
        telnyxRes.status === "fulfilled"
          ? (telnyxRes.value.data ?? []).map((n: TelnyxPhoneNumber) => ({ ...n, supplier: "telnyx" as const }))
          : [];

      const twilioNumbers: UnifiedPhoneNumber[] =
        platformRes.status === "fulfilled" && platformRes.value.ok
          ? platformRes.value.data.map((n) => ({
              id: n.id,
              phone_number: n.phone_number_e164,
              status: n.status,
              phone_number_type: n.phone_number_type ?? undefined,
              connection_name: null,
              connection_id: null,
              messaging_profile_id: null,
              messaging_profile_name: null,
              billing_group_id: null,
              customer_reference: n.friendly_name,
              tags: [],
              deletion_lock_enabled: false,
              emergency_enabled: false,
              supplier: "twilio" as const,
            }))
          : [];

      const seen = new Set<string>();
      const merged: UnifiedPhoneNumber[] = [];
      for (const n of [...telnyxNumbers, ...twilioNumbers]) {
        if (!seen.has(n.phone_number)) {
          seen.add(n.phone_number);
          merged.push(n);
        }
      }
      setRows(merged);

      if (telnyxRes.status === "rejected") {
        setError(`Telnyx: ${telnyxRes.reason instanceof Error ? telnyxRes.reason.message : "Failed to load"}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load phone numbers");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, pageSize]);

  useEffect(() => {
    if (!selected) return;
    setTagsRaw((selected.tags ?? []).join(", "));
    setCustomerReference(selected.customer_reference ?? "");
    setConnectionId(selected.connection_id ?? "");
    setBillingGroupId(selected.billing_group_id ?? "");
    setDeletionLockEnabled(Boolean(selected.deletion_lock_enabled));
    setEmergencyEnabled(Boolean(selected.emergency_enabled));
    setMessagingProfileId(selected.messaging_profile_id ?? "");
  }, [selected]);

  // Load tenant assistants for voice dropdown (once)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await listTenantAssistantsForVoiceAction();
      if (cancelled) return;
      if ("data" in res) setVoiceAssistants(res.data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // When selected number changes, load its current voice agent
  useEffect(() => {
    if (!selected?.phone_number) {
      setCurrentNumberVoiceAgentId(null);
      setSelectedVoiceAssistantId("");
      setIsLoadingVoiceAgent(false);
      return;
    }
    let cancelled = false;
    setIsLoadingVoiceAgent(true);
    (async () => {
      const current = await getPhoneNumberVoiceAgentAction(selected.phone_number);
      if (cancelled) return;
      setCurrentNumberVoiceAgentId(current?.telnyx_assistant_id ?? null);
      setSelectedVoiceAssistantId(current?.telnyx_assistant_id ?? "");
      setIsLoadingVoiceAgent(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selected?.phone_number]);

  async function handleApplyFilters() {
    setPageNumber(1);
    await load();
  }

  async function handleSaveEdits() {
    if (!selected) return;
    if (selected.supplier === "twilio") {
      setError("Twilio number properties are managed in the Twilio console.");
      return;
    }
    setIsSaving(true);
    setError(null);
    setInfo(null);
    try {
      await updateOwnedPhoneNumberAction(selected.id, {
        tags: parseTags(tagsRaw),
        customer_reference: customerReference.trim() ? customerReference.trim() : null,
        connection_id: connectionId.trim() ? connectionId.trim() : null,
        billing_group_id: billingGroupId.trim() ? billingGroupId.trim() : null,
        deletion_lock_enabled: deletionLockEnabled,
        emergency_enabled: emergencyEnabled,
      });
      setInfo("Saved phone number updates.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save updates");
    } finally {
      setIsSaving(false);
    }
  }

  const filteredVoiceAssistants = useMemo(() => {
    const q = voiceAssistantSearch.trim().toLowerCase();
    if (!q) return voiceAssistants;
    return voiceAssistants.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q)
    );
  }, [voiceAssistants, voiceAssistantSearch]);

  async function handleAssignVoiceAgent() {
    if (!selected?.phone_number) return;
    const assistantId = selectedVoiceAssistantId.trim() || null;
    setIsSavingVoiceAgent(true);
    setError(null);
    setInfo(null);
    try {
      const result = await setPhoneNumberVoiceAgentAction(
        selected.phone_number,
        assistantId,
        selected.supplier ?? "telnyx"
      );
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setInfo(assistantId ? "Voice agent assigned to this number." : "Voice agent cleared; number will use tenant default.");
      setCurrentNumberVoiceAgentId(assistantId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to assign voice agent");
    } finally {
      setIsSavingVoiceAgent(false);
    }
  }

  async function handleAssignMessagingProfile() {
    if (!selected) return;
    if (!messagingProfileId.trim()) {
      setError("Messaging Profile ID is required.");
      return;
    }
    setIsSaving(true);
    setError(null);
    setInfo(null);
    try {
      await assignPhoneNumberToMessagingProfileAction(selected.id, {
        messaging_profile_id: messagingProfileId.trim(),
        messaging_product: messagingProduct.trim() ? messagingProduct.trim() : null,
      });
      setInfo("Assigned messaging profile to phone number.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to assign messaging profile");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <PageBreadcrumb pageTitle="Manage Numbers" />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white/90">Manage Numbers</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          View and manage phone numbers across all providers (Telnyx, Twilio).
        </p>
      </div>

      {error && (
        <div className="mb-4">
          <Alert variant="error" title="Error" message={error} />
        </div>
      )}
      {info && (
        <div className="mb-4">
          <Alert variant="success" title="Info" message={info} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Filters</h2>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <Label htmlFor="q">Phone number contains</Label>
                <Input
                  id="q"
                  placeholder="e.g. +1970"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Input
                  id="status"
                  placeholder="active"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  placeholder="US"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div>
                <Label htmlFor="ps">Page size</Label>
                <Input
                  id="ps"
                  type="number"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                />
              </div>
              <div className="flex items-end gap-3">
                <Button onClick={handleApplyFilters} disabled={isLoading}>
                  {isLoading ? "Loading…" : "Apply filters"}
                </Button>
                <Button variant="outline" onClick={load} disabled={isLoading}>
                  Refresh
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">All numbers</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                  disabled={pageNumber <= 1 || isLoading}
                >
                  Prev
                </Button>
                <span className="text-sm text-gray-500 dark:text-gray-400">Page {pageNumber}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageNumber((p) => p + 1)}
                  disabled={isLoading}
                >
                  Next
                </Button>
              </div>
            </div>

            {isLoading ? (
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">No phone numbers found.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="py-3 pr-4">Number</th>
                      <th className="py-3 pr-4">Source</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3 pr-4">Type</th>
                      <th className="py-3 pr-4">Connection</th>
                      <th className="py-3 pr-4">Messaging profile</th>
                      <th className="py-3 pr-4">ID</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-800 dark:text-white/90">
                    {rows.map((r) => {
                      const active = r.id === selectedId;
                      return (
                        <tr
                          key={r.id}
                          className={`border-t border-gray-100 dark:border-gray-800 ${
                            active ? "bg-gray-50 dark:bg-white/[0.04]" : ""
                          }`}
                        >
                          <td className="py-3 pr-4">
                            <button
                              className="text-left font-medium hover:underline"
                              onClick={() => setSelectedId(r.id)}
                            >
                              {r.phone_number}
                            </button>
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              r.supplier === "twilio"
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                : "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            }`}>
                              {r.supplier === "twilio" ? "Twilio" : "Telnyx"}
                            </span>
                          </td>
                          <td className="py-3 pr-4">{r.status ?? "-"}</td>
                          <td className="py-3 pr-4">{r.phone_number_type ?? "-"}</td>
                          <td className="py-3 pr-4">{r.connection_name ?? r.connection_id ?? "-"}</td>
                          <td className="py-3 pr-4">{r.messaging_profile_name ?? r.messaging_profile_id ?? "-"}</td>
                          <td className="py-3 pr-4">
                            <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{r.id}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Details</h2>
            {!selected ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Select a phone number to view and edit details.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="text-sm text-gray-700 dark:text-gray-200">
                  <div className="font-medium">{selected.phone_number}</div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    ID: <span className="font-mono">{selected.id}</span>
                  </div>
                </div>

                <div>
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    placeholder="sales, support"
                    value={tagsRaw}
                    onChange={(e) => setTagsRaw(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="cr">Customer reference</Label>
                  <Input
                    id="cr"
                    placeholder="Optional"
                    value={customerReference}
                    onChange={(e) => setCustomerReference(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="cid">Connection ID</Label>
                  <Input
                    id="cid"
                    placeholder="Optional"
                    value={connectionId}
                    onChange={(e) => setConnectionId(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="bg">Billing group ID</Label>
                  <Input
                    id="bg"
                    placeholder="Optional"
                    value={billingGroupId}
                    onChange={(e) => setBillingGroupId(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Switch
                    label="Deletion lock enabled"
                    checked={deletionLockEnabled}
                    onChange={setDeletionLockEnabled}
                  />
                  <Switch
                    label="Emergency enabled"
                    checked={emergencyEnabled}
                    onChange={setEmergencyEnabled}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Button onClick={handleSaveEdits} disabled={isSaving}>
                    {isSaving ? "Saving…" : "Save updates"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Voice / AI Assistant</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Route inbound calls to this number to an AI agent. Only agents available to your tenant are listed.
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="voice-search">Search</Label>
                <Input
                  id="voice-search"
                  placeholder="Search agents…"
                  value={voiceAssistantSearch}
                  onChange={(e) => setVoiceAssistantSearch(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="voice-agent">AI Agent</Label>
                <select
                  id="voice-agent"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white/90"
                  value={selectedVoiceAssistantId}
                  onChange={(e) => setSelectedVoiceAssistantId(e.target.value)}
                  disabled={!selected}
                >
                  <option value="">None – use tenant default</option>
                  {filteredVoiceAssistants.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.id.slice(0, 12)}…)
                    </option>
                  ))}
                  {voiceAssistants.length > 0 && filteredVoiceAssistants.length === 0 && (
                    <option value="" disabled>No agents match search</option>
                  )}
                </select>
              </div>
              {selected && (
                <>
                  {currentNumberVoiceAgentId && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Current: {voiceAssistants.find((a) => a.id === currentNumberVoiceAgentId)?.name ?? currentNumberVoiceAgentId}
                    </p>
                  )}
                  <Button
                    onClick={handleAssignVoiceAgent}
                    disabled={isSavingVoiceAgent || !selected || (selectedVoiceAssistantId === (currentNumberVoiceAgentId ?? ""))}
                  >
                    {isSavingVoiceAgent ? "Saving…" : "Assign to this number"}
                  </Button>
                </>
              )}
            </div>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Set <strong>Connection ID</strong> in Details so calls reach this app; then choose the agent above. No agent = use default from{" "}
              <Link href="/saas/integrations/telephony/telnyx" className="font-medium text-brand-600 hover:underline dark:text-brand-400">Integrations → Telnyx</Link>.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Messaging profile</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Assign this number to a messaging profile.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="mp">Messaging Profile ID</Label>
                <Input
                  id="mp"
                  placeholder="abc85f64-..."
                  value={messagingProfileId}
                  onChange={(e) => setMessagingProfileId(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="prod">Messaging product</Label>
                <Input
                  id="prod"
                  placeholder="A2P"
                  value={messagingProduct}
                  onChange={(e) => setMessagingProduct(e.target.value)}
                />
              </div>

              <Button onClick={handleAssignMessagingProfile} disabled={isSaving || !selected}>
                {isSaving ? "Applying…" : "Assign messaging profile"}
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

