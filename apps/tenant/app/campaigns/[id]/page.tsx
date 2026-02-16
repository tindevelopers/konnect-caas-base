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

  const handleStart = async () => {
    if (!campaign) return;
    const schedRes = await scheduleCampaignRecipients(id);
    if (!schedRes.ok) {
      console.error("Schedule failed:", schedRes.error);
    }
    const res = await updateCampaign(id, { status: "running" });
    if (res.ok) {
      setCampaign({ ...campaign, status: "running" });
    }
  };

  const handlePause = async () => {
    if (!campaign) return;
    const res = await updateCampaign(id, { status: "paused" });
    if (res.ok) {
      setCampaign({ ...campaign, status: "paused" });
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
              <Button onClick={handlePause} variant="outline">
                Pause
              </Button>
            )}
            <Link href={`/campaigns/${id}/recipients`}>
              <Button variant="outline">View Recipients</Button>
            </Link>
            <Link href={`/campaigns/${id}/analytics`}>
              <Button variant="outline">Analytics</Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
            <p className="text-2xl font-semibold">{stats?.total ?? 0}</p>
          </div>
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">Pending</p>
            <p className="text-2xl font-semibold">{stats?.pending ?? 0}</p>
          </div>
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">In progress</p>
            <p className="text-2xl font-semibold">{stats?.in_progress ?? 0}</p>
          </div>
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
            <p className="text-2xl font-semibold">{stats?.completed ?? 0}</p>
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
        </div>
      </div>
    </div>
  );
}
