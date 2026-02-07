"use client";

export const dynamic = 'force-dynamic';

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import TextArea from "@/components/form/input/TextArea";
import { PlusIcon, PencilIcon, MagnifyingGlassIcon, TrashIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface Article {
  id: string;
  title: string;
  category: string;
  views: number;
  helpful: number;
  status: "published" | "draft";
  lastUpdated: string;
}

const articles: Article[] = [
  {
    id: "1",
    title: "Getting Started with SaaS Platform",
    category: "Getting Started",
    views: 1250,
    helpful: 89,
    status: "published",
    lastUpdated: "2025-01-10",
  },
  {
    id: "2",
    title: "How to Reset Your Password",
    category: "Account Management",
    views: 890,
    helpful: 67,
    status: "published",
    lastUpdated: "2025-01-08",
  },
  {
    id: "3",
    title: "Understanding Billing Cycles",
    category: "Billing",
    views: 450,
    helpful: 34,
    status: "published",
    lastUpdated: "2025-01-12",
  },
  {
    id: "4",
    title: "API Integration Guide",
    category: "Technical",
    views: 0,
    helpful: 0,
    status: "draft",
    lastUpdated: "2025-01-15",
  },
];

export default function KnowledgeBasePage() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    content: "",
  });

  const filteredArticles = articles.filter(
    (article) =>
      article.title.toLowerCase().includes(search.toLowerCase()) ||
      article.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageBreadcrumb pageTitle="Knowledge Base" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Knowledge Base</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Create and manage help articles for customers
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <PlusIcon className="h-4 w-4" />
            Create Article
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search articles..."
            className="h-11 w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
          />
        </div>

        {showForm && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Create Article
            </h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="article-title">Article Title</Label>
                <Input
                  id="article-title"
                  type="text"
                  defaultValue={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Getting Started Guide"
                />
              </div>
              <div>
                <Label htmlFor="article-category">Category</Label>
                <Input
                  id="article-category"
                  type="text"
                  defaultValue={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., Getting Started"
                />
              </div>
              <div>
                <Label htmlFor="article-content">Content</Label>
                <TextArea
                  id="article-content"
                  rows={10}
                  defaultValue={formData.content}
                  onChange={(value) => setFormData({ ...formData, content: value })}
                  placeholder="Article content..."
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button>Save Article</Button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Views
                  </th>
                  <th className="px-6 py-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Helpful
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Last Updated
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredArticles.map((article) => (
                  <tr key={article.id}>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {article.title}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{article.category}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                      {article.views.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                      {article.helpful.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          article.status === "published"
                            ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                      >
                        {article.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {article.lastUpdated}
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

