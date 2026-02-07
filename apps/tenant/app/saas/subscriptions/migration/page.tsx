"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface Migration {
  id: string;
  customer: string;
  fromPlan: string;
  toPlan: string;
  proration: number;
  effectiveDate: string;
  status: "pending" | "completed" | "failed";
}

const pendingMigrations: Migration[] = [
  {
    id: "1",
    customer: "Acme Corp",
    fromPlan: "Starter",
    toPlan: "Professional",
    proration: 85.5,
    effectiveDate: "2025-01-20",
    status: "pending",
  },
  {
    id: "2",
    customer: "TechStart Inc",
    fromPlan: "Professional",
    toPlan: "Pro",
    proration: 100.0,
    effectiveDate: "2025-01-22",
    status: "pending",
  },
];

export default function PlanMigrationPage() {
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [fromPlan, setFromPlan] = useState("");
  const [toPlan, setToPlan] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");

  return (
    <div>
      <PageBreadcrumb pageTitle="Plan Migration" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Plan Migration</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Migrate customers between subscription plans with proration calculations
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Migration Form */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Create Migration
            </h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="customer">Customer</Label>
                <Input
                  id="customer"
                  type="text"
                  defaultValue={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  placeholder="Select customer"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="from-plan">From Plan</Label>
                  <select
                    id="from-plan"
                    value={fromPlan}
                    onChange={(e) => setFromPlan(e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                  >
                    <option value="">Select plan</option>
                    <option value="starter">Starter</option>
                    <option value="professional">Professional</option>
                    <option value="pro">Pro</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="to-plan">To Plan</Label>
                  <select
                    id="to-plan"
                    value={toPlan}
                    onChange={(e) => setToPlan(e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                  >
                    <option value="">Select plan</option>
                    <option value="starter">Starter</option>
                    <option value="professional">Professional</option>
                    <option value="pro">Pro</option>
                  </select>
                </div>
              </div>
              <div>
                <Label htmlFor="effective-date">Effective Date</Label>
                <Input
                  id="effective-date"
                  type="date"
                  defaultValue={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                />
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Proration Amount</span>
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">$0.00</span>
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Calculated based on remaining billing period
                </p>
              </div>
              <Button className="w-full">
                Create Migration
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Pending Migrations */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Pending Migrations
            </h2>
            <div className="space-y-4">
              {pendingMigrations.map((migration) => (
                <div
                  key={migration.id}
                  className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-medium text-gray-900 dark:text-white">{migration.customer}</span>
                    <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-500">
                      {migration.status}
                    </span>
                  </div>
                  <div className="mb-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <span>{migration.fromPlan}</span>
                    <ArrowRightIcon className="h-4 w-4" />
                    <span>{migration.toPlan}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Effective: {migration.effectiveDate}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      ${migration.proration.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

