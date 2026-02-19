"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import {
  getCampaign,
  getCampaignStats,
  updateCampaign,
  processCampaignBatchNow,
  type Campaign,
  type CampaignStats,
} from "@/app/actions/campaigns/campaigns";
import { scheduleCampaignRecipients } from "@/app/actions/campaigns/scheduler";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  running: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

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
  const [savingConnectionId, setSavingConnectionId] = useState(false);
  const [telnyxApplications, setTelnyxApplications] = useState<
    { value: string; label: string }[]
  >([]);
  const [loadingTelnyxApplications, setLoadingTelnyxApplications] = useState(false);
  const [telnyxApplicationsError, setTelnyxApplicationsError] = useState<string | null>(
    null
  );

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
    const cid = (campaign?.settings as Record<string, unknown> | undefined)?.connection_id;
    setConnectionIdEdit(typeof cid === "string" ? cid : "");
  }, [campaign?.id, campaign?.settings]);

  const handleSaveConnectionId = async () => {
    if (!campaign) return;
    setSavingConnectionId(true);
    setMessage(null);
    try {
      const nextSettings = { ...(campaign.settings || {}), connection_id: connectionIdEdit.trim() || null };
      const res = await updateCampaign(id, { settings: nextSettings });
      if (res.ok) {
        setCampaign({ ...campaign, settings: nextSettings });
        setMessage({ type: "success", text: "Call Control App ID saved. Use Process now to retry." });
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
    setProcessing(true);
    setMessage(null);
    try {
      const res = await processCampaignBatchNow();
      if (res.ok) {
        const [c, s] = await Promise.all([getCampaign(id), getCampaignStats(id)]);
        setCampaign(c ?? campaign);
        setStats(s ?? stats);
        const relevantErrors = res.errors.filter((e) => e.includes(id));
        if (relevantErrors.length > 0) {
          const text = relevantErrors.join(" ");
          const isCallNotAnswered = /90034|Call not answered yet/i.test(text) && relevantErrors.length <= 2;
          setMessage({
            type: isCallNotAnswered ? "warning" : "error",
            text: isCallNotAnswered
              ? "The call was placed but the recipient hadn't answered yet when we tried to start the AI. If they answer later, webhooks will update the status."
              : res.processed > 0
                ? `Processed ${res.processed} call(s). Issues: ${text}`
                : text,
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
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Max attempts</dt>
                <dd>{campaign.max_attempts}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Calls per minute</dt>
                <dd>{campaign.calls_per_minute}</dd>
              </div>
            </dl>
          </div>

          {campaign.campaign_type === "voice" && (
            <div className="p-4 rounded-lg border dark:border-gray-700">
              <h3 className="font-medium mb-2">Telnyx Call Control</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                Voice campaigns need a Call Control App ID (connection_id). The app must have a valid webhook URL in the Telnyx portal, or calls will fail with &quot;Invalid connection_id&quot;.
              </p>
              <div className="flex flex-wrap items-end gap-2">
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
          )}
        </div>
      </div>
    </div>
  );
}
