"use client";

import Link from "next/link";
import Button from "@/components/ui/button/Button";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import CampaignOverviewCards from "@/components/campaigns/CampaignOverviewCards";
import IntegrationsStatusPanel from "@/components/campaigns/IntegrationsStatusPanel";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

export default function CRMCampaignsPage() {
  return (
    <div className="space-y-10">
      <PageBreadcrumb pageTitle="CRM Campaigns" />

      <section className="space-y-6 rounded-2xl border border-gray-200 bg-white px-6 py-7 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400 dark:text-gray-500">
              Campaign HQ
            </p>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">CRM-powered campaigns</h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Start from GoHighLevel contacts, activate Telnyx dials/SMS, and let Vapi or Retell agents
              engage when needed.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/crm/campaigns/builder" className="shrink-0">
              <Button>
                Build Campaign
                <ArrowRightIcon className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/crm/campaigns/outreach" className="shrink-0">
              <Button variant="outline">
                Review Outreach
                <ArrowRightIcon className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
          <p>CRM is the single source of truth.</p>
          <p>Telnyx ensures timely calls + SMS.</p>
          <p>Retell / Vapi AI agents step in for complex conversations.</p>
        </div>
      </section>

      <CampaignOverviewCards />

      <section className="space-y-4">
        <IntegrationsStatusPanel />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Link
          href="/crm/campaigns/builder"
          className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-left shadow-sm transition hover:border-brand-500 hover:ring-1 hover:ring-brand-500/40 dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Builder preview</h2>
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400 dark:text-gray-500">
              Step-by-step
            </span>
          </div>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Define audiences, messages, and schedules before pushing to Telnyx / AI call flows.
          </p>
          <div className="mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-brand-500">
            View Builder
            <ArrowRightIcon className="h-4 w-4" />
          </div>
        </Link>
        <Link
          href="/crm/campaigns/outreach"
          className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-left shadow-sm transition hover:border-brand-500 hover:ring-1 hover:ring-brand-500/40 dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Outreach insights</h2>
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400 dark:text-gray-500">
              Campaign activity
            </span>
          </div>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Track calls, SMS, and email status with mock telemetry until APIs are wired in.
          </p>
          <div className="mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-brand-500">
            Review Outreach
            <ArrowRightIcon className="h-4 w-4" />
          </div>
        </Link>
      </section>
    </div>
  );
}
