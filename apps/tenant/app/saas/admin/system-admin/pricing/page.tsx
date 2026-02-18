"use client";

import React, { useCallback, useEffect, useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Alert from "@/components/ui/alert/Alert";
import {
  getPlatformPricingSettingsAction,
  updatePlatformPricingSettingsAction,
  listAllTenantPricingAction,
  upsertTenantPricingSettingsAction,
  type PlatformPricingSettings,
  type TenantPricingSettings,
} from "@/app/actions/billing/pricing";
import { getAllTenants } from "@/app/actions/tenants";
import {
  CurrencyDollarIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

type TenantRow = TenantPricingSettings & { tenant_name?: string };

export default function PricingSettingsPage() {
  // Platform pricing
  const [platform, setPlatform] = useState<PlatformPricingSettings | null>(null);
  const [platformMarkup, setPlatformMarkup] = useState("");
  const [platformCurrency, setPlatformCurrency] = useState("USD");
  const [platformLoading, setPlatformLoading] = useState(true);
  const [platformSaving, setPlatformSaving] = useState(false);

  // Tenant pricing
  const [tenantPricings, setTenantPricings] = useState<TenantRow[]>([]);
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);

  // Inline edit
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [editMarkup, setEditMarkup] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Add new tenant override
  const [addTenantId, setAddTenantId] = useState("");
  const [addMarkup, setAddMarkup] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const loadPlatform = useCallback(async () => {
    setPlatformLoading(true);
    try {
      const data = await getPlatformPricingSettingsAction();
      setPlatform(data);
      setPlatformMarkup(String(data.markup_percent));
      setPlatformCurrency(data.currency);
    } catch (e: any) {
      if (e.message?.includes("Platform Admin")) {
        setAccessDenied(true);
      } else {
        setError(e.message ?? "Failed to load platform pricing");
      }
    } finally {
      setPlatformLoading(false);
    }
  }, []);

  const loadTenantPricings = useCallback(async () => {
    try {
      const data = await listAllTenantPricingAction();
      setTenantPricings(data);
    } catch {
      // Non-fatal
    }
  }, []);

  const loadTenants = useCallback(async () => {
    setTenantsLoading(true);
    try {
      const data = await getAllTenants();
      setTenants(data.map((t: any) => ({ id: t.id, name: t.name })));
    } catch {
      // Non-fatal
    } finally {
      setTenantsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlatform();
    void loadTenantPricings();
    void loadTenants();
  }, [loadPlatform, loadTenantPricings, loadTenants]);

  async function handleSavePlatform() {
    setError(null);
    setInfo(null);
    setPlatformSaving(true);
    try {
      const markup = parseFloat(platformMarkup);
      if (isNaN(markup) || markup < 0 || markup > 999) {
        throw new Error("Markup must be a number between 0 and 999.");
      }
      const updated = await updatePlatformPricingSettingsAction({
        markupPercent: markup,
        currency: platformCurrency.trim() || "USD",
      });
      setPlatform(updated);
      setInfo("Platform pricing saved.");
    } catch (e: any) {
      setError(e.message ?? "Failed to save platform pricing");
    } finally {
      setPlatformSaving(false);
    }
  }

  function startEditTenant(row: TenantRow) {
    setEditingTenantId(row.tenant_id);
    setEditMarkup(row.markup_percent != null ? String(row.markup_percent) : "");
    setEditNotes(row.notes ?? "");
  }

  function cancelEditTenant() {
    setEditingTenantId(null);
    setEditMarkup("");
    setEditNotes("");
  }

  async function saveEditTenant() {
    if (!editingTenantId) return;
    setEditSaving(true);
    setError(null);
    try {
      const markup = editMarkup.trim() === "" ? null : parseFloat(editMarkup);
      if (markup != null && (isNaN(markup) || markup < 0 || markup > 999)) {
        throw new Error("Markup must be a number between 0 and 999, or empty for platform default.");
      }
      await upsertTenantPricingSettingsAction({
        tenantId: editingTenantId,
        markupPercent: markup,
        notes: editNotes.trim() || null,
      });
      await loadTenantPricings();
      setEditingTenantId(null);
      setInfo("Tenant pricing updated.");
    } catch (e: any) {
      setError(e.message ?? "Failed to update tenant pricing");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleAddTenantOverride() {
    if (!addTenantId) return;
    setAddSaving(true);
    setError(null);
    try {
      const markup = addMarkup.trim() === "" ? null : parseFloat(addMarkup);
      if (markup != null && (isNaN(markup) || markup < 0 || markup > 999)) {
        throw new Error("Markup must be a number between 0 and 999, or empty for platform default.");
      }
      await upsertTenantPricingSettingsAction({
        tenantId: addTenantId,
        markupPercent: markup,
        notes: addNotes.trim() || null,
      });
      await loadTenantPricings();
      setAddTenantId("");
      setAddMarkup("");
      setAddNotes("");
      setInfo("Tenant pricing override added.");
    } catch (e: any) {
      setError(e.message ?? "Failed to add tenant pricing");
    } finally {
      setAddSaving(false);
    }
  }

  if (accessDenied) {
    return (
      <div className="p-8">
        <Alert variant="error" title="Access Denied" message="Only Platform Admins can access pricing settings." />
      </div>
    );
  }

  const tenantsWithoutOverride = tenants.filter(
    (t) => !tenantPricings.some((tp) => tp.tenant_id === t.id)
  );

  return (
    <div>
      <PageBreadcrumb pageTitle="Pricing & Markup" />

      {error && (
        <div className="mb-4">
          <Alert variant="error" title="Error" message={error} />
        </div>
      )}
      {info && (
        <div className="mb-4">
          <Alert variant="success" title="Success" message={info} />
        </div>
      )}

      {/* Platform Default Markup */}
      <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-3 mb-4">
          <CurrencyDollarIcon className="h-6 w-6 text-brand-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">
            Platform Default Markup
          </h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          This markup percentage is applied to all tenant billing unless a tenant has a specific override.
          The markup is added on top of your provider cost for AI consumption and number purchases.
        </p>

        {platformLoading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : (
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-40">
              <Label htmlFor="platform-markup">Markup %</Label>
              <Input
                id="platform-markup"
                type="number"
                min="0"
                max="999"
                step="0.01"
                value={platformMarkup}
                onChange={(e) => setPlatformMarkup(e.target.value)}
                placeholder="25"
              />
            </div>
            <div className="w-28">
              <Label htmlFor="platform-currency">Currency</Label>
              <Input
                id="platform-currency"
                value={platformCurrency}
                onChange={(e) => setPlatformCurrency(e.target.value)}
                placeholder="USD"
              />
            </div>
            <Button onClick={handleSavePlatform} disabled={platformSaving}>
              {platformSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        )}

        {platform && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Last updated: {new Date(platform.updated_at).toLocaleString()}
          </p>
        )}
      </section>

      {/* Per-Tenant Overrides */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90 mb-2">
          Per-Tenant Markup Overrides
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Set a custom markup for specific tenants. Leave empty to use the platform default ({platformMarkup || "25"}%).
        </p>

        {/* Existing overrides */}
        {tenantPricings.length > 0 ? (
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4 text-left font-medium text-gray-600 dark:text-gray-300">Tenant</th>
                  <th className="py-2 pr-4 text-left font-medium text-gray-600 dark:text-gray-300">Markup %</th>
                  <th className="py-2 pr-4 text-left font-medium text-gray-600 dark:text-gray-300">Notes</th>
                  <th className="py-2 text-left font-medium text-gray-600 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenantPricings.map((row) => (
                  <tr key={row.tenant_id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 pr-4 text-gray-900 dark:text-white/90">
                      {row.tenant_name ?? row.tenant_id.slice(0, 8) + "…"}
                    </td>
                    <td className="py-2 pr-4">
                      {editingTenantId === row.tenant_id ? (
                        <input
                          type="number"
                          min={0}
                          max={999}
                          step={0.01}
                          value={editMarkup}
                          onChange={(e) => setEditMarkup(e.target.value)}
                          className="w-24 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
                          placeholder="Platform default"
                        />
                      ) : (
                        <span className="text-gray-700 dark:text-gray-200">
                          {row.markup_percent != null ? `${row.markup_percent}%` : (
                            <span className="text-gray-400 italic">Platform default</span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {editingTenantId === row.tenant_id ? (
                        <input
                          type="text"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          className="w-48 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
                          placeholder="Notes"
                        />
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400 text-xs">
                          {row.notes || "-"}
                        </span>
                      )}
                    </td>
                    <td className="py-2">
                      {editingTenantId === row.tenant_id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={saveEditTenant}
                            disabled={editSaving}
                            className="rounded p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                          >
                            <CheckIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={cancelEditTenant}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditTenant(row)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 mb-6">No per-tenant overrides configured. All tenants use the platform default.</p>
        )}

        {/* Add new override */}
        <div className="rounded-lg border border-dashed border-gray-300 p-4 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Add Tenant Override
          </h3>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-56">
              <Label htmlFor="add-tenant">Tenant</Label>
              <select
                id="add-tenant"
                value={addTenantId}
                onChange={(e) => setAddTenantId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
              >
                <option value="">Select tenant...</option>
                {tenantsWithoutOverride.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-28">
              <Label htmlFor="add-markup">Markup %</Label>
              <Input
                id="add-markup"
                type="number"
                min="0"
                max="999"
                step="0.01"
                value={addMarkup}
                onChange={(e) => setAddMarkup(e.target.value)}
                placeholder="e.g. 30"
              />
            </div>
            <div className="w-48">
              <Label htmlFor="add-notes">Notes</Label>
              <Input
                id="add-notes"
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <Button
              onClick={handleAddTenantOverride}
              disabled={addSaving || !addTenantId}
              variant="outline"
            >
              {addSaving ? "Adding..." : "Add Override"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
