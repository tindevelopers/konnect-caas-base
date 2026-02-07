"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface Payment {
  id: string;
  invoiceNumber: string;
  customer: string;
  amount: number;
  method: string;
  status: "success" | "failed" | "pending" | "refunded";
  transactionId: string;
  date: string;
}

const payments: Payment[] = [
  {
    id: "1",
    invoiceNumber: "INV-2025-001",
    customer: "Acme Corp",
    amount: 199.0,
    method: "Credit Card",
    status: "success",
    transactionId: "txn_abc123",
    date: "2025-01-15 10:30 AM",
  },
  {
    id: "2",
    invoiceNumber: "INV-2025-002",
    customer: "TechStart Inc",
    amount: 399.0,
    method: "Credit Card",
    status: "pending",
    transactionId: "txn_xyz789",
    date: "2025-01-16 02:15 PM",
  },
  {
    id: "3",
    invoiceNumber: "INV-2024-150",
    customer: "Global Solutions",
    amount: 29.0,
    method: "PayPal",
    status: "failed",
    transactionId: "txn_failed456",
    date: "2024-12-30 09:45 AM",
  },
  {
    id: "4",
    invoiceNumber: "INV-2024-145",
    customer: "Enterprise Ltd",
    amount: 399.0,
    method: "Credit Card",
    status: "refunded",
    transactionId: "txn_refund789",
    date: "2024-12-28 04:20 PM",
  },
];

const statusIcons = {
  success: CheckIcon,
  failed: XMarkIcon,
  pending: CheckIcon,
  refunded: XMarkIcon,
};

const statusColors = {
  success: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500",
  failed: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-500",
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-500",
  refunded: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export default function PaymentHistoryPage() {
  const [filter, setFilter] = useState<string>("all");

  const filteredPayments =
    filter === "all" ? payments : payments.filter((p) => p.status === filter);

  return (
    <div>
      <PageBreadcrumb pageTitle="Payment History" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Payment History</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Track all payment transactions and their status
            </p>
          </div>
          <div className="flex gap-2">
            {["all", "success", "pending", "failed", "refunded"].map((status) => (
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
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Invoice
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Method
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Transaction ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredPayments.map((payment) => {
                  const Icon = statusIcons[payment.status];
                  return (
                    <tr key={payment.id}>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{payment.date}</td>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                        {payment.invoiceNumber}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{payment.customer}</td>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                        ${payment.amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{payment.method}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {payment.transactionId}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[payment.status]}`}
                        >
                          <Icon className="h-3 w-3" />
                          {payment.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

