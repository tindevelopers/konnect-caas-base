"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { ArrowPathIcon, XMarkIcon } from "@heroicons/react/24/outline";
import React from "react";

interface FailedPayment {
  id: string;
  invoiceNumber: string;
  customer: string;
  amount: number;
  method: string;
  failureReason: string;
  attempts: number;
  lastAttempt: string;
  nextRetry: string;
}

const failedPayments: FailedPayment[] = [
  {
    id: "1",
    invoiceNumber: "INV-2024-150",
    customer: "Global Solutions",
    amount: 29.0,
    method: "Credit Card",
    failureReason: "Insufficient funds",
    attempts: 3,
    lastAttempt: "2025-01-10 09:00 AM",
    nextRetry: "2025-01-17 09:00 AM",
  },
  {
    id: "2",
    invoiceNumber: "INV-2025-005",
    customer: "StartupXYZ",
    amount: 199.0,
    method: "Credit Card",
    failureReason: "Card expired",
    attempts: 1,
    lastAttempt: "2025-01-15 02:30 PM",
    nextRetry: "2025-01-16 02:30 PM",
  },
  {
    id: "3",
    invoiceNumber: "INV-2025-008",
    customer: "SmallBiz Inc",
    amount: 29.0,
    method: "PayPal",
    failureReason: "Payment declined",
    attempts: 2,
    lastAttempt: "2025-01-14 11:15 AM",
    nextRetry: "2025-01-18 11:15 AM",
  },
];

export default function FailedPaymentsPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Failed Payments" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Failed Payments</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Monitor and retry failed payment attempts
            </p>
          </div>
        </div>

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
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Method
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Failure Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Attempts
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Next Retry
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {failedPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {payment.invoiceNumber}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{payment.customer}</td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      ${payment.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{payment.method}</td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-red-600 dark:text-red-500">
                        {payment.failureReason}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          payment.attempts >= 3
                            ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-500"
                            : "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-500"
                        }`}
                      >
                        {payment.attempts}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {payment.nextRetry}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm">
                          <ArrowPathIcon className="h-4 w-4" />
                          Retry Now
                        </Button>
                        <Button variant="outline" size="sm">
                          <XMarkIcon className="h-4 w-4" />
                          Cancel
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

