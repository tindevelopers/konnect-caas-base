"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { PlusIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface Feature {
  id: string;
  name: string;
  description: string;
  type: "boolean" | "numeric" | "text";
  defaultValue: string;
  plans: string[];
}

const initialFeatures: Feature[] = [
  {
    id: "1",
    name: "Monthly Orders",
    description: "Number of orders allowed per month",
    type: "numeric",
    defaultValue: "10000",
    plans: ["Starter", "Professional", "Pro"],
  },
  {
    id: "2",
    name: "Storage",
    description: "Storage space in GB",
    type: "numeric",
    defaultValue: "5",
    plans: ["Starter"],
  },
  {
    id: "3",
    name: "Priority Support",
    description: "Access to priority customer support",
    type: "boolean",
    defaultValue: "false",
    plans: ["Professional", "Pro"],
  },
  {
    id: "4",
    name: "Custom Templates",
    description: "Ability to create custom templates",
    type: "boolean",
    defaultValue: "false",
    plans: ["Pro"],
  },
];

export default function PlanFeaturesPage() {
  const [features] = useState<Feature[]>(initialFeatures);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [, setIsCreating] = useState(false);

  return (
    <div>
      <PageBreadcrumb pageTitle="Plan Features" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Plan Features</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Configure features and limits for subscription plans
            </p>
          </div>
          <Button onClick={() => setIsCreating(true)}>
            <PlusIcon className="h-4 w-4" />
            Add Feature
          </Button>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Feature Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Default Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Available in Plans
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {features.map((feature) => (
                  <tr key={feature.id}>
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{feature.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{feature.description}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-500/15 dark:text-blue-500">
                        {feature.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{feature.defaultValue}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {feature.plans.map((plan) => (
                          <span
                            key={plan}
                            className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          >
                            {plan}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm">
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <TrashIcon className="h-4 w-4" />
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

