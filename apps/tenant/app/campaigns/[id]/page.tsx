"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { getCampaignAutomationSettings } from "@/src/core/campaigns/automation-settings";
import {
  getCampaign,
  getCampaignStats,
  updateCampaign,
  processCampaignBatchNow,
  type Campaign,
  type CampaignStats,
} from "@/app/actions/campaigns/campaigns";
import { scheduleCampaignRecipients } from "@/app/actions/campaigns/scheduler";
import { getAssistantAction } from "@/app/actions/telnyx/assistants";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  running: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const SHOW_CAMPAIGN_AUTOMATION_SETTINGS =
  process.env.NEXT_PUBLIC_SHOW_CAMPAIGN_AUTOMATION_SETTINGS === "true";

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success" | "warning"; text: string } | null>(null);
  const [connectionIdEdit, setConnectionIdEdit] = useState("");
  const [greetingEdit, setGreetingEdit] = useState("");
  const [maxConcurrentCallsEdit, setMaxConcurrentCallsEdit] = useState<number>(1);
  const [enableProductPurchaseFlowEdit, setEnableProductPurchaseFlowEdit] = useState(false);
  const [webhookUrlEdit, setWebhookUrlEdit] = useState("");
  const [savingConnectionId, setSavingConnectionId] = useState(false);
  const [automationSettingsError, setAutomationSettingsError] = useState<string | null>(null);
  const [telnyxApplications, setTelnyxApplications] = useState<
    { value: string; label: string }[]
  >([]);
  const [loadingTelnyxApplications, setLoadingTelnyxApplications] = useState(false);
  const [telnyxApplicationsError, setTelnyxApplicationsError] = useState<string | null>(
    null
  );
  const [assistantReadiness, setAssistantReadiness] = useState<{
    name: string;
    voiceConfigured: boolean;
    telephonyEnabled: boolean;
  } | null>(null);
  const [assistantReadinessLoading, setAssistantReadinessLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [c, s] = await Promise.all([
          getCampaign(id),
          getCampaignStats(id),
        ]);
        setCampaign(c);
        setStats(s);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  useEffect(() => {
    let isMounted = true;
    async function loadTelnyxApplications() {
      setLoadingTelnyxApplications(true);
      setTelnyxApplicationsError(null);
      try {
        const res = await fetch("/api/integrations/telnyx/applications", {
          method: "GET",
          cache: "no-store",
        });
        const body = (await res.json()) as {
          options?: { value: string; label: string }[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(body?.error ?? "Failed to load Telnyx applications");
        }
        if (!isMounted) return;
        setTelnyxApplications(Array.isArray(body.options) ? body.options : []);
      } catch (e) {
        if (!isMounted) return;
        setTelnyxApplications([]);
        setTelnyxApplicationsError(
          e instanceof Error ? e.message : "Failed to load Telnyx applications"
        );
      } finally {
        if (isMounted) setLoadingTelnyxApplications(false);
      }
    }
    loadTelnyxApplications();
    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    const s = campaign?.settings as Record<string, unknown> | undefined;
    const cid = s?.connection_id;
    const g = s?.greeting;
    setConnectionIdEdit(typeof cid === "string" ? cid : "");
    setGreetingEdit(typeof g === "string" ? g : "");
    const max = campaign?.max_concurrent_calls;
    setMaxConcurrentCallsEdit(
      typeof max === "number" && max >= 1 ? Math.min(100, max) : 1
    );
    const automation = getCampaignAutomationSettings(s);
    setEnableProductPurchaseFlowEdit(automation.enableProductPurchaseFlow ?? false);
    setWebhookUrlEdit(automation.webhookUrl ?? "");
  }, [campaign?.id, campaign?.settings, campaign?.max_concurrent_calls]);

  // For voice campaigns, fetch assistant config to show outbound readiness (voice + telephony)
  useEffect(() => {
    if (campaign?.campaign_type !== "voice" || !campaign?.assistant_id) {
      setAssistantReadiness(null);
      return;
    }
    const assistantId = campaign.assistant_id!;
    let cancelled = false;
    setAssistantReadinessLoading(true);
    setAssistantReadiness(null);
    getAssistantAction(assistantId)
      .then((assistant) => {
        if (cancelled || !assistant) return;
        const vs = (assistant.voice_settings ?? {}) as Record<string, unknown>;
        const voiceConfigured = typeof vs?.voice === "string" && vs.voice.trim().length > 0;
        const enabled = (assistant.enabled_features ?? []) as string[];
        const telephonyEnabled = enabled.includes("telephony");
        setAssistantReadiness({
          name: (assistant.name ?? "Assistant").trim() || assistantId || "Assistant",
          voiceConfigured,
          telephonyEnabled,
        });
      })
      .catch(() => {
        if (!cancelled) setAssistantReadiness(null);
      })
      .finally(() => {
        if (!cancelled) setAssistantReadinessLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campaign?.id, campaign?.campaign_type, campaign?.assistant_id]);

  const handleSaveConnectionId = async () => {
    if (!campaign) return;
    setSavingConnectionId(true);
    setMessage(null);
    setAutomationSettingsError(null);
    try {
      const currentSettings = (campaign.settings || {}) as Record<string, unknown>;
      // Drop legacy key on save (if present) and persist only the generic `webhookUrl`.
      const { railwayWebhookUrl: _legacyRailwayWebhookUrl, ...settingsSansLegacy } =
        currentSettings;
      const baseSettings: Record<string, unknown> = {
        ...settingsSansLegacy,
        connection_id: connectionIdEdit.trim() || null,
        greeting: greetingEdit.trim().slice(0, 3000) || null,
      };
      const nextSettings: Record<string, unknown> = SHOW_CAMPAIGN_AUTOMATION_SETTINGS
        ? {
            ...baseSettings,
            enableProductPurchaseFlow: !!enableProductPurchaseFlowEdit,
            webhookUrl: webhookUrlEdit.trim() || undefined,
          }
        : baseSettings;

      if (SHOW_CAMPAIGN_AUTOMATION_SETTINGS) {
        if (enableProductPurchaseFlowEdit && webhookUrlEdit.trim()) {
          try {
            new URL(webhookUrlEdit.trim());
          } catch {
            setAutomationSettingsError(
              "Please enter a valid Webhook URL (e.g. https://your-app.com/api/create-draft-order)."
            );
            setSavingConnectionId(false);
            return;
          }
        }
        if (enableProductPurchaseFlowEdit && !webhookUrlEdit.trim()) {
          setAutomationSettingsError(
            "Webhook URL is required when AI Product Purchase Flow is enabled."
          );
          setSavingConnectionId(false);
          return;
        }
      }
      const maxConcurrent = Math.min(100, Math.max(1, Number(maxConcurrentCallsEdit) || 1));
      const res = await updateCampaign(id, {
        settings: nextSettings,
        max_concurrent_calls: maxConcurrent,
      });
      if (res.ok) {
        setCampaign({ ...campaign, settings: nextSettings, max_concurrent_calls: maxConcurrent });
        setMessage({ type: "success", text: "Voice and automation settings saved. Use Process now to retry." });
      } else {
        setMessage({ type: "error", text: res.error });
      }
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSavingConnectionId(false);
    }
  };

  const handleStart = async () => {
    if (!campaign) return;
    setMessage(null);
    const schedRes = await scheduleCampaignRecipients(id);
    if (!schedRes.ok) {
      setMessage({ type: "error", text: `Schedule failed: ${schedRes.error}` });
      return;
    }
    if (schedRes.scheduled === 0) {
      setMessage({
        type: "warning",
        text: "No pending recipients were scheduled. Add recipients to this campaign, then use Process now or wait for the next cron run.",
      });
    }
    const res = await updateCampaign(id, { status: "running" });
    if (res.ok) {
      setCampaign({ ...campaign, status: "running" });
    } else {
      setMessage({ type: "error", text: "Failed to start campaign." });
    }
  };

  const handlePause = async () => {
    if (!campaign) return;
    const res = await updateCampaign(id, { status: "paused" });
    if (res.ok) {
      setCampaign({ ...campaign, status: "paused" });
    }
  };

  const handleProcessNow = async () => {
    if (!campaign) return;
    setProcessing(true);
    setMessage(null);
    try {
      // Schedule any pending recipients first (e.g. added after campaign was started)
      await scheduleCampaignRecipients(id);
      // Pass campaign tenant_id so we skip getTenantForCrm() and avoid Supabase session/502 issues
      const res = await processCampaignBatchNow(campaign.tenant_id, { bypassCallingWindow: true });
      if (res.ok) {
        const [c, s] = await Promise.all([getCampaign(id), getCampaignStats(id)]);
        setCampaign(c ?? campaign);
        setStats(s ?? stats);
        const relevantErrors = res.errors.filter((e) => e.includes(id));
        if (relevantErrors.length > 0) {
          const text = relevantErrors.join(" ");
          const isCallNotAnswered = /90034|Call not answered yet/i.test(text) && relevantErrors.length <= 2;
          const isChannelLimit = /90043|channel limit exceeded/i.test(text);
          const displayText = isCallNotAnswered
            ? "The call was placed but the recipient hadn't answered yet when we tried to start the AI. If they answer later, webhooks will update the status."
            : res.processed > 0
              ? `Processed ${res.processed} call(s). Issues: ${text}`
              : text;
          setMessage({
            type: isCallNotAnswered ? "warning" : "error",
            text: isChannelLimit
              ? `${displayText} Tip: Increase the connection's outbound call limit in Telnyx Portal (Call Control App → Outbound settings), or set this campaign's Max concurrent calls to 1.`
              : displayText,
          });
        } else if (res.processed > 0) {
          setMessage({ type: "success", text: `Processed ${res.processed} recipient(s).` });
        } else if (res.errors.length > 0) {
          setMessage({
            type: "warning",
            text: "Other campaigns had issues (e.g. missing connection_id). This campaign had nothing due to process.",
          });
        } else {
          setMessage({
            type: "warning",
            text: "No recipients were processed. Check that recipients are scheduled and due, and that the campaign has connection, assistant, and from number configured.",
          });
        }
      } else {
        setMessage({ type: "error", text: res.error });
      }
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div>
        <PageBreadcrumb pageTitle="Campaign" />
        <p className="text-gray-500">Campaign not found.</p>
      </div>
    );
  }

  const selectedConnectionMissing =
    !!connectionIdEdit &&
    !telnyxApplications.some((app) => app.value === connectionIdEdit);

  return (
    <div>
      <PageBreadcrumb pageTitle={campaign.name} />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
              {campaign.name}
            </h1>
            {campaign.description && (
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                {campaign.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                STATUS_COLORS[campaign.status] ?? "bg-gray-100"
              }`}
            >
              {campaign.status}
            </span>
            {(campaign.status === "draft" || campaign.status === "paused") && (
              <Button onClick={handleStart}>Start</Button>
            )}
            {campaign.status === "running" && (
              <>
                <Button onClick={handlePause} variant="outline">
                  Pause
                </Button>
                <Button onClick={handleProcessNow} variant="outline" disabled={processing}>
                  {processing ? "Processing…" : "Process now"}
                </Button>
              </>
            )}
            <Link href={`/campaigns/${id}/recipients`}>
              <Button variant="outline">View Recipients</Button>
            </Link>
            <Link href={`/campaigns/${id}/analytics`}>
              <Button variant="outline">Analytics</Button>
            </Link>
          </div>
        </div>

        {message && (
          <div
            className={`rounded-lg p-3 text-sm ${
              message.type === "error"
                ? "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200"
                : message.type === "warning"
                  ? "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
                  : "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-200"
            }`}
          >
            {message.text}
            {message.type !== "success" && /connection_id/i.test(message.text) && campaign?.campaign_type === "voice" && (
              <p className="mt-2 font-medium">Set or fix the Call Control App ID in the <strong>Telnyx Call Control</strong> section below.</p>
            )}
          </div>
        )}

        {campaign.status === "running" && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Calls run every 2 minutes (cron) or when you click <strong>Process now</strong> above. If nothing happens, check the message above for missing connection, assistant, or API key.
          </p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
            <p className="text-2xl font-semibold">{stats?.total ?? 0}</p>
          </div>
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">Pending</p>
            <p className="text-2xl font-semibold">{stats?.pending ?? 0}</p>
          </div>
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">Scheduled</p>
            <p className="text-2xl font-semibold">{stats?.scheduled ?? 0}</p>
          </div>
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">In progress</p>
            <p className="text-2xl font-semibold">{stats?.in_progress ?? 0}</p>
          </div>
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
            <p className="text-2xl font-semibold">{stats?.completed ?? 0}</p>
          </div>
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">Failed</p>
            <p className="text-2xl font-semibold">{stats?.failed ?? 0}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 rounded-lg border dark:border-gray-700">
            <h3 className="font-medium mb-2">Configuration</h3>
            <dl className="space-y-1 text-sm">
              <div>
                <dt className="text-gray-500">Type</dt>
                <dd>{campaign.campaign_type}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Calling window</dt>
                <dd>
                  {campaign.calling_window_start} - {campaign.calling_window_end}
                  {campaign.timezone && campaign.timezone !== "UTC" && (
                    <span className="text-gray-500 dark:text-gray-400"> ({campaign.timezone})</span>
                  )}
                </dd>
              </div>
              {campaign.timezone && (
                <div>
                  <dt className="text-gray-500">Timezone</dt>
                  <dd>{campaign.timezone}</dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500">Max attempts</dt>
                <dd>{campaign.max_attempts}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Call interval</dt>
                <dd>
                  {(() => {
                    const raw = campaign.settings as unknown;
                    const s =
                      typeof raw === "string"
                        ? (() => {
                            try {
                              return JSON.parse(raw) as Record<string, unknown>;
                            } catch {
                              return {};
                            }
                          })()
                        : (raw as Record<string, unknown> | null) ?? {};
                    const v = s.call_interval_minutes;
                    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
                    if (Number.isFinite(n) && n > 0) return `${Math.floor(n)} min`;
                    return `${campaign.calls_per_minute} calls/min`;
                  })()}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Max concurrent calls</dt>
                <dd>{campaign.max_concurrent_calls ?? 10}</dd>
              </div>
            </dl>
          </div>

          {campaign.campaign_type === "voice" && campaign.assistant_id && (
            <div className="p-4 rounded-lg border dark:border-gray-700">
              <h3 className="font-medium mb-2">AI Assistant (outbound)</h3>
              {assistantReadinessLoading ? (
                <p className="text-sm text-gray-500">Checking assistant config…</p>
              ) : assistantReadiness ? (
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-gray-500 dark:text-gray-400">Assistant:</span>{" "}
                    <Link
                      href={`/ai/assistants/${campaign.assistant_id}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {assistantReadiness.name}
                    </Link>
                  </p>
                  <p>
                    <span className="text-gray-500 dark:text-gray-400">Voice:</span>{" "}
                    {assistantReadiness.voiceConfigured ? (
                      <span className="text-green-600 dark:text-green-400">Configured</span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">Not set — assistant may not speak on call</span>
                    )}
                  </p>
                  <p>
                    <span className="text-gray-500 dark:text-gray-400">Telephony:</span>{" "}
                    {assistantReadiness.telephonyEnabled ? (
                      <span className="text-green-600 dark:text-green-400">Enabled</span>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">Optional for outbound</span>
                    )}
                  </p>
                  {(!assistantReadiness.voiceConfigured || !assistantReadiness.telephonyEnabled) && (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                      Open the assistant → Voice tab to set a voice; enable Telephony if Telnyx requires it for the assistant to talk on the call.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Could not load assistant details.</p>
              )}
            </div>
          )}

          {campaign.campaign_type === "voice" && (
            <>
            <div className="p-4 rounded-lg border dark:border-gray-700">
              <h3 className="font-medium mb-2">Telnyx Call Control</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                Voice campaigns need a Call Control App ID (connection_id). The app must have a valid webhook URL in the Telnyx portal, or calls will fail with &quot;Invalid connection_id&quot;.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-full flex flex-wrap gap-4 items-end">
                  <div className="w-24">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Max concurrent calls</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                      value={maxConcurrentCallsEdit}
                      onChange={(e) => setMaxConcurrentCallsEdit(Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                      aria-label="Max concurrent calls (1–100)"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Set to 1 to avoid Telnyx channel limit (90043).</p>
                  </div>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Connection ID (Call Control App ID)</label>
                  <select
                    className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    value={connectionIdEdit}
                    onChange={(e) => setConnectionIdEdit(e.target.value)}
                    disabled={loadingTelnyxApplications}
                  >
                    <option value="">
                      {loadingTelnyxApplications
                        ? "Loading applications..."
                        : "Use TELNYX_CONNECTION_ID from environment"}
                    </option>
                    {selectedConnectionMissing && (
                      <option value={connectionIdEdit}>
                        {connectionIdEdit} (current value)
                      </option>
                    )}
                    {telnyxApplications.map((app) => (
                      <option key={app.value} value={app.value}>
                        {app.label}
                      </option>
                    ))}
                  </select>
                  {telnyxApplicationsError && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      {telnyxApplicationsError}
                    </p>
                  )}
                </div>
                <div className="mt-3">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Greeting (optional)</label>
                  <textarea
                    className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    rows={3}
                    maxLength={3000}
                    placeholder="Hello, thanks for taking our call. How can I help you today?"
                    value={greetingEdit}
                    onChange={(e) => setGreetingEdit(e.target.value)}
                    aria-label="Custom greeting when contact answers"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    First thing the AI says when the contact answers. Leave blank for default.
                  </p>
                </div>
                <Button
                  onClick={handleSaveConnectionId}
                  disabled={savingConnectionId || loadingTelnyxApplications}
                  variant="outline"
                  className="shrink-0"
                >
                  {savingConnectionId ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>

            {SHOW_CAMPAIGN_AUTOMATION_SETTINGS && (
              <div className="p-4 rounded-lg border dark:border-gray-700">
                <h3 className="font-medium mb-2">Automation Settings</h3>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="edit-enable-product-purchase-flow"
                      checked={enableProductPurchaseFlowEdit}
                      onChange={(e) => setEnableProductPurchaseFlowEdit(e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
                      aria-describedby="edit-automation-desc"
                    />
                    <label
                      htmlFor="edit-enable-product-purchase-flow"
                      id="edit-automation-desc"
                      className="text-sm font-medium"
                    >
                      Enable AI Product Purchase Flow
                    </label>
                  </div>
                  <div className="flex-1 min-w-[280px]">
                    <label
                      className="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                      htmlFor="edit-webhook-url"
                    >
                      Webhook URL
                    </label>
                    <input
                      id="edit-webhook-url"
                      type="url"
                      className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                      placeholder="https://your-app.com/api/create-draft-order"
                      value={webhookUrlEdit}
                      onChange={(e) => setWebhookUrlEdit(e.target.value)}
                      aria-required={enableProductPurchaseFlowEdit}
                    />
                  </div>
                </div>
                {automationSettingsError && (
                  <p className="mt-2 text-sm text-amber-600 dark:text-amber-400" role="alert">
                    {automationSettingsError}
                  </p>
                )}
              </div>
            )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
