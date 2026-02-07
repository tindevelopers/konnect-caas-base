"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { PlusIcon, ArrowDownTrayIcon, PlayIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface ReportField {
  id: string;
  name: string;
  type: "metric" | "dimension";
  dataSource: string;
}

const availableFields: ReportField[] = [
  { id: "1", name: "User Count", type: "metric", dataSource: "users" },
  { id: "2", name: "Revenue", type: "metric", dataSource: "subscriptions" },
  { id: "3", name: "Signup Date", type: "dimension", dataSource: "users" },
  { id: "4", name: "Plan Type", type: "dimension", dataSource: "subscriptions" },
];

export default function CustomReportBuilderPage() {
  const [reportName, setReportName] = useState("");
  const [selectedFields, setSelectedFields] = useState<ReportField[]>([]);
  const [filters, setFilters] = useState<Array<{ field: string; operator: string; value: string }>>([]);

  const handleAddField = (field: ReportField) => {
    if (!selectedFields.find((f) => f.id === field.id)) {
      setSelectedFields([...selectedFields, field]);
    }
  };

  const handleRemoveField = (fieldId: string) => {
    setSelectedFields(selectedFields.filter((f) => f.id !== fieldId));
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Custom Report Builder" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
              Custom Report Builder
            </h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Build custom reports with drag-and-drop fields and filters
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <ArrowDownTrayIcon className="h-4 w-4" />
              Save Report
            </Button>
            <Button>
              <PlayIcon className="h-4 w-4" />
              Run Report
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Report Configuration */}
          <div className="lg:col-span-2 space-y-6">
            {/* Report Name */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <Label htmlFor="report-name">Report Name</Label>
              <Input
                id="report-name"
                type="text"
                defaultValue={reportName}
                onChange={(e) => setReportName(e.target.value)}
                placeholder="Enter report name"
                className="mt-2"
              />
            </div>

            {/* Selected Fields */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                Selected Fields
              </h2>
              {selectedFields.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No fields selected. Drag fields from the right panel or click to add.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedFields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800"
                    >
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">{field.name}</span>
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          ({field.type})
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveField(field.id)}
                        className="text-red-600 hover:text-red-700 dark:text-red-500"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Filters */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Filters</h2>
              {filters.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No filters applied. Click &quot;Add Filter&quot; to add filtering conditions.
                </p>
              ) : (
                <div className="space-y-2">
                  {filters.map((filter, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800"
                    >
                      <select className="h-9 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90">
                        <option>{filter.field}</option>
                      </select>
                      <select className="h-9 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90">
                        <option>{filter.operator}</option>
                      </select>
                      <Input type="text" defaultValue={filter.value} className="flex-1" />
                    </div>
                  ))}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() =>
                  setFilters([...filters, { field: "Select field", operator: "equals", value: "" }])
                }
              >
                <PlusIcon className="h-4 w-4" />
                Add Filter
              </Button>
            </div>

            {/* Preview */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Preview</h2>
              <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Report preview will appear here
                </p>
              </div>
            </div>
          </div>

          {/* Available Fields */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                Available Fields
              </h2>
              <div className="space-y-2">
                {availableFields.map((field) => (
                  <div
                    key={field.id}
                    className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 p-3 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
                    onClick={() => handleAddField(field)}
                  >
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">{field.name}</span>
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                        ({field.type})
                      </span>
                    </div>
                    <PlusIcon className="h-4 w-4 text-gray-400" />
                  </div>
                ))}
              </div>
            </div>

            {/* Data Sources */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                Data Sources
              </h2>
              <div className="space-y-2">
                {["users", "subscriptions", "invoices", "payments"].map((source) => (
                  <div
                    key={source}
                    className="rounded-lg border border-gray-200 p-3 dark:border-gray-800"
                  >
                    <span className="font-medium text-gray-900 dark:text-white">
                      {source.charAt(0).toUpperCase() + source.slice(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

