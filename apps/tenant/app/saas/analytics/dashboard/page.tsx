"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import React from "react";

export default function AnalyticsDashboardPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Analytics Dashboard" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Analytics Dashboard</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Overview of key metrics and analytics
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Users</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">12,480</p>
            <p className="mt-1 text-sm text-green-600 dark:text-green-500">+12.5% from last month</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">Active Subscriptions</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">8,234</p>
            <p className="mt-1 text-sm text-green-600 dark:text-green-500">+8.2% from last month</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">Monthly Revenue</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">$245,890</p>
            <p className="mt-1 text-sm text-green-600 dark:text-green-500">+15.3% from last month</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">Churn Rate</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">2.4%</p>
            <p className="mt-1 text-sm text-red-600 dark:text-red-500">-0.3% from last month</p>
          </div>
        </div>

        {/* Charts Placeholder */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Revenue Trend
            </h2>
            <div className="flex h-64 items-center justify-center text-gray-400">
              Chart placeholder
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              User Growth
            </h2>
            <div className="flex h-64 items-center justify-center text-gray-400">
              Chart placeholder
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

