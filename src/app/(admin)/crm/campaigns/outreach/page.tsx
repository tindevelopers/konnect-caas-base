"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import CampaignOutreachTable from "@/components/campaigns/CampaignOutreachTable";

export default function CampaignOutreachPage() {
  return (
    <div className="space-y-8">
      <PageBreadcrumb pageTitle="Campaign Outreach" />
      <CampaignOutreachTable />
    </div>
  );
}
