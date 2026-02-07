"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import TextArea from "@/components/form/input/TextArea";
import { PlusIcon, PencilIcon, EyeIcon, TrashIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  type: "transactional" | "marketing" | "notification";
  status: "active" | "draft";
  lastModified: string;
}

const templates: EmailTemplate[] = [
  {
    id: "1",
    name: "Welcome Email",
    subject: "Welcome to {{product_name}}!",
    type: "transactional",
    status: "active",
    lastModified: "2025-01-15",
  },
  {
    id: "2",
    name: "Password Reset",
    subject: "Reset your password",
    type: "transactional",
    status: "active",
    lastModified: "2025-01-10",
  },
  {
    id: "3",
    name: "Invoice Receipt",
    subject: "Your invoice #{{invoice_number}}",
    type: "transactional",
    status: "active",
    lastModified: "2025-01-12",
  },
  {
    id: "4",
    name: "Monthly Newsletter",
    subject: "What's new this month",
    type: "marketing",
    status: "draft",
    lastModified: "2025-01-14",
  },
];

export default function EmailTemplatesPage() {
  const [templateList, setTemplateList] = useState<EmailTemplate[]>(templates);
  const createModal = useModal();
  const previewModal = useModal();
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    type: "transactional" as "transactional" | "marketing" | "notification",
    content: "",
  });
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);

  const handleCreate = () => {
    const newTemplate: EmailTemplate = {
      id: Date.now().toString(),
      name: formData.name,
      subject: formData.subject,
      type: formData.type,
      status: "draft",
      lastModified: new Date().toISOString().split("T")[0],
    };
    setTemplateList([...templateList, newTemplate]);
    createModal.closeModal();
    setFormData({ name: "", subject: "", type: "transactional", content: "" });
  };

  const handlePreview = (template: EmailTemplate) => {
    setPreviewTemplate(template);
    previewModal.openModal();
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Email Templates" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Email Templates</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Create and manage email templates for notifications and campaigns
            </p>
          </div>
          <Button onClick={createModal.openModal}>
            <PlusIcon className="h-4 w-4" />
            Create Template
          </Button>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Template Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Last Modified
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {templateList.map((template) => (
                  <tr key={template.id}>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {template.name}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{template.subject}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-500/15 dark:text-blue-500">
                        {template.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          template.status === "active"
                            ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                      >
                        {template.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {template.lastModified}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => handlePreview(template)}>
                          <EyeIcon className="h-4 w-4" />
                        </Button>
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

      {/* Create Template Modal */}
      <Modal isOpen={createModal.isOpen} onClose={createModal.closeModal} className="max-w-[700px] m-4">
        <div className="p-6">
          <h3 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Create Email Template</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                type="text"
                defaultValue={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Welcome Email"
              />
            </div>
            <div>
              <Label htmlFor="template-subject">Subject Line</Label>
              <Input
                id="template-subject"
                type="text"
                defaultValue={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="e.g., Welcome to {{product_name}}!"
              />
            </div>
            <div>
              <Label htmlFor="template-type">Template Type</Label>
              <select
                id="template-type"
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as typeof formData.type })
                }
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
              >
                <option value="transactional">Transactional</option>
                <option value="marketing">Marketing</option>
                <option value="notification">Notification</option>
              </select>
            </div>
            <div>
              <Label htmlFor="template-content">Email Content</Label>
              <TextArea
                id="template-content"
                rows={10}
                value={formData.content}
                onChange={(value) => setFormData({ ...formData, content: value })}
                placeholder="Enter email HTML content..."
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={createModal.closeModal} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleCreate} className="flex-1">
                Create Template
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Preview Modal */}
      <Modal isOpen={previewModal.isOpen} onClose={previewModal.closeModal} className="max-w-[800px] m-4">
        <div className="p-6">
          <h3 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
            Preview: {previewTemplate?.name}
          </h3>
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Subject: {previewTemplate?.subject}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Email content preview would appear here...
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={previewModal.closeModal}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

