import ApiKeyTable from "@/components/api-keys/ApiKeyTable";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Keys | TailAdmin SaaS",
  description: "Manage API keys for system administration and authentication",
};

export default function SystemAdminApiKeysPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="API Keys" />
      <ApiKeyTable />
    </div>
  );
}

