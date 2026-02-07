"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { PlusIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface Refund {
  id: string;
  invoiceNumber: string;
  customer: string;
  originalAmount: number;
  refundAmount: number;
  reason: string;
  status: "pending" | "processed" | "cancelled";
  requestedDate: string;
  processedDate?: string;
}

const refunds: Refund[] = [
  {
    id: "1",
    invoiceNumber: "INV-2024-145",
    customer: "Enterprise Ltd",
    originalAmount: 399.0,
    refundAmount: 399.0,
    reason: "Service cancellation",
    status: "processed",
    requestedDate: "2024-12-28",
    processedDate: "2024-12-29",
  },
  {
    id: "2",
    invoiceNumber: "INV-2025-010",
    customer: "TechStart Inc",
    originalAmount: 199.0,
    refundAmount: 99.5,
    reason: "Partial refund - billing error",
    status: "pending",
    requestedDate: "2025-01-16",
  },
];

const statusColors = {
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-500",
  processed: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500",
  cancelled: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export default function RefundsPage() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    invoiceNumber: "",
    refundAmount: "",
    reason: "",
  });

  return (
    <div>
      <PageBreadcrumb pageTitle="Refunds" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Refunds</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Process and track customer refunds
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <PlusIcon className="h-4 w-4" />
            Create Refund
          </Button>
        </div>

        {showForm && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Create New Refund
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="invoice">Invoice Number</Label>
                <Input
                  id="invoice"
                  type="text"
                  defaultValue={formData.invoiceNumber}
                  onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                  placeholder="INV-2025-XXX"
                />
              </div>
              <div>
                <Label htmlFor="amount">Refund Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  defaultValue={formData.refundAmount}
                  onChange={(e) => setFormData({ ...formData, refundAmount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="reason">Reason</Label>
                <textarea
                  id="reason"
                  defaultValue={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                  placeholder="Reason for refund"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button>Process Refund</Button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Invoice
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Original Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Refund Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Requested
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {refunds.map((refund) => (
                  <tr key={refund.id}>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {refund.invoiceNumber}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{refund.customer}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                      ${refund.originalAmount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      ${refund.refundAmount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {refund.reason}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[refund.status]}`}
                      >
                        {refund.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {refund.requestedDate}
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

