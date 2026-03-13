"use client";

import { useEffect, useState } from "react";
import { getCampaigns, getCampaignStats } from "@/app/actions/campaigns/campaigns";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import { PlusIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import type { Campaign, CampaignStats } from "@/app/actions/campaigns/campaigns";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  running: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const TYPE_LABELS: Record<string, string> = {
  voice: "Voice",
  sms: "SMS",
  whatsapp: "WhatsApp",
  multi_channel: "Multi-Channel",
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, CampaignStats>>({});
  const [loading, setLoading] = useState(true);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const data = await getCampaigns();
      setCampaigns(data);
      const stats: Record<string, CampaignStats> = {};
      for (const c of data) {
        const s = await getCampaignStats(c.id);
        if (s) stats[c.id] = s;
      }
      setStatsMap(stats);
    } catch (err) {
      console.error("Error loading campaigns:", err);
    } finally {
      setLoading(false);
    }
  };

  const openDeleteModal = (campaign: Campaign) => {
    setCampaignToDelete(campaign);
    setDeleteError(null);
    setIsDeleteOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteOpen(false);
    setCampaignToDelete(null);
    setDeleteError(null);
  };

  const handleDeleteCampaign = async () => {
    if (!campaignToDelete) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignToDelete.id}`, { method: "DELETE" });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body?.ok) {
        setDeleteError(body?.error ?? "Failed to delete campaign");
        return;
      }

      setCampaigns((prev) => prev.filter((c) => c.id !== campaignToDelete.id));
      setStatsMap((prev) => {
        const next = { ...prev };
        delete next[campaignToDelete.id];
        return next;
      });
      closeDeleteModal();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete campaign");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading campaigns...</div>
      </div>
    );
  }

  return (
    <div>
      <PageBreadcrumb pageTitle="Campaigns" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
              Campaigns
            </h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Create and manage outbound voice, SMS, and WhatsApp campaigns
            </p>
          </div>
          <Link href="/campaigns/new">
            <Button>
              <PlusIcon className="h-5 w-5 mr-2" />
              New Campaign
            </Button>
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recipients
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Completed
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700">
                {campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No campaigns yet. Create your first campaign to start reaching your audience.
                    </td>
                  </tr>
                ) : (
                  campaigns.map((campaign) => {
                    const stats = statsMap[campaign.id];
                    return (
                      <tr
                        key={campaign.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link
                            href={`/campaigns/${campaign.id}`}
                            className="text-sm font-medium text-gray-900 dark:text-white hover:text-brand-500"
                          >
                            {campaign.name}
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {TYPE_LABELS[campaign.campaign_type] ?? campaign.campaign_type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              STATUS_COLORS[campaign.status] ?? "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {campaign.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {stats?.total ?? 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {stats?.completed ?? 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="inline-flex items-center gap-3">
                            <Link href={`/campaigns/${campaign.id}`}>
                              <button className="text-brand-500 hover:text-brand-700">
                                View
                              </button>
                            </Link>
                            <button
                              type="button"
                              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              onClick={() => openDeleteModal(campaign)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isDeleteOpen}
        onClose={() => {
          if (!deleting) closeDeleteModal();
        }}
        className="relative w-full max-w-[560px] rounded-2xl bg-white p-6 dark:bg-gray-900"
      >
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Delete Campaign
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Are you sure you want to delete{" "}
            <span className="font-semibold">{campaignToDelete?.name ?? "this campaign"}</span>?
            This performs a soft delete and removes it from active views.
          </p>
          {deleteError && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-200">
              {deleteError}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeDeleteModal} disabled={deleting}>
              Cancel
            </Button>
            <button
              type="button"
              onClick={handleDeleteCampaign}
              disabled={deleting}
              className="inline-flex items-center justify-center rounded-lg bg-red-600 px-5 py-3.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
