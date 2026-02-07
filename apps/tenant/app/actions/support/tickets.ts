"use server";

import {
  getSupportTickets,
  getSupportTicketById,
  getSupportTicketByNumber,
  createSupportTicket,
  updateSupportTicket,
  deleteSupportTicket,
  getSupportTicketStats,
  type CreateTicketInput,
  type UpdateTicketInput,
  type TicketStatus,
  type TicketPriority,
} from "@tinadmin/core/support";
import { getTenantForSupport } from "./tenant-helper";
import { notifyTicketCreated, notifyTicketUpdated } from "./notifications";
import { createClient } from "@/core/database/server";

/**
 * Get all support tickets for the current tenant
 */
export async function getAllSupportTickets(filters?: {
  status?: TicketStatus;
  priority?: TicketPriority;
  assigned_to?: string;
  created_by?: string;
  category_id?: string;
}) {
  try {
    const tenantId = await getTenantForSupport();
    return await getSupportTickets(filters, tenantId);
  } catch (error: any) {
    // If no tenant found (Platform Admin with no tenants), return empty array
    if (error.message?.includes("No tenants found")) {
      return [];
    }
    throw error;
  }
}

/**
 * Get a support ticket by ID
 */
export async function getSupportTicket(ticketId: string) {
  try {
    const tenantId = await getTenantForSupport();
    return await getSupportTicketById(ticketId, tenantId);
  } catch (error: any) {
    if (error.message?.includes("No tenants found")) {
      return null;
    }
    throw error;
  }
}

/**
 * Get a support ticket by ticket number
 */
export async function getSupportTicketByTicketNumber(ticketNumber: string) {
  try {
    const tenantId = await getTenantForSupport();
    return await getSupportTicketByNumber(ticketNumber, tenantId);
  } catch (error: any) {
    if (error.message?.includes("No tenants found")) {
      return null;
    }
    throw error;
  }
}

/**
 * Create a new support ticket
 */
export async function createTicket(input: CreateTicketInput) {
  const tenantId = await getTenantForSupport();
  const ticket = await createSupportTicket(input, tenantId);
  
  // Send email notification
  await notifyTicketCreated(ticket);
  
  return ticket;
}

/**
 * Update a support ticket
 */
export async function updateTicket(ticketId: string, input: UpdateTicketInput) {
  const tenantId = await getTenantForSupport();
  const supabase = await createClient();
  
  // Get old ticket data to detect changes
  const oldTicket = await getSupportTicketById(ticketId, tenantId);
  const ticket = await updateSupportTicket(ticketId, input, tenantId);
  
  // Detect changes and send notifications
  if (oldTicket) {
    const changes: any = {};
    if (input.status && oldTicket.status !== input.status) changes.status = input.status;
    if (input.priority && oldTicket.priority !== input.priority) changes.priority = input.priority;
    if (input.assigned_to !== undefined && oldTicket.assigned_to !== input.assigned_to) {
      changes.assigned_to = input.assigned_to;
    }
    
    if (Object.keys(changes).length > 0) {
      await notifyTicketUpdated(ticket, changes);
    }
  }
  
  return ticket;
}

/**
 * Delete a support ticket
 */
export async function deleteTicket(ticketId: string) {
  const tenantId = await getTenantForSupport();
  return await deleteSupportTicket(ticketId, tenantId);
}

/**
 * Get support ticket statistics
 */
export async function getTicketStats() {
  try {
    const tenantId = await getTenantForSupport();
    return await getSupportTicketStats(tenantId);
  } catch (error: any) {
    // If no tenant found, return empty stats
    if (error.message?.includes("No tenants found")) {
      return {
        total: 0,
        open: 0,
        in_progress: 0,
        resolved: 0,
        closed: 0,
        pending: 0,
        solved: 0,
      };
    }
    throw error;
  }
}

