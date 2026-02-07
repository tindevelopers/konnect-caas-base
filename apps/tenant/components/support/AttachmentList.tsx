"use client";

import { PaperClipIcon } from "@heroicons/react/24/outline";
import type { SupportTicketAttachment } from "@tinadmin/core/support";
import { getAttachmentUrl } from "@/app/actions/support/attachments";
import { useState } from "react";

interface AttachmentListProps {
  attachments: SupportTicketAttachment[];
}

export default function AttachmentList({ attachments }: AttachmentListProps) {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (attachment: SupportTicketAttachment) => {
    try {
      setDownloading(attachment.id);
      const url = await getAttachmentUrl(attachment.id);
      if (url) {
        window.open(url, "_blank");
      }
    } catch (error) {
      console.error("Failed to download attachment:", error);
      alert("Failed to download attachment. Please try again.");
    } finally {
      setDownloading(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  if (attachments.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500 dark:text-gray-400">
        No attachments
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700"
        >
          <div className="flex items-center gap-3">
            <PaperClipIcon className="h-5 w-5 text-gray-400" />
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                {attachment.file_name}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {formatFileSize(attachment.file_size)} • {attachment.mime_type}
              </div>
            </div>
          </div>
          <button
            onClick={() => handleDownload(attachment)}
            disabled={downloading === attachment.id}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {downloading === attachment.id ? "Downloading..." : "Download"}
          </button>
        </div>
      ))}
    </div>
  );
}

