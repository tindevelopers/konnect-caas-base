import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import SupportTicketsList from "@/components/support/SupportList";
import SupportMetrics from "@/components/support/SupportMetrics";
import { Metadata } from "next";
import React from "react";

// Force dynamic rendering since this page uses cookies and server-side tenant resolution
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Next.js Support List | TailAdmin - Next.js Admin Dashboard Template",
  description:
    "This is Next.js Support List for TailAdmin - Next.js Tailwind CSS Admin Dashboard Template",
};

export default function SupportListPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Support List" />
      <SupportMetrics />
      <SupportTicketsList />
    </div>
  );
}
