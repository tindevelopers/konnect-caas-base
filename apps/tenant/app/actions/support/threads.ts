"use server";

import {
  getSupportTicketThreads,
  getSupportTicketThreadById,
  createSupportTicketThread,
  updateSupportTicketThread,
  deleteSupportTicketThread,
  type CreateThreadInput,
} from "@tinadmin/core/support";
import { getTenantForSupport } from "./tenant-helper";
import { notifyTicketReply } from "./notifications";
import { getSupportTicketById } from "@tinadmin/core/support";
import { createClient } from "@/core/database/server";

/**
 * Get all threads for a support ticket
 */
export async function getTicketThreads(
  ticketId: string,
  options?: {
    includeInternal?: boolean;
  }
) {
  const tenantId = await getTenantForSupport();
  return await getSupportTicketThreads(ticketId, options, tenantId);
}

/**
 * Get a thread by ID
 */
export async function getTicketThread(threadId: string) {
  const tenantId = await getTenantForSupport();
  return await getSupportTicketThreadById(threadId, tenantId);
}

/**
 * Create a new thread/reply for a support ticket
 */
export async function createTicketThread(
  ticketId: string,
  input: CreateThreadInput
) {
  const tenantId = await getTenantForSupport();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  const thread = await createSupportTicketThread(ticketId, input, tenantId);
  
  // Get ticket to check if reply is from agent or customer
  const ticket = await getSupportTicketById(ticketId, tenantId);
  if (ticket) {
    const isAgentReply = user?.id !== ticket.created_by;
    await notifyTicketReply(ticket, thread, isAgentReply);
  }
  
  return thread;
}

/**
 * Update a thread
 */
export async function updateTicketThread(
  threadId: string,
  input: { message?: string; is_internal?: boolean }
) {
  const tenantId = await getTenantForSupport();
  return await updateSupportTicketThread(threadId, input, tenantId);
}

/**
 * Delete a thread
 */
export async function deleteTicketThread(threadId: string) {
  const tenantId = await getTenantForSupport();
  return await deleteSupportTicketThread(threadId, tenantId);
}

