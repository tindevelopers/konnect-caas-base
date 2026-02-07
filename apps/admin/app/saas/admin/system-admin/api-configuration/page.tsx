import ApiKeyTable from "@/components/api-keys/ApiKeyTable";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import SystemKeysPanel from "@/components/system-keys/SystemKeysPanel";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Configuration | TailAdmin - SaaS Admin Panel",
  description: "Configure API endpoints, rate limits, and access controls",
};

export default function ApiConfigurationPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="API Configuration" />
      <div className="space-y-6">
        <SystemKeysPanel />
        <ApiKeyTable />
      </div>
    </div>
  );
}

