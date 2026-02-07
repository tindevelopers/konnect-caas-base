"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { PlusIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface TaxRule {
  id: string;
  country: string;
  region?: string;
  taxRate: number;
  taxName: string;
  isActive: boolean;
}

const taxRules: TaxRule[] = [
  {
    id: "1",
    country: "United States",
    region: "California",
    taxRate: 8.5,
    taxName: "Sales Tax",
    isActive: true,
  },
  {
    id: "2",
    country: "United States",
    region: "New York",
    taxRate: 8.0,
    taxName: "Sales Tax",
    isActive: true,
  },
  {
    id: "3",
    country: "United Kingdom",
    taxRate: 20.0,
    taxName: "VAT",
    isActive: true,
  },
  {
    id: "4",
    country: "Germany",
    taxRate: 19.0,
    taxName: "VAT",
    isActive: true,
  },
];

export default function TaxSettingsPage() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    country: "",
    region: "",
    taxRate: "",
    taxName: "",
  });

  return (
    <div>
      <PageBreadcrumb pageTitle="Tax Settings" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Tax Settings</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Configure tax rates and rules for different regions
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <PlusIcon className="h-4 w-4" />
            Add Tax Rule
          </Button>
        </div>

        {showForm && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Add Tax Rule
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  type="text"
                  defaultValue={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="United States"
                />
              </div>
              <div>
                <Label htmlFor="region">Region/State (Optional)</Label>
                <Input
                  id="region"
                  type="text"
                  defaultValue={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  placeholder="California"
                />
              </div>
              <div>
                <Label htmlFor="tax-name">Tax Name</Label>
                <Input
                  id="tax-name"
                  type="text"
                  defaultValue={formData.taxName}
                  onChange={(e) => setFormData({ ...formData, taxName: e.target.value })}
                  placeholder="Sales Tax, VAT, GST"
                />
              </div>
              <div>
                <Label htmlFor="tax-rate">Tax Rate (%)</Label>
                <Input
                  id="tax-rate"
                  type="number"
                  step="0.01"
                  defaultValue={formData.taxRate}
                  onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                  placeholder="8.5"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button>Save Tax Rule</Button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Country
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Region
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Tax Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Tax Rate
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
                {taxRules.map((rule) => (
                  <tr key={rule.id}>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {rule.country}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                      {rule.region || "—"}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{rule.taxName}</td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {rule.taxRate}%
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          rule.isActive
                            ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                      >
                        {rule.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
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

