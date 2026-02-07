"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { EyeIcon, ArrowDownTrayIcon, PrinterIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface Invoice {
  id: string;
  invoiceNumber: string;
  customer: string;
  plan: string;
  amount: number;
  status: "paid" | "pending" | "overdue" | "cancelled";
  issueDate: string;
  dueDate: string;
}

const invoices: Invoice[] = [
  {
    id: "1",
    invoiceNumber: "INV-2025-001",
    customer: "Acme Corp",
    plan: "Professional",
    amount: 199.0,
    status: "paid",
    issueDate: "2025-01-01",
    dueDate: "2025-01-15",
  },
  {
    id: "2",
    invoiceNumber: "INV-2025-002",
    customer: "TechStart Inc",
    plan: "Pro",
    amount: 399.0,
    status: "pending",
    issueDate: "2025-01-05",
    dueDate: "2025-01-20",
  },
  {
    id: "3",
    invoiceNumber: "INV-2025-003",
    customer: "Global Solutions",
    plan: "Starter",
    amount: 29.0,
    status: "overdue",
    issueDate: "2024-12-15",
    dueDate: "2024-12-30",
  },
];

const statusColors = {
  paid: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500",
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-500",
  overdue: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-500",
  cancelled: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export default function InvoicesPage() {
  const [filter, setFilter] = useState<string>("all");

  const filteredInvoices =
    filter === "all" ? invoices : invoices.filter((inv) => inv.status === filter);

  return (
    <div>
      <PageBreadcrumb pageTitle="Invoices" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Invoices</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Manage and track all customer invoices
            </p>
          </div>
          <div className="flex gap-2">
            {["all", "paid", "pending", "overdue", "cancelled"].map((status) => (
              <Button
                key={status}
                variant={filter === status ? "primary" : "outline"}
                size="sm"
                onClick={() => setFilter(status)}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Invoice #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Issue Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{invoice.customer}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{invoice.plan}</td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      ${invoice.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[invoice.status]}`}
                      >
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {invoice.issueDate}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {invoice.dueDate}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm">
                          <EyeIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <ArrowDownTrayIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <PrinterIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

