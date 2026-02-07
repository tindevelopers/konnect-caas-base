"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/button/Button";
import { ArrowLeftIcon, PaperClipIcon } from "@heroicons/react/24/outline";
import type { SupportTicket, SupportTicketThread, SupportTicketAttachment } from "@tinadmin/core/support";
import ThreadList from "./ThreadList";
import AttachmentList from "./AttachmentList";
import { createTicketThread } from "@/app/actions/support/threads";
import { updateTicket } from "@/app/actions/support/tickets";
import { uploadTicketAttachment } from "@/app/actions/support/attachments";
import { getTicketAttachments } from "@/app/actions/support/attachments";

const priorityColors = {
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-500",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-500",
  urgent: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-500",
};

const statusColors = {
  open: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-500",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-500",
  resolved: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500",
  closed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

interface TicketDetailProps {
  ticket: SupportTicket;
  threads: SupportTicketThread[];
  attachments: SupportTicketAttachment[];
  isCustomerView?: boolean;
}

export default function TicketDetail({ ticket, threads: initialThreads, attachments: initialAttachments, isCustomerView = false }: TicketDetailProps) {
  const [threads, setThreads] = useState(initialThreads);
  const [attachments, setAttachments] = useState(initialAttachments);
  const [replyMessage, setReplyMessage] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [status, setStatus] = useState(ticket.status);
  const [priority, setPriority] = useState(ticket.priority);

  const handleReply = async () => {
    if (!replyMessage.trim()) return;

    try {
      setSubmitting(true);
      const newThread = await createTicketThread(ticket.id, {
        message: replyMessage,
        is_internal: isInternal,
      });
      setThreads([...threads, newThread]);
      setReplyMessage("");
      setIsInternal(false);
      
      // Refresh attachments in case files were uploaded with reply
      const updatedAttachments = await getTicketAttachments(ticket.id);
      setAttachments(updatedAttachments);
    } catch (error) {
      console.error("Failed to add reply:", error);
      alert("Failed to add reply. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleFileUpload = async () => {
    if (selectedFiles.length === 0) return;

    try {
      setUploading(true);
      for (const file of selectedFiles) {
        await uploadTicketAttachment(ticket.id, file);
      }
      
      // Refresh attachments
      const updatedAttachments = await getTicketAttachments(ticket.id);
      setAttachments(updatedAttachments);
      setSelectedFiles([]);
      
      // Reset file input
      const fileInput = document.getElementById("file-upload") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (error) {
      console.error("Failed to upload files:", error);
      alert("Failed to upload files. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateTicket(ticket.id, { status: newStatus as any });
      setStatus(newStatus as any);
    } catch (error) {
      console.error("Failed to update status:", error);
      alert("Failed to update status. Please try again.");
    }
  };

  const handlePriorityChange = async (newPriority: string) => {
    try {
      await updateTicket(ticket.id, { priority: newPriority as any });
      setPriority(newPriority as any);
    } catch (error) {
      console.error("Failed to update priority:", error);
      alert("Failed to update priority. Please try again.");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href={isCustomerView ? "/support" : "/saas/support/tickets"}>
          <Button variant="outline" size="sm">
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Tickets
          </Button>
        </Link>
      </div>

      {/* Ticket Header */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-4">
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {ticket.ticket_number}
              </h1>
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[status]}`}
              >
                {status === "in_progress" ? "In Progress" : status}
              </span>
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityColors[priority]}`}
              >
                {priority}
              </span>
            </div>
            <h2 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
              {ticket.subject}
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400">
              <div>
                <span className="font-medium">Created by:</span>{" "}
                {ticket.created_by_user?.full_name || ticket.created_by_user?.email || "Unknown"}
              </div>
              <div>
                <span className="font-medium">Assigned to:</span>{" "}
                {ticket.assigned_to_user?.full_name || "Unassigned"}
              </div>
              <div>
                <span className="font-medium">Category:</span>{" "}
                {ticket.category?.name || "Uncategorized"}
              </div>
              <div>
                <span className="font-medium">Created:</span> {formatDate(ticket.created_at)}
              </div>
            </div>
          </div>
          {!isCustomerView && (
            <div className="flex flex-col gap-2">
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              <select
                value={priority}
                onChange={(e) => handlePriorityChange(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          )}
        </div>

        {ticket.description && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Description</h3>
            <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
              {ticket.description}
            </p>
          </div>
        )}
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Attachments ({attachments.length})
          </h3>
          <AttachmentList attachments={attachments} />
        </div>
      )}

      {/* Threads */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Conversation ({threads.length})
        </h3>
        <ThreadList threads={threads} />
      </div>

      {/* Reply Form */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add Reply</h3>
        <div className="space-y-4">
          {!isCustomerView && (
            <div>
              <label className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Internal note (only visible to agents)
                </span>
              </label>
            </div>
          )}
          <textarea
            value={replyMessage}
            onChange={(e) => setReplyMessage(e.target.value)}
            placeholder="Type your reply here..."
            rows={6}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
          />
          
          {/* File Upload */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Attach Files (optional)
            </label>
            <div className="flex items-center gap-4">
              <input
                id="file-upload"
                type="file"
                multiple
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 dark:file:bg-brand-900/20 dark:file:text-brand-300"
              />
              {selectedFiles.length > 0 && (
                <Button
                  type="button"
                  onClick={handleFileUpload}
                  disabled={uploading}
                  size="sm"
                >
                  {uploading ? "Uploading..." : `Upload ${selectedFiles.length} file(s)`}
                </Button>
              )}
            </div>
            {selectedFiles.length > 0 && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Selected: {selectedFiles.map((f) => f.name).join(", ")}
              </div>
            )}
          </div>
          
          <div className="flex justify-end">
            <Button onClick={handleReply} disabled={!replyMessage.trim() || submitting}>
              {submitting ? "Sending..." : "Send Reply"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

