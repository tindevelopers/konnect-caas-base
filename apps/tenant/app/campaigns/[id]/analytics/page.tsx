"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import {
  getCampaign,
  getCampaignStats,
  getCampaignRecipientsForExport,
  getRecipientTimezoneStats,
  processCampaignBatchNow,
  type Campaign,
  type CampaignStats,
} from "@/app/actions/campaigns/campaigns";

function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      headers.map((h) => {
        const v = r[h];
        const s = v == null ? "" : String(v);
        return s.includes(",") ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CampaignAnalyticsPage() {
  const params = useParams();
  const id = params.id as string;
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [tzStats, setTzStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "warning" | "success"; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [c, s, tz] = await Promise.all([
          getCampaign(id),
          getCampaignStats(id),
          getRecipientTimezoneStats(id),
        ]);
        setCampaign(c);
        setStats(s);
        setTzStats(tz);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleExport = async () => {
    try {
      const recipients = await getCampaignRecipientsForExport(id);
      const rows = recipients.map((r) => ({
        first_name: r.first_name,
        last_name: r.last_name,
        phone: r.phone,
        email: r.email,
        timezone: r.timezone,
        status: r.status,
        attempts: r.attempts,
      }));
      downloadCsv(rows, `campaign-${id}-export.csv`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleProcessNow = async () => {
    setMessage(null);
    setProcessing(true);
    try {
      const res = await processCampaignBatchNow();
      if (res.ok) {
        const errs = res.errors.filter(Boolean);
        if (errs.length) {
          setMessage({ type: "warning", text: `Processed ${res.processed} call(s). Issues: ${errs.join("; ")}` });
        } else if (res.processed === 0) {
          setMessage({ type: "warning", text: "No recipients were processed. Check campaign config (connection, assistant, from number) or that recipients are scheduled and due." });
        } else {
          setMessage({ type: "success", text: `Processed ${res.processed} call(s).` });
        }
      } else {
        setMessage({ type: "error", text: res.error });
      }
      const [c, s, tz] = await Promise.all([
        getCampaign(id),
        getCampaignStats(id),
        getRecipientTimezoneStats(id),
      ]);
      setCampaign(c);
      setStats(s);
      setTzStats(tz);
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : String(e) });
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

  const total = stats?.total ?? 0;
  const completed = stats?.completed ?? 0;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div>
      <PageBreadcrumb pageTitle={campaign ? `${campaign.name} - Analytics` : "Analytics"} />
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Link href={`/campaigns/${id}`} className="text-brand-500 hover:underline">
            Back to campaign
          </Link>
          <div className="flex items-center gap-2">
            {campaign?.status === "running" && (
              <Button onClick={handleProcessNow} variant="outline" disabled={processing}>
                {processing ? "Processing…" : "Process now"}
              </Button>
            )}
            <Button onClick={handleExport}>Export CSV</Button>
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
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
            <p className="text-2xl font-semibold">{total}</p>
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
            <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
            <p className="text-2xl font-semibold">{completed}</p>
          </div>
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">No answer</p>
            <p className="text-2xl font-semibold">{stats?.no_answer ?? 0}</p>
          </div>
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">Failed</p>
            <p className="text-2xl font-semibold">{stats?.failed ?? 0}</p>
          </div>
        </div>

        <div className="p-4 rounded-lg border dark:border-gray-700">
          <h3 className="font-medium mb-2">Progress</h3>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
            <div
              className="bg-brand-500 h-4 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-gray-500">{progress}% complete</p>
        </div>

        {Object.keys(tzStats).length > 0 && (
          <div className="p-4 rounded-lg border dark:border-gray-700">
            <h3 className="font-medium mb-2">Timezone distribution</h3>
            <div className="space-y-2">
              {Object.entries(tzStats)
                .sort(([, a], [, b]) => b - a)
                .map(([tz, count]) => (
                  <div key={tz} className="flex justify-between text-sm">
                    <span>{tz}</span>
                    <span>{count} recipients</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
