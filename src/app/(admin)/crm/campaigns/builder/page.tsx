"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import CampaignBuilder from "@/components/campaigns/CampaignBuilder";

export default function CampaignBuilderPage() {
  return (
    <div className="space-y-8">
      <PageBreadcrumb pageTitle="Campaign Builder" />
      <CampaignBuilder />
    </div>
  );
}
