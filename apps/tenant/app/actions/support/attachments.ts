"use server";

import {
  getSupportTicketAttachments,
  getSupportTicketAttachmentById,
  createSupportTicketAttachment,
  deleteSupportTicketAttachment,
  getAttachmentDownloadUrl,
} from "@tinadmin/core/support";
import { getTenantForSupport } from "./tenant-helper";
import { createClient } from "@/core/database/server";

/**
 * Get all attachments for a support ticket
 */
export async function getTicketAttachments(ticketId: string, threadId?: string) {
  const tenantId = await getTenantForSupport();
  return await getSupportTicketAttachments(ticketId, threadId, tenantId);
}

/**
 * Get an attachment by ID
 */
export async function getTicketAttachment(attachmentId: string) {
  const tenantId = await getTenantForSupport();
  return await getSupportTicketAttachmentById(attachmentId, tenantId);
}

/**
 * Upload a file attachment for a support ticket
 */
export async function uploadTicketAttachment(
  ticketId: string,
  file: File,
  threadId?: string
) {
  const tenantId = await getTenantForSupport();
  const supabase = await createClient();
  
  // Generate unique file name
  const timestamp = Date.now();
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const filePath = `${tenantId}/${ticketId}/${timestamp}-${sanitizedFileName}`;
  
  // Upload file to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("support-tickets")
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    });
  
  if (uploadError) {
    throw new Error(`Failed to upload file: ${uploadError.message}`);
  }
  
  // Create attachment record
  return await createSupportTicketAttachment(
    {
      ticket_id: ticketId,
      thread_id: threadId,
      file_name: file.name,
      file_path: `support-tickets/${filePath}`,
      file_size: file.size,
      mime_type: file.type,
    },
    tenantId
  );
}

/**
 * Delete an attachment
 */
export async function deleteTicketAttachment(attachmentId: string) {
  const tenantId = await getTenantForSupport();
  return await deleteSupportTicketAttachment(attachmentId, tenantId);
}

/**
 * Get a signed URL for downloading an attachment
 */
export async function getAttachmentUrl(
  attachmentId: string,
  expiresIn: number = 3600
) {
  const tenantId = await getTenantForSupport();
  return await getAttachmentDownloadUrl(attachmentId, expiresIn, tenantId);
}

