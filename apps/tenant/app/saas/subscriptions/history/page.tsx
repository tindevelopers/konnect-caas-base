"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import React, { useState } from "react";

interface SubscriptionHistory {
  id: string;
  customer: string;
  plan: string;
  action: "created" | "upgraded" | "downgraded" | "cancelled" | "renewed";
  fromPlan?: string;
  toPlan?: string;
  date: string;
  amount: number;
}

const historyData: SubscriptionHistory[] = [
  {
    id: "1",
    customer: "Acme Corp",
    plan: "Professional",
    action: "created",
    date: "2025-01-15",
    amount: 199,
  },
  {
    id: "2",
    customer: "TechStart Inc",
    plan: "Pro",
    action: "upgraded",
    fromPlan: "Professional",
    toPlan: "Pro",
    date: "2025-01-14",
    amount: 200,
  },
  {
    id: "3",
    customer: "Global Solutions",
    plan: "Starter",
    action: "downgraded",
    fromPlan: "Professional",
    toPlan: "Starter",
    date: "2025-01-13",
    amount: -170,
  },
  {
    id: "4",
    customer: "StartupXYZ",
    plan: "Professional",
    action: "cancelled",
    date: "2025-01-12",
    amount: 0,
  },
  {
    id: "5",
    customer: "Enterprise Ltd",
    plan: "Pro",
    action: "renewed",
    date: "2025-01-11",
    amount: 399,
  },
];

const actionColors = {
  created: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500",
  upgraded: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-500",
  downgraded: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-500",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-500",
  renewed: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-500",
};

export default function SubscriptionHistoryPage() {
  const [filter, setFilter] = useState<string>("all");

  const filteredHistory =
    filter === "all"
      ? historyData
      : historyData.filter((item) => item.action === filter);

  return (
    <div>
      <PageBreadcrumb pageTitle="Subscription History" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Subscription History</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Track all subscription changes and events
            </p>
          </div>
          <div className="flex gap-2">
            {["all", "created", "upgraded", "downgraded", "cancelled", "renewed"].map((action) => (
              <Button
                key={action}
                variant={filter === action ? "primary" : "outline"}
                size="sm"
                onClick={() => setFilter(action)}
              >
                {action.charAt(0).toUpperCase() + action.slice(1)}
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
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Plan Change
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredHistory.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{item.date}</td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{item.customer}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${actionColors[item.action]}`}
                      >
                        {item.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {item.fromPlan && item.toPlan ? (
                        <span>
                          {item.fromPlan} → {item.toPlan}
                        </span>
                      ) : (
                        <span>{item.plan}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`font-medium ${
                          item.amount > 0
                            ? "text-green-600 dark:text-green-500"
                            : item.amount < 0
                            ? "text-red-600 dark:text-red-500"
                            : "text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        {item.amount > 0 ? "+" : ""}${item.amount.toFixed(2)}
                      </span>
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

