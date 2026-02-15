"use client";

import React, { useEffect, useMemo, useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Alert from "@/components/ui/alert/Alert";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import {
  confirmPortingOrderAction,
  createPortingOrderAction,
  listPortingOrdersAction,
  updatePortingOrderAction,
  type TelnyxPortingOrder,
} from "@/app/actions/telnyx/numbers";

function parsePhoneNumbers(raw: string) {
  return raw
    .split(/[\n,]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseTags(raw: string) {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function extractCreatedPortingOrderId(res: unknown): string | null {
  const anyRes = res as any;
  const data = anyRes?.data;
  if (typeof data?.id === "string") return data.id;
  if (Array.isArray(data) && typeof data?.[0]?.id === "string") return data[0].id;
  if (typeof anyRes?.id === "string") return anyRes.id;
  if (Array.isArray(anyRes) && typeof anyRes?.[0]?.id === "string") return anyRes[0].id;
  return null;
}

export default function PortNumbersPage() {
  const [orders, setOrders] = useState<TelnyxPortingOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const selected = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  );

  // Create draft
  const [draftNumbersRaw, setDraftNumbersRaw] = useState("");
  const [customerReference, setCustomerReference] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Minimal edits for draft/selected order
  const [webhookUrl, setWebhookUrl] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [messagingProfileId, setMessagingProfileId] = useState("");
  const [billingGroupId, setBillingGroupId] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");

  const [isSaving, setIsSaving] = useState(false);

  async function load() {
    setIsLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await listPortingOrdersAction({ pageNumber: 1, pageSize: 25 });
      setOrders(res.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load porting orders");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    // Keep edit panel in sync with selection, but don't overwrite user input if nothing selected.
    if (!selected) return;
    setWebhookUrl((selected as any)?.webhook_url ?? "");
    const cfg = (selected as any)?.phone_number_configuration ?? {};
    setConnectionId(cfg?.connection_id ?? "");
    setMessagingProfileId(cfg?.messaging_profile_id ?? "");
    setBillingGroupId(cfg?.billing_group_id ?? "");
    setTagsRaw(Array.isArray(cfg?.tags) ? cfg.tags.join(", ") : "");
  }, [selected]);

  async function handleCreateDraft() {
    setError(null);
    setInfo(null);
    setIsCreating(true);
    try {
      const phoneNumbers = parsePhoneNumbers(draftNumbersRaw);
      if (phoneNumbers.length === 0) throw new Error("Enter at least one E.164 phone number.");

      const res = await createPortingOrderAction({
        phoneNumbers,
        customerReference: customerReference.trim() || undefined,
      });
      const id = extractCreatedPortingOrderId(res);
      if (!id) throw new Error("Porting order created but no id was returned.");

      setInfo(`Created draft porting order: ${id}`);
      await load();
      setSelectedOrderId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create porting order");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSaveEdits() {
    if (!selectedOrderId) return;
    setError(null);
    setInfo(null);
    setIsSaving(true);
    try {
      const patch: Record<string, unknown> = {};
      if (webhookUrl.trim()) patch.webhook_url = webhookUrl.trim();

      const cfg: Record<string, unknown> = {};
      if (connectionId.trim()) cfg.connection_id = connectionId.trim();
      if (messagingProfileId.trim()) cfg.messaging_profile_id = messagingProfileId.trim();
      if (billingGroupId.trim()) cfg.billing_group_id = billingGroupId.trim();
      const tags = parseTags(tagsRaw);
      if (tags.length) cfg.tags = tags;
      if (Object.keys(cfg).length) patch.phone_number_configuration = cfg;

      if (Object.keys(patch).length === 0) {
        setInfo("No changes to save.");
        return;
      }

      await updatePortingOrderAction(selectedOrderId, patch);
      setInfo("Updated porting order.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update porting order");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirm() {
    if (!selectedOrderId) return;
    setError(null);
    setInfo(null);
    setIsSaving(true);
    try {
      await confirmPortingOrderAction(selectedOrderId);
      setInfo("Submitted porting order.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit porting order");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <PageBreadcrumb pageTitle="Port Numbers" />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white/90">Port Numbers</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Create and manage Telnyx porting orders (draft → confirm).
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
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Porting orders</h2>
              <Button variant="outline" onClick={load} disabled={isLoading}>
                {isLoading ? "Loading…" : "Refresh"}
              </Button>
            </div>

            {isLoading ? (
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
            ) : orders.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">No porting orders found.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="py-3 pr-4">ID</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3 pr-4">Count</th>
                      <th className="py-3 pr-4">Customer ref</th>
                      <th className="py-3 pr-4">Created</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-800 dark:text-white/90">
                    {orders.map((o) => {
                      const active = o.id === selectedOrderId;
                      return (
                        <tr
                          key={o.id}
                          className={`border-t border-gray-100 dark:border-gray-800 ${
                            active ? "bg-gray-50 dark:bg-white/[0.04]" : ""
                          }`}
                        >
                          <td className="py-3 pr-4">
                            <button className="font-mono text-xs hover:underline" onClick={() => setSelectedOrderId(o.id)}>
                              {o.id}
                            </button>
                          </td>
                          <td className="py-3 pr-4">{o.status?.value ?? "-"}</td>
                          <td className="py-3 pr-4">{o.porting_phone_numbers_count ?? "-"}</td>
                          <td className="py-3 pr-4">{o.customer_reference ?? "-"}</td>
                          <td className="py-3 pr-4">
                            {o.created_at ? new Date(o.created_at).toLocaleString() : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Create draft order</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Paste E.164 phone numbers (one per line). This creates a draft porting order.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="nums">Phone numbers</Label>
                <textarea
                  id="nums"
                  value={draftNumbersRaw}
                  onChange={(e) => setDraftNumbersRaw(e.target.value)}
                  className="min-h-[140px] w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                  placeholder={"+13035550000\n+13035550001"}
                />
              </div>

              <div>
                <Label htmlFor="cref">Customer reference</Label>
                <Input
                  id="cref"
                  placeholder="Optional"
                  value={customerReference}
                  onChange={(e) => setCustomerReference(e.target.value)}
                />
              </div>

              <Button onClick={handleCreateDraft} disabled={isCreating}>
                {isCreating ? "Creating…" : "Create draft"}
              </Button>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Edit / submit</h2>
            {!selectedOrderId ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Select a porting order to edit and submit.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Selected: <span className="font-mono">{selectedOrderId}</span>
                </div>

                <div>
                  <Label htmlFor="wh">Webhook URL</Label>
                  <Input
                    id="wh"
                    placeholder="Optional"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                  />
                </div>

                <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-800">
                  <p className="text-sm font-medium text-gray-900 dark:text-white/90">Phone number configuration</p>
                  <div className="mt-3 space-y-3">
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
                      <Label htmlFor="mpid">Messaging Profile ID</Label>
                      <Input
                        id="mpid"
                        placeholder="Optional"
                        value={messagingProfileId}
                        onChange={(e) => setMessagingProfileId(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="bgid">Billing Group ID</Label>
                      <Input
                        id="bgid"
                        placeholder="Optional"
                        value={billingGroupId}
                        onChange={(e) => setBillingGroupId(e.target.value)}
                      />
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
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="outline" onClick={handleSaveEdits} disabled={isSaving}>
                    {isSaving ? "Saving…" : "Save edits"}
                  </Button>
                  <Button onClick={handleConfirm} disabled={isSaving}>
                    {isSaving ? "Submitting…" : "Submit / confirm"}
                  </Button>
                </div>

                {selected?.status?.value && (
                  <div className="rounded-lg border border-gray-100 p-3 text-sm dark:border-gray-800">
                    Status: <span className="font-medium">{selected.status.value}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

