"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import {
  createCampaign,
  type CampaignType,
} from "@/app/actions/campaigns/campaigns";
import {
  parseFileFromFormData,
  previewImport,
  importRecipientsAction,
  type FieldMapping,
  type ParseResult,
  type ImportPreview,
} from "@/app/actions/campaigns/import";
import {
  previewCrmContacts,
  importCrmContactsToCampaign,
  type CrmAudienceSource,
} from "@/app/actions/campaigns/crm-import";
import {
  previewGoogleSheetAction,
  importFromGoogleSheetsAction,
} from "@/app/actions/campaigns/google-sheets";
import {
  previewAirtableAction,
  importFromAirtableAction,
} from "@/app/actions/campaigns/airtable";
import {
  getContactGroups,
  type ContactGroup,
} from "@/app/actions/crm/groups";
import { seedCrmContacts } from "@/app/actions/crm/seed";
import { listAssistantsAction } from "@/app/actions/telnyx/assistants";
import { listOwnedPhoneNumbersAction } from "@/app/actions/telnyx/numbers";
import { useDropzone } from "react-dropzone";

const STEPS = ["Basics", "Audience", "Content", "Schedule"];

const CAMPAIGN_TYPES: { value: CampaignType; label: string }[] = [
  { value: "voice", label: "Voice (AI Assistant)" },
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "multi_channel", label: "Multi-Channel" },
];

const FIELD_TARGETS = [
  { key: "first_name", label: "First Name", required: true },
  { key: "last_name", label: "Last Name", required: false },
  { key: "phone", label: "Phone", required: true },
  { key: "email", label: "Email", required: false },
  { key: "timezone", label: "Timezone", required: false },
  { key: "client_type", label: "Client Type", required: false },
];

