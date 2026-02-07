"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { PlusIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface FieldMapping {
  id: string;
  sourceField: string;
  targetField: string;
  transformation?: string;
}

const mappings: FieldMapping[] = [
  {
    id: "1",
    sourceField: "email_address",
    targetField: "email",
  },
  {
    id: "2",
    sourceField: "full_name",
    targetField: "name",
  },
  {
    id: "3",
    sourceField: "user_role",
    targetField: "role",
    transformation: "uppercase",
  },
];

export default function DataMappingPage() {
  const [mappingList, setMappingList] = useState<FieldMapping[]>(mappings);
  const [newMapping, setNewMapping] = useState({
    sourceField: "",
    targetField: "",
    transformation: "",
  });

  const handleAddMapping = () => {
    const mapping: FieldMapping = {
      id: Date.now().toString(),
      sourceField: newMapping.sourceField,
      targetField: newMapping.targetField,
      transformation: newMapping.transformation || undefined,
    };
    setMappingList([...mappingList, mapping]);
    setNewMapping({ sourceField: "", targetField: "", transformation: "" });
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Data Mapping" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Data Mapping</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Map source fields to target fields for data imports
          </p>
        </div>

        {/* Add Mapping */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Add Field Mapping</h2>
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <Label htmlFor="source-field">Source Field</Label>
              <Input
                id="source-field"
                type="text"
                value={newMapping.sourceField}
                onChange={(e) => setNewMapping({ ...newMapping, sourceField: e.target.value })}
                placeholder="e.g., email_address"
              />
            </div>
            <div className="flex items-end">
              <ArrowRightIcon className="h-5 w-5 text-gray-400" />
            </div>
            <div>
              <Label htmlFor="target-field">Target Field</Label>
              <Input
                id="target-field"
                type="text"
                value={newMapping.targetField}
                onChange={(e) => setNewMapping({ ...newMapping, targetField: e.target.value })}
                placeholder="e.g., email"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAddMapping} className="w-full">
                <PlusIcon className="h-4 w-4" />
                Add
              </Button>
            </div>
          </div>
          <div className="mt-4">
            <Label htmlFor="transformation">Transformation (Optional)</Label>
            <select
              id="transformation"
              value={newMapping.transformation}
              onChange={(e) => setNewMapping({ ...newMapping, transformation: e.target.value })}
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
            >
              <option value="">None</option>
              <option value="uppercase">Uppercase</option>
              <option value="lowercase">Lowercase</option>
              <option value="trim">Trim</option>
            </select>
          </div>
        </div>

        {/* Mappings List */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Source Field
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Target Field
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Transformation
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {mappingList.map((mapping) => (
                  <tr key={mapping.id}>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {mapping.sourceField}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                      {mapping.targetField}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                      {mapping.transformation || "—"}
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

