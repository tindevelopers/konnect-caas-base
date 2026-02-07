"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface TargetingRule {
  id: string;
  flag: string;
  type: "user" | "segment" | "percentage";
  value: string;
  enabled: boolean;
}

const targetingRules: TargetingRule[] = [
  {
    id: "1",
    flag: "New Dashboard UI",
    type: "percentage",
    value: "50",
    enabled: true,
  },
  {
    id: "2",
    flag: "Beta Features",
    type: "user",
    value: "user_123,user_456",
    enabled: true,
  },
  {
    id: "3",
    flag: "Advanced Analytics",
    type: "segment",
    value: "enterprise_customers",
    enabled: true,
  },
];

export default function FeatureFlagTargetingPage() {
  const [rules, setRules] = useState<TargetingRule[]>(targetingRules);
  const [newRule, setNewRule] = useState({
    flag: "",
    type: "user" as "user" | "segment" | "percentage",
    value: "",
  });

  const handleAddRule = () => {
    const rule: TargetingRule = {
      id: Date.now().toString(),
      flag: newRule.flag,
      type: newRule.type,
      value: newRule.value,
      enabled: true,
    };
    setRules([...rules, rule]);
    setNewRule({ flag: "", type: "user", value: "" });
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Feature Flag Targeting" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Targeting Rules</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Configure targeting rules for feature flags
          </p>
        </div>

        {/* Add New Rule */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Add Targeting Rule</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="target-flag">Feature Flag</Label>
              <Input
                id="target-flag"
                type="text"
                value={newRule.flag}
                onChange={(e) => setNewRule({ ...newRule, flag: e.target.value })}
                placeholder="Select flag"
              />
            </div>
            <div>
              <Label htmlFor="target-type">Targeting Type</Label>
              <select
                id="target-type"
                value={newRule.type}
                onChange={(e) =>
                  setNewRule({ ...newRule, type: e.target.value as typeof newRule.type })
                }
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
              >
                <option value="user">Specific Users</option>
                <option value="segment">User Segment</option>
                <option value="percentage">Percentage</option>
              </select>
            </div>
            <div>
              <Label htmlFor="target-value">Value</Label>
              <div className="flex gap-2">
                <Input
                  id="target-value"
                  type="text"
                  value={newRule.value}
                  onChange={(e) => setNewRule({ ...newRule, value: e.target.value })}
                  placeholder={
                    newRule.type === "percentage"
                      ? "0-100"
                      : newRule.type === "user"
                      ? "user_id1,user_id2"
                      : "segment_name"
                  }
                />
                <Button onClick={handleAddRule}>
                  <PlusIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Rules List */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Feature Flag
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{rule.flag}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{rule.type}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{rule.value}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          rule.enabled
                            ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                      >
                        {rule.enabled ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end">
                        <Button variant="outline" size="sm">
                          <XMarkIcon className="h-4 w-4" />
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