type AudienceTab = "file" | "crm" | "google_sheets" | "airtable";

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Basics
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [campaignType, setCampaignType] = useState<CampaignType>("voice");

  // Step 2: Audience — tab selection
  const [audienceTab, setAudienceTab] = useState<AudienceTab>("crm");

  // Step 2a: File upload audience
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importSourceType, setImportSourceType] = useState<"csv" | "excel">("csv");
  const [mapping, setMapping] = useState<FieldMapping>({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    timezone: "",
    client_type: "",
  });
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  // Step 2b: CRM audience
  const [crmSourceType, setCrmSourceType] = useState<"all_contacts" | "group">("all_contacts");
  const [crmGroups, setCrmGroups] = useState<ContactGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [crmPreview, setCrmPreview] = useState<{
    contacts: { id: string; first_name: string; last_name: string; phone: string | null; email: string | null }[];
    validCount: number;
    totalCount: number;
  } | null>(null);
  const [crmLoading, setCrmLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Step 2c: Google Sheets audience
  const [gsSheetId, setGsSheetId] = useState("");
  const [gsRange, setGsRange] = useState("Sheet1!A:Z");
  const [gsPreview, setGsPreview] = useState<{
    headers: string[];
    rows: Record<string, unknown>[];
  } | null>(null);
  const [gsImportPreview, setGsImportPreview] = useState<ImportPreview | null>(null);
  const [gsLoading, setGsLoading] = useState(false);

  // Step 2d: Airtable audience
  const [atBaseId, setAtBaseId] = useState("");
  const [atTableIdOrName, setAtTableIdOrName] = useState("");
  const [atViewIdOrName, setAtViewIdOrName] = useState("");
  const [atApiToken, setAtApiToken] = useState("");
  const [atPreview, setAtPreview] = useState<{
    headers: string[];
    rows: Record<string, unknown>[];
  } | null>(null);
  const [atImportPreview, setAtImportPreview] = useState<ImportPreview | null>(null);
  const [atLoading, setAtLoading] = useState(false);

  // Step 3: Content
  const [assistants, setAssistants] = useState<{ id: string; name?: string }[]>([]);
  const [numbers, setNumbers] = useState<{ phone_number: string }[]>([]);
  const [assistantId, setAssistantId] = useState("");
  const [fromNumber, setFromNumber] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [connectionId, setConnectionId] = useState("");

  // Step 4: Schedule
  const [callingWindowStart, setCallingWindowStart] = useState("09:00");
  const [callingWindowEnd, setCallingWindowEnd] = useState("20:00");
  const [callingDays, setCallingDays] = useState([1, 2, 3, 4, 5]);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [retryDelayMinutes, setRetryDelayMinutes] = useState(60);
  const [callsPerMinute, setCallsPerMinute] = useState(10);

  const [campaignId, setCampaignId] = useState<string | null>(null);

  // ── File upload handlers ──────────────────────────────────────────

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    const result = await parseFileFromFormData(formData);
    if (result) {
      setParseResult(result);
      setImportSourceType(file.name.toLowerCase().endsWith(".csv") ? "csv" : "excel");
      const autoMapping: FieldMapping = { ...mapping };
      for (const h of result.headers) {
        const key = h.toLowerCase().replace(/\s+/g, "_");
        if (key.includes("first") || key === "firstname") autoMapping.first_name = h;
        else if (key.includes("last") || key === "lastname") autoMapping.last_name = h;
        else if (key.includes("phone") || key.includes("mobile")) autoMapping.phone = h;
        else if (key.includes("email")) autoMapping.email = h;
        else if (key.includes("timezone") || key.includes("tz")) autoMapping.timezone = h;
        else if (key.includes("client") || key.includes("type")) autoMapping.client_type = h;
      }
      setMapping(autoMapping);
      if (result.rows.length > 0) {
        const p = await previewImport(result.rows, autoMapping);
        setPreview(p);
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxFiles: 1,
  });

  const handleMappingChange = async (target: keyof FieldMapping, value: string) => {
    const next = { ...mapping, [target]: value };
    setMapping(next);
    if (parseResult?.rows?.length) {
      const p = await previewImport(parseResult.rows, next);
      setPreview(p);
    }
  };

  const handleIntegrationMappingChange = async (target: keyof FieldMapping, value: string) => {
    const next = { ...mapping, [target]: value };
    setMapping(next);
    if (audienceTab === "google_sheets" && gsPreview?.rows?.length) {
      const p = await previewImport(gsPreview.rows, next);
      setGsImportPreview(p);
    }
    if (audienceTab === "airtable" && atPreview?.rows?.length) {
      const p = await previewImport(atPreview.rows, next);
      setAtImportPreview(p);
    }
  };

  // ── Google Sheets handlers ──────────────────────────────────────

  const loadGsPreview = useCallback(async () => {
    if (!gsSheetId.trim()) return;
    setGsLoading(true);
    setGsPreview(null);
    setGsImportPreview(null);
    setError(null);
    try {
      const result = await previewGoogleSheetAction(gsSheetId.trim(), gsRange.trim() || undefined);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const autoMapping: FieldMapping = { ...mapping };
      for (const h of result.headers) {
        const key = h.toLowerCase().replace(/\s+/g, "_");
        if (key.includes("first") || key === "firstname") autoMapping.first_name = h;
        else if (key.includes("last") || key === "lastname") autoMapping.last_name = h;
        else if (key.includes("phone") || key.includes("mobile")) autoMapping.phone = h;
        else if (key.includes("email")) autoMapping.email = h;
        else if (key.includes("timezone") || key.includes("tz")) autoMapping.timezone = h;
        else if (key.includes("client") || key.includes("type")) autoMapping.client_type = h;
      }
      setMapping(autoMapping);
      setGsPreview({ headers: result.headers, rows: result.rows });
      const p = await previewImport(result.rows, autoMapping);
      setGsImportPreview(p);
    } catch (e) {
      console.error("Google Sheets preview:", e);
      setError(e instanceof Error ? e.message : "Failed to load sheet");
    } finally {
      setGsLoading(false);
    }
  }, [gsSheetId, gsRange]);

  // ── Airtable handlers ────────────────────────────────────────────

  const loadAtPreview = useCallback(async () => {
    if (!atBaseId.trim() || !atTableIdOrName.trim() || !atApiToken.trim()) return;
    setAtLoading(true);
    setAtPreview(null);
    setAtImportPreview(null);
    setError(null);
    try {
      const result = await previewAirtableAction({
        baseId: atBaseId.trim(),
        tableIdOrName: atTableIdOrName.trim(),
        viewIdOrName: atViewIdOrName.trim() || undefined,
        apiToken: atApiToken.trim(),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const autoMapping: FieldMapping = { ...mapping };
      for (const h of result.headers) {
        const key = h.toLowerCase().replace(/\s+/g, "_");
        if (key.includes("first") || key === "firstname") autoMapping.first_name = h;
        else if (key.includes("last") || key === "lastname") autoMapping.last_name = h;
        else if (key.includes("phone") || key.includes("mobile")) autoMapping.phone = h;
        else if (key.includes("email")) autoMapping.email = h;
        else if (key.includes("timezone") || key.includes("tz")) autoMapping.timezone = h;
        else if (key.includes("client") || key.includes("type")) autoMapping.client_type = h;
      }
      setMapping(autoMapping);
      setAtPreview({ headers: result.headers, rows: result.rows });
      const p = await previewImport(result.rows, autoMapping);
      setAtImportPreview(p);
    } catch (e) {
      console.error("Airtable preview:", e);
      setError(e instanceof Error ? e.message : "Failed to load Airtable");
    } finally {
      setAtLoading(false);
    }
  }, [atBaseId, atTableIdOrName, atViewIdOrName, atApiToken]);

  // ── CRM handlers ─────────────────────────────────────────────────

  const loadCrmData = useCallback(async () => {
    setCrmLoading(true);
    try {
      const groups = await getContactGroups();
      setCrmGroups(groups);
      if (groups.length > 0 && !selectedGroupId) {
        setSelectedGroupId(groups[0].id);
      }
    } catch (e) {
      console.error("Load CRM data:", e);
    } finally {
      setCrmLoading(false);
    }
  }, [selectedGroupId]);

  const loadCrmPreview = useCallback(async () => {
    setCrmLoading(true);
    try {
      const source: CrmAudienceSource =
        crmSourceType === "group" && selectedGroupId
          ? { type: "group", groupId: selectedGroupId }
          : { type: "all_contacts" };
      const result = await previewCrmContacts(source);
      setCrmPreview(result);
    } catch (e) {
      console.error("CRM preview:", e);
    } finally {
      setCrmLoading(false);
    }
  }, [crmSourceType, selectedGroupId]);

  // Load CRM groups when switching to CRM tab
  useEffect(() => {
    if (audienceTab === "crm" && step === 1) {
      loadCrmData();
    }
  }, [audienceTab, step, loadCrmData]);

  // Load CRM preview when source changes
  useEffect(() => {
    if (audienceTab === "crm" && step === 1) {
      loadCrmPreview();
    }
  }, [audienceTab, step, crmSourceType, selectedGroupId, loadCrmPreview]);

  const handleSeedContacts = async () => {
    setSeeding(true);
    setError(null);
    try {
      const res = await seedCrmContacts();
      if (!res.ok) {
        setError(res.error);
      } else {
        // Reload CRM data after seeding
        await loadCrmData();
        await loadCrmPreview();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to seed contacts");
    } finally {
      setSeeding(false);
    }
  };

  // ── Content options ───────────────────────────────────────────────

  const loadContentOptions = async () => {
    try {
      const [aList, nList] = await Promise.all([
        listAssistantsAction(),
        listOwnedPhoneNumbersAction({ pageNumber: 1, pageSize: 50 }),
      ]);
      const assistantsData = Array.isArray(aList) ? aList : (aList as any)?.data ?? [];
      setAssistants(assistantsData.map((a: any) => ({ id: a.id, name: a.name ?? a.id })));
      const numData = (nList as any)?.data ?? [];
      setNumbers(numData.map((n: any) => ({ phone_number: n.phone_number ?? n.id })));
      if (assistantsData[0]) setAssistantId(assistantsData[0].id);
      const firstNum = numData[0];
      if (firstNum?.phone_number) setFromNumber(firstNum.phone_number);
    } catch (e) {
      console.error("Load content options:", e);
    }
  };

  // ── Step navigation ───────────────────────────────────────────────

  const nextStep = async () => {
    setError(null);
    if (step === 0) {
      if (!name.trim()) {
        setError("Campaign name is required");
        return;
      }
      setStep(1);
    } else if (step === 1) {
      if (audienceTab === "file") {
        if (!parseResult?.rows?.length || !preview?.validRows) {
          setError("Please upload a CSV or Excel file with at least one valid recipient");
          return;
        }
        if (!mapping.phone || !mapping.first_name) {
          setError("Please map Phone and First Name columns");
          return;
        }
      } else if (audienceTab === "google_sheets") {
        if (!gsSheetId.trim()) {
          setError("Please enter a Google Sheet ID");
          return;
        }
        if (!gsPreview?.rows?.length || !gsImportPreview?.validRows) {
          setError("Please load the sheet and ensure at least one valid recipient");
          return;
        }
        if (!mapping.phone || !mapping.first_name) {
          setError("Please map Phone and First Name columns");
          return;
        }
      } else if (audienceTab === "airtable") {
        if (!atBaseId.trim() || !atTableIdOrName.trim() || !atApiToken.trim()) {
          setError("Please enter Base ID, Table, and API token");
          return;
        }
        if (!atPreview?.rows?.length || !atImportPreview?.validRows) {
          setError("Please load the table and ensure at least one valid recipient");
          return;
        }
        if (!mapping.phone || !mapping.first_name) {
          setError("Please map Phone and First Name columns");
          return;
        }
      } else {
        // CRM source
        if (!crmPreview || crmPreview.validCount === 0) {
          setError("No contacts with valid phone numbers found. Add contacts to your CRM first.");
          return;
        }
      }
      setStep(2);
      loadContentOptions();
    } else if (step === 2) {
      if (campaignType === "voice" && !assistantId) {
        setError("Please select an AI assistant");
        return;
      }
      if (!fromNumber) {
        setError("Please select a from number");
        return;
      }
      setStep(3);
    } else if (step === 3) {
      setLoading(true);
      try {
        const res = await createCampaign({
          name: name.trim(),
          description: description.trim() || null,
          campaign_type: campaignType,
          status: "draft",
          assistant_id: campaignType === "voice" ? assistantId : null,
          from_number: fromNumber,
          message_template: campaignType !== "voice" ? messageTemplate : null,
          calling_window_start: callingWindowStart,
          calling_window_end: callingWindowEnd,
          calling_days: callingDays,
          max_attempts: maxAttempts,
          retry_delay_minutes: retryDelayMinutes,
          calls_per_minute: callsPerMinute,
          settings: connectionId ? { connection_id: connectionId } : {},
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setCampaignId(res.id);

        if (audienceTab === "file") {
          const importRes = await importRecipientsAction(
            res.id,
            "Imported list",
            parseResult!.rows,
            mapping,
            importSourceType
          );
          if (!importRes.ok) {
            setError(importRes.error);
            return;
          }
        } else if (audienceTab === "google_sheets") {
          const importRes = await importFromGoogleSheetsAction(
            res.id,
            "Google Sheets",
            { sheetId: gsSheetId.trim(), range: gsRange.trim() || undefined },
            mapping
          );
          if (!importRes.ok) {
            setError(importRes.error);
            return;
          }
        } else if (audienceTab === "airtable") {
          const importRes = await importFromAirtableAction(
            res.id,
            "Airtable",
            {
              baseId: atBaseId.trim(),
              tableIdOrName: atTableIdOrName.trim(),
              viewIdOrName: atViewIdOrName.trim() || undefined,
              apiToken: atApiToken.trim(),
            },
            mapping
          );
          if (!importRes.ok) {
            setError(importRes.error);
            return;
          }
        } else {
          // CRM import
          const crmSource: CrmAudienceSource =
            crmSourceType === "group" && selectedGroupId
              ? { type: "group", groupId: selectedGroupId }
              : { type: "all_contacts" };
          const groupLabel =
            crmSourceType === "group"
              ? crmGroups.find((g) => g.id === selectedGroupId)?.name ?? "CRM Group"
              : "All CRM Contacts";
          const importRes = await importCrmContactsToCampaign(
            res.id,
            groupLabel,
            crmSource
          );
          if (!importRes.ok) {
            setError(importRes.error);
            return;
          }
        }

        router.push(`/campaigns/${res.id}`);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
  };

  const prevStep = () => {
    setError(null);
    if (step > 0) setStep(step - 1);
  };

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div>
      <PageBreadcrumb pageTitle="New Campaign" />
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-2 rounded ${
                i <= step ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-700"
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* ── Step 0: Basics ─────────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Campaign basics</h2>
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Holiday Promotion Calls"
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={2}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Campaign type</label>
              <div className="flex flex-wrap gap-2">
                {CAMPAIGN_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setCampaignType(t.value)}
                    className={`px-4 py-2 rounded-lg border ${
                      campaignType === t.value
                        ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 1: Audience ───────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Audience</h2>

            {/* Source tabs */}
            <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => { setAudienceTab("crm"); setError(null); }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  audienceTab === "crm"
                    ? "border-brand-500 text-brand-600 dark:text-brand-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
                }`}
              >
                CRM Contacts
              </button>
              <button
                type="button"
                onClick={() => { setAudienceTab("file"); setError(null); }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  audienceTab === "file"
                    ? "border-brand-500 text-brand-600 dark:text-brand-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
                }`}
              >
                Upload File
              </button>
              <button
                type="button"
                onClick={() => { setAudienceTab("google_sheets"); setError(null); }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  audienceTab === "google_sheets"
                    ? "border-brand-500 text-brand-600 dark:text-brand-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
                }`}
              >
                Google Sheets
              </button>
              <button
                type="button"
                onClick={() => { setAudienceTab("airtable"); setError(null); }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  audienceTab === "airtable"
                    ? "border-brand-500 text-brand-600 dark:text-brand-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
                }`}
              >
                Airtable
              </button>
            </div>

            {/* ── CRM tab ──────────────────────────────────────── */}
            {audienceTab === "crm" && (
              <div className="space-y-4">
                {/* Source type selector */}
                <div>
                  <label className="block text-sm font-medium mb-2">Select source</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCrmSourceType("all_contacts")}
                      className={`px-4 py-2 rounded-lg border text-sm ${
                        crmSourceType === "all_contacts"
                          ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      All Contacts
                    </button>
                    <button
                      type="button"
                      onClick={() => setCrmSourceType("group")}
                      className={`px-4 py-2 rounded-lg border text-sm ${
                        crmSourceType === "group"
                          ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      Contact Group
                    </button>
                  </div>
                </div>

                {/* Group selector */}
                {crmSourceType === "group" && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Group</label>
                    {crmGroups.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No groups found. Create groups in CRM &gt; Contacts first.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {crmGroups.map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => setSelectedGroupId(g.id)}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-colors ${
                              selectedGroupId === g.id
                                ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: g.color }}
                              />
                              <div>
                                <span className="font-medium text-sm">{g.name}</span>
                                {g.description && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    {g.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                              {g.member_count ?? 0} contacts
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* CRM preview */}
                {crmLoading ? (
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm text-gray-500">
                    Loading contacts...
                  </div>
                ) : crmPreview ? (
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm">
                          <span className="font-medium">{crmPreview.totalCount}</span> contacts found
                        </p>
                        <p className="text-sm text-green-600 dark:text-green-400">
                          <span className="font-medium">{crmPreview.validCount}</span> with valid phone numbers
                        </p>
                        {crmPreview.totalCount - crmPreview.validCount > 0 && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            {crmPreview.totalCount - crmPreview.validCount} contacts missing phone numbers (will be skipped)
                          </p>
                        )}
                      </div>
                    </div>
                    {/* Contact preview table */}
                    {crmPreview.contacts.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                              <th className="text-left py-1.5 pr-3 font-medium text-gray-500">Name</th>
                              <th className="text-left py-1.5 pr-3 font-medium text-gray-500">Phone</th>
                              <th className="text-left py-1.5 font-medium text-gray-500">Email</th>
                            </tr>
                          </thead>
                          <tbody>
                            {crmPreview.contacts.slice(0, 5).map((c) => (
                              <tr key={c.id} className="border-b border-gray-100 dark:border-gray-700/50">
                                <td className="py-1.5 pr-3">{c.first_name} {c.last_name}</td>
                                <td className="py-1.5 pr-3 font-mono">{c.phone || "—"}</td>
                                <td className="py-1.5 text-gray-500">{c.email || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {crmPreview.contacts.length > 5 && (
                          <p className="text-xs text-gray-400 mt-1">
                            + {crmPreview.contacts.length - 5} more contacts
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Seed button when no contacts */}
                {crmPreview && crmPreview.totalCount === 0 && (
                  <div className="p-4 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-center space-y-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No contacts in your CRM yet.
                    </p>
                    <button
                      type="button"
                      onClick={handleSeedContacts}
                      disabled={seeding}
                      className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
                    >
                      {seeding ? "Seeding..." : "Seed 10 sample contacts"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── File upload tab ──────────────────────────────── */}
            {audienceTab === "file" && (
              <>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer ${
                    isDragActive ? "border-brand-500 bg-brand-50 dark:bg-brand-900/10" : "border-gray-300 dark:border-gray-600"
                  }`}
                >
                  <input {...getInputProps()} />
                  <p>Drag & drop CSV or Excel, or click to browse</p>
                </div>
                {parseResult && (
                  <>
                    <div>
                      <h3 className="font-medium mb-2">Column mapping</h3>
                      <div className="space-y-2">
                        {FIELD_TARGETS.map((f) => (
                          <div key={f.key} className="flex items-center gap-4">
                            <span className="w-32 text-sm">{f.label}{f.required ? " *" : ""}</span>
                            <select
                              value={mapping[f.key] ?? ""}
                              onChange={(e) => handleMappingChange(f.key, e.target.value)}
                              className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                            >
                              <option value="">-- Skip --</option>
                              {parseResult.headers.map((h) => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                    {preview && (
                      <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                        <p>Total rows: {preview.totalRows}</p>
                        <p>Valid after dedup: {preview.validRows}</p>
                        <p>Duplicates removed: {preview.duplicateCount}</p>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* ── Google Sheets tab ─────────────────────────────── */}
            {audienceTab === "google_sheets" && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Import from a Google Sheet. Set <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">GOOGLE_SHEETS_API_KEY</code> in your environment for API access.
                </p>
                <div>
                  <label className="block text-sm font-medium mb-1">Sheet ID</label>
                  <input
                    type="text"
                    value={gsSheetId}
                    onChange={(e) => setGsSheetId(e.target.value)}
                    placeholder="From URL: docs.google.com/spreadsheets/d/SHEET_ID/edit"
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Range (optional)</label>
                  <input
                    type="text"
                    value={gsRange}
                    onChange={(e) => setGsRange(e.target.value)}
                    placeholder="Sheet1!A:Z"
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                  />
                </div>
                <Button onClick={loadGsPreview} disabled={gsLoading || !gsSheetId.trim()}>
                  {gsLoading ? "Loading..." : "Load sheet"}
                </Button>
                {gsPreview && (
                  <>
                    <div>
                      <h3 className="font-medium mb-2">Column mapping</h3>
                      <div className="space-y-2">
                        {FIELD_TARGETS.map((f) => (
                          <div key={f.key} className="flex items-center gap-4">
                            <span className="w-32 text-sm">{f.label}{f.required ? " *" : ""}</span>
                            <select
                              value={mapping[f.key] ?? ""}
                              onChange={(e) => handleIntegrationMappingChange(f.key, e.target.value)}
                              className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                            >
                              <option value="">-- Skip --</option>
                              {gsPreview.headers.map((h) => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                    {gsImportPreview && (
                      <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                        <p>Total rows: {gsImportPreview.totalRows}</p>
                        <p>Valid after dedup: {gsImportPreview.validRows}</p>
                        <p>Duplicates removed: {gsImportPreview.duplicateCount}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Airtable tab ────────────────────────────────────── */}
            {audienceTab === "airtable" && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Import from Airtable. Create a Personal Access Token at{" "}
                  <a href="https://airtable.com/create/tokens" target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">
                    airtable.com/create/tokens
                  </a>
                  .
                </p>
                <div>
                  <label className="block text-sm font-medium mb-1">Base ID</label>
                  <input
                    type="text"
                    value={atBaseId}
                    onChange={(e) => setAtBaseId(e.target.value)}
                    placeholder="From URL: airtable.com/BASE_ID/..."
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Table ID or name</label>
                  <input
                    type="text"
                    value={atTableIdOrName}
                    onChange={(e) => setAtTableIdOrName(e.target.value)}
                    placeholder="tbl... or Table name"
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">View ID or name (optional)</label>
                  <input
                    type="text"
                    value={atViewIdOrName}
                    onChange={(e) => setAtViewIdOrName(e.target.value)}
                    placeholder="Filter by view"
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">API Token</label>
                  <input
                    type="password"
                    value={atApiToken}
                    onChange={(e) => setAtApiToken(e.target.value)}
                    placeholder="pat..."
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                  />
                </div>
                <Button onClick={loadAtPreview} disabled={atLoading || !atBaseId.trim() || !atTableIdOrName.trim() || !atApiToken.trim()}>
                  {atLoading ? "Loading..." : "Load table"}
                </Button>
                {atPreview && (
                  <>
                    <div>
                      <h3 className="font-medium mb-2">Column mapping</h3>
                      <div className="space-y-2">
                        {FIELD_TARGETS.map((f) => (
                          <div key={f.key} className="flex items-center gap-4">
                            <span className="w-32 text-sm">{f.label}{f.required ? " *" : ""}</span>
                            <select
                              value={mapping[f.key] ?? ""}
                              onChange={(e) => handleIntegrationMappingChange(f.key, e.target.value)}
                              className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                            >
                              <option value="">-- Skip --</option>
                              {atPreview.headers.map((h) => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                    {atImportPreview && (
                      <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                        <p>Total rows: {atImportPreview.totalRows}</p>
                        <p>Valid after dedup: {atImportPreview.validRows}</p>
                        <p>Duplicates removed: {atImportPreview.duplicateCount}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Content ────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Content</h2>
            {campaignType === "voice" && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">AI Assistant</label>
                  <select
                    value={assistantId}
                    onChange={(e) => setAssistantId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                  >
                    {assistants.map((a) => (
                      <option key={a.id} value={a.id}>{a.name ?? a.id}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Connection ID (optional)</label>
                  <input
                    type="text"
                    value={connectionId}
                    onChange={(e) => setConnectionId(e.target.value)}
                    placeholder="Telnyx Call Control connection ID"
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                  />
                </div>
              </>
            )}
            {(campaignType === "sms" || campaignType === "whatsapp") && (
              <div>
                <label className="block text-sm font-medium mb-1">Message template</label>
                <textarea
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  placeholder="Hi {{first_name}}, ..."
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">From number</label>
              <select
                value={fromNumber}
                onChange={(e) => setFromNumber(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
              >
                {numbers.map((n) => (
                  <option key={n.phone_number} value={n.phone_number}>
                    {n.phone_number}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ── Step 3: Schedule ───────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Schedule</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Calling window start</label>
                <input
                  type="time"
                  value={callingWindowStart}
                  onChange={(e) => setCallingWindowStart(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Calling window end</label>
                <input
                  type="time"
                  value={callingWindowEnd}
                  onChange={(e) => setCallingWindowEnd(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Calls per minute</label>
              <input
                type="number"
                min={1}
                max={60}
                value={callsPerMinute}
                onChange={(e) => setCallsPerMinute(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max retry attempts</label>
              <input
                type="number"
                min={0}
                max={10}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Retry delay (minutes)</label>
              <input
                type="number"
                min={1}
                value={retryDelayMinutes}
                onChange={(e) => setRetryDelayMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
              />
            </div>
          </div>
        )}

        <div className="flex justify-between">
          <Button onClick={prevStep} disabled={step === 0} variant="outline">
            Back
          </Button>
          <Button onClick={nextStep} disabled={loading}>
            {loading ? "Creating..." : step === 3 ? "Create Campaign" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
