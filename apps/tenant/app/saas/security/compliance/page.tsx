"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import React from "react";

interface ComplianceStandard {
  id: string;
  name: string;
  description: string;
  status: "compliant" | "non-compliant" | "pending";
  lastAudit: string;
}

const standards: ComplianceStandard[] = [
  {
    id: "1",
    name: "SOC 2 Type II",
    description: "Security, availability, processing integrity, confidentiality, and privacy",
    status: "compliant",
    lastAudit: "2024-12-15",
  },
  {
    id: "2",
    name: "GDPR",
    description: "General Data Protection Regulation compliance",
    status: "compliant",
    lastAudit: "2024-12-20",
  },
  {
    id: "3",
    name: "HIPAA",
    description: "Health Insurance Portability and Accountability Act",
    status: "pending",
    lastAudit: "2024-11-30",
  },
  {
    id: "4",
    name: "PCI DSS",
    description: "Payment Card Industry Data Security Standard",
    status: "compliant",
    lastAudit: "2024-12-10",
  },
];

const statusIcons = {
  compliant: CheckIcon,
  "non-compliant": XMarkIcon,
  pending: CheckIcon,
};

const statusColors = {
  compliant: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500",
  "non-compliant": "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-500",
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-500",
};

export default function CompliancePage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Compliance" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Compliance</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Monitor compliance with industry standards and regulations
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {standards.map((standard) => {
            const Icon = statusIcons[standard.status];
            return (
              <div
                key={standard.id}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {standard.name}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {standard.description}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[standard.status]}`}
                  >
                    <Icon className="h-3 w-3" />
                    {standard.status}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-800">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Last Audit</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {standard.lastAudit}
                  </span>
                </div>
                <div className="mt-4">
                  <Button variant="outline" size="sm" className="w-full">
                    View Report
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

