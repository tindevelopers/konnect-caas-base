"use client";

export const dynamic = 'force-dynamic';

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { PlusIcon, PencilIcon } from "@heroicons/react/24/outline";
import { TrashIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface Category {
  id: string;
  name: string;
  description: string;
  ticketCount: number;
  defaultAssignee?: string;
}

const categories: Category[] = [
  {
    id: "1",
    name: "Technical Issue",
    description: "Problems with product functionality or technical support",
    ticketCount: 45,
    defaultAssignee: "Support Agent 1",
  },
  {
    id: "2",
    name: "Billing",
    description: "Questions about billing, invoices, and payments",
    ticketCount: 23,
    defaultAssignee: "Billing Team",
  },
  {
    id: "3",
    name: "Feature Request",
    description: "Suggestions for new features or improvements",
    ticketCount: 67,
    defaultAssignee: "Product Team",
  },
  {
    id: "4",
    name: "Account Management",
    description: "Account settings, user management, and access issues",
    ticketCount: 12,
  },
];

export default function SupportCategoriesPage() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    defaultAssignee: "",
  });

  return (
    <div>
      <PageBreadcrumb pageTitle="Support Categories" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
              Support Categories
            </h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Organize support tickets by category
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <PlusIcon className="h-4 w-4" />
            Add Category
          </Button>
        </div>

        {showForm && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Add Category</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="category-name">Category Name</Label>
                <Input
                  id="category-name"
                  type="text"
                  defaultValue={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Technical Issue"
                />
              </div>
              <div>
                <Label htmlFor="category-description">Description</Label>
                <textarea
                  id="category-description"
                  defaultValue={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                  placeholder="Brief description of this category"
                />
              </div>
              <div>
                <Label htmlFor="default-assignee">Default Assignee (Optional)</Label>
                <Input
                  id="default-assignee"
                  type="text"
                  defaultValue={formData.defaultAssignee}
                  onChange={(e) => setFormData({ ...formData, defaultAssignee: e.target.value })}
                  placeholder="e.g., Support Agent 1"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button>Save Category</Button>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {categories.map((category) => (
            <div
              key={category.id}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {category.name}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {category.description}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <PencilIcon className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Active Tickets</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {category.ticketCount}
                  </span>
                </div>
                {category.defaultAssignee && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Default Assignee</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {category.defaultAssignee}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

