"use client";

import React, { useEffect, useMemo, useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Alert from "@/components/ui/alert/Alert";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import {
  createRequirementGroupAction,
  listRequirementGroupsAction,
  listRequirementsAction,
  submitRequirementGroupForApprovalAction,
  updateRequirementGroupValuesAction,
  type TelnyxRequirement,
  type TelnyxRequirementGroup,
} from "@/app/actions/telnyx/numbers";

export default function NumbersCompliancePage() {
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Requirements
  const [requirements, setRequirements] = useState<TelnyxRequirement[]>([]);
  const [isLoadingRequirements, setIsLoadingRequirements] = useState(false);

  // Requirement Groups
  const [groups, setGroups] = useState<TelnyxRequirementGroup[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  );

  // Create group form
  const [countryCode, setCountryCode] = useState("US");
  const [phoneNumberType, setPhoneNumberType] = useState<"local" | "toll_free" | "mobile" | "national" | "shared_cost">(
    "local"
  );
  const [action, setAction] = useState<"ordering" | "porting">("ordering");
  const [customerReference, setCustomerReference] = useState("");

  // Patch editor
  const [patchRaw, setPatchRaw] = useState(
    JSON.stringify(
      {
        regulatory_requirements: [
          // { requirement_id: \"...\", field_value: \"...\", field_type: \"document|address|text\" }
        ],
      },
      null,
      2
    )
  );

  const [isSaving, setIsSaving] = useState(false);

  async function loadRequirements() {
    setIsLoadingRequirements(true);
    try {
      const res = await listRequirementsAction({ pageNumber: 1, pageSize: 200, sort: "country_code" });
      setRequirements(res.data ?? []);
    } finally {
      setIsLoadingRequirements(false);
    }
  }

  // Derive dropdown options from compliance requirements (like Telnyx portal)
  const countryOptions = useMemo(() => {
    const codes = [...new Set(requirements.map((r) => r.country_code).filter(Boolean))] as string[];
    return codes.sort((a, b) => a.localeCompare(b));
  }, [requirements]);
  const phoneNumberTypeOptions = useMemo(() => {
    const types = [...new Set(requirements.map((r) => r.phone_number_type).filter(Boolean))] as string[];
    return types.sort((a, b) => (a ?? "").localeCompare(b ?? ""));
  }, [requirements]);
  const actionOptions = useMemo(() => {
    const actions = [...new Set(requirements.map((r) => r.action).filter(Boolean))] as string[];
    return actions.sort((a, b) => (a ?? "").localeCompare(b ?? ""));
  }, [requirements]);

  async function loadGroups() {
    setIsLoadingGroups(true);
    try {
      const res = await listRequirementGroupsAction({ pageNumber: 1, pageSize: 25 });
      setGroups(res.data ?? []);
    } finally {
      setIsLoadingGroups(false);
    }
  }

  useEffect(() => {
    setError(null);
    setInfo(null);
    void Promise.all([loadRequirements(), loadGroups()]).catch((e) => {
      setError(e instanceof Error ? e.message : "Failed to load compliance data");
    });
  }, []);

  // Sync form state when requirements load so dropdowns show valid selections
  useEffect(() => {
    if (requirements.length === 0) return;
    if (countryOptions.length > 0 && !countryOptions.includes(countryCode)) {
      setCountryCode(countryOptions[0]);
    }
    if (phoneNumberTypeOptions.length > 0 && !phoneNumberTypeOptions.includes(phoneNumberType)) {
      setPhoneNumberType(phoneNumberTypeOptions[0] as typeof phoneNumberType);
    }
    if (actionOptions.length > 0 && !actionOptions.includes(action)) {
      setAction(actionOptions[0] as "ordering" | "porting");
    }
  }, [countryOptions, phoneNumberTypeOptions, actionOptions]);

  async function handleCreateGroup() {
    setError(null);
    setInfo(null);
    setIsSaving(true);
    try {
      const created = await createRequirementGroupAction({
        countryCode: countryCode.trim().toUpperCase(),
        phoneNumberType,
        action,
        customerReference: customerReference.trim() || undefined,
      });
      const id = (created as any)?.id;
      setInfo(id ? `Created requirement group: ${id}` : "Created requirement group.");
      await loadGroups();
      if (id) setSelectedGroupId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create requirement group");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmitForApproval() {
    if (!selectedGroupId) return;
    setError(null);
    setInfo(null);
    setIsSaving(true);
    try {
      await submitRequirementGroupForApprovalAction(selectedGroupId);
      setInfo("Submitted requirement group for approval.");
      await loadGroups();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit requirement group");
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePatchGroup() {
    if (!selectedGroupId) return;
    setError(null);
    setInfo(null);
    setIsSaving(true);
    try {
      let patch: unknown;
      try {
        patch = JSON.parse(patchRaw);
      } catch {
        throw new Error("Patch JSON is invalid.");
      }
      if (!patch || typeof patch !== "object") {
        throw new Error("Patch must be a JSON object.");
      }
      await updateRequirementGroupValuesAction(selectedGroupId, patch as Record<string, unknown>);
      setInfo("Patched requirement group.");
      await loadGroups();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to patch requirement group");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <PageBreadcrumb pageTitle="Compliance" />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white/90">Compliance</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Regulatory requirements and requirement groups for ordering/porting.
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_420px]">
        <section className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Requirements</h2>
              <Button variant="outline" onClick={loadRequirements} disabled={isLoadingRequirements}>
                {isLoadingRequirements ? "Loading…" : "Refresh"}
              </Button>
            </div>

            {isLoadingRequirements ? (
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
            ) : requirements.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">No requirements returned.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="py-3 pr-4">Country</th>
                      <th className="py-3 pr-4">Type</th>
                      <th className="py-3 pr-4">Action</th>
                      <th className="py-3 pr-4">Requirement types</th>
                      <th className="py-3 pr-4">ID</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-800 dark:text-white/90">
                    {requirements.map((r) => (
                      <tr key={r.id} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="py-3 pr-4">{r.country_code ?? "-"}</td>
                        <td className="py-3 pr-4">{r.phone_number_type ?? "-"}</td>
                        <td className="py-3 pr-4">{r.action ?? "-"}</td>
                        <td className="py-3 pr-4">
                          {r.requirements_types?.length ? r.requirements_types.map((t) => t.name || t.id).join(", ") : "-"}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{r.id}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Requirement groups</h2>
              <Button variant="outline" onClick={loadGroups} disabled={isLoadingGroups}>
                {isLoadingGroups ? "Loading…" : "Refresh"}
              </Button>
            </div>

            {isLoadingGroups ? (
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
            ) : groups.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">No requirement groups returned.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="py-3 pr-4">ID</th>
                      <th className="py-3 pr-4">Country</th>
                      <th className="py-3 pr-4">Type</th>
                      <th className="py-3 pr-4">Action</th>
                      <th className="py-3 pr-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-800 dark:text-white/90">
                    {groups.map((g) => {
                      const active = g.id === selectedGroupId;
                      return (
                        <tr
                          key={g.id}
                          className={`border-t border-gray-100 dark:border-gray-800 ${
                            active ? "bg-gray-50 dark:bg-white/[0.04]" : ""
                          }`}
                        >
                          <td className="py-3 pr-4">
                            <button className="font-mono text-xs hover:underline" onClick={() => setSelectedGroupId(g.id)}>
                              {g.id}
                            </button>
                          </td>
                          <td className="py-3 pr-4">{g.country_code}</td>
                          <td className="py-3 pr-4">{g.phone_number_type}</td>
                          <td className="py-3 pr-4">{g.action}</td>
                          <td className="py-3 pr-4">{g.status ?? "-"}</td>
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Create requirement group</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Create a reusable requirement group for ordering or porting.
            </p>

            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="cc">Country</Label>
                  <select
                    id="cc"
                    value={countryOptions.includes(countryCode) ? countryCode : countryOptions[0] ?? ""}
                    onChange={(e) => setCountryCode(e.target.value)}
                    disabled={countryOptions.length === 0}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                  >
                    <option value="">
                      {countryOptions.length === 0 ? "Loading…" : "Select…"}
                    </option>
                    {countryOptions.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="act">Action</Label>
                  <select
                    id="act"
                    value={actionOptions.includes(action) ? action : actionOptions[0] ?? "ordering"}
                    onChange={(e) => setAction(e.target.value as "ordering" | "porting")}
                    disabled={actionOptions.length === 0}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                  >
                    {actionOptions.length === 0 ? (
                      <>
                        <option value="ordering">ordering</option>
                        <option value="porting">porting</option>
                      </>
                    ) : (
                      actionOptions.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="pnt">Phone number type</Label>
                  <select
                    id="pnt"
                    value={phoneNumberTypeOptions.includes(phoneNumberType) ? phoneNumberType : phoneNumberTypeOptions[0] ?? "local"}
                    onChange={(e) => setPhoneNumberType(e.target.value as typeof phoneNumberType)}
                    disabled={phoneNumberTypeOptions.length === 0}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                  >
                    {phoneNumberTypeOptions.length === 0 ? (
                      <>
                        <option value="local">local</option>
                        <option value="toll_free">toll_free</option>
                        <option value="mobile">mobile</option>
                        <option value="national">national</option>
                        <option value="shared_cost">shared_cost</option>
                      </>
                    ) : (
                      phoneNumberTypeOptions.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="cr">Customer reference</Label>
                <Input
                  id="cr"
                  placeholder="My Requirement Group"
                  value={customerReference}
                  onChange={(e) => setCustomerReference(e.target.value)}
                />
              </div>

              <Button
                onClick={handleCreateGroup}
                disabled={isSaving || countryOptions.length === 0 || !countryCode}
              >
                {isSaving ? "Creating…" : "Create group"}
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Selected group</h2>
            {!selectedGroup ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Select a requirement group from the list.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  ID: <span className="font-mono">{selectedGroup.id}</span>
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-200">
                  <div>Country: {selectedGroup.country_code}</div>
                  <div>Type: {selectedGroup.phone_number_type}</div>
                  <div>Action: {selectedGroup.action}</div>
                  <div>Status: {selectedGroup.status ?? "-"}</div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={handleSubmitForApproval} disabled={isSaving}>
                    {isSaving ? "Submitting…" : "Submit for approval"}
                  </Button>
                </div>

                <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-800">
                  <p className="text-sm font-medium text-gray-900 dark:text-white/90">Patch values (optional)</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Power-user tool. Sends a PATCH to Telnyx `requirement_groups/{`id`}`.
                  </p>
                  <textarea
                    value={patchRaw}
                    onChange={(e) => setPatchRaw(e.target.value)}
                    className="mt-3 min-h-[180px] w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 font-mono text-xs text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                  />
                  <div className="mt-3">
                    <Button variant="outline" onClick={handlePatchGroup} disabled={isSaving}>
                      {isSaving ? "Patching…" : "Patch group"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

