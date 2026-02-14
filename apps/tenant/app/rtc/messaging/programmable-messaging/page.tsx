"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Alert from "@/components/ui/alert/Alert";
import { listMessagingProfilesAction, type TelnyxMessagingProfile } from "@/app/actions/telnyx/messagingProfiles";

export default function ProgrammableMessagingPage() {
  const [profiles, setProfiles] = useState<TelnyxMessagingProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await listMessagingProfilesAction();
        setProfiles(res.data ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load messaging profiles");
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <div>
      <PageBreadcrumb pageTitle="Programmable Messaging" />

      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white/90">Messaging Profiles</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Create and manage Telnyx messaging profiles (v2).
          </p>
        </div>
        <Link href="/rtc/messaging/programmable-messaging/create">
          <Button>Create profile</Button>
        </Link>
      </div>

      {error && (
        <div className="mb-6">
          <Alert variant="error" title="Failed to load" message={error} />
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {error.includes("Tenant context missing") && (
              <>
                <Link
                  href="/saas/integrations/telephony"
                  className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                >
                  Configure Telnyx (tenant integrations) →
                </Link>
                <Link
                  href="/saas/admin/system-admin/integrations"
                  className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                >
                  Configure platform default (System Admin) →
                </Link>
                <Link
                  href="/saas/admin/entity/tenant-management"
                  className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                >
                  Manage tenants →
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : profiles.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              You currently have no Messaging Profiles set up.
            </p>
            <div>
              <Link href="/rtc/messaging/programmable-messaging/create">
                <Button size="sm">Create your first profile</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="py-3 pr-4">Name</th>
                  <th className="py-3 pr-4">Webhook API</th>
                  <th className="py-3 pr-4">Enabled</th>
                  <th className="py-3 pr-4">Allowed destinations</th>
                  <th className="py-3 pr-4"></th>
                </tr>
              </thead>
              <tbody className="text-gray-800 dark:text-white/90">
                {profiles.map((p) => (
                  <tr key={p.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="py-3 pr-4 font-medium">{p.name}</td>
                    <td className="py-3 pr-4">{p.webhook_api_version ?? "2"}</td>
                    <td className="py-3 pr-4">{String(Boolean(p.enabled))}</td>
                    <td className="py-3 pr-4">
                      {p.whitelisted_destinations?.length
                        ? p.whitelisted_destinations.join(", ")
                        : "All"}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{p.id}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

