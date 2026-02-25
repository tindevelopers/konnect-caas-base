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
import { notifyTicketCreated, notifyTicketUpdated, notifyTicketEscalated } from "./notifications";
import { createClient } from "@/core/database/server";
import { createAdminClient } from "@/core/database/admin-client";
import { parseSupportCodeAndRef } from "@/src/core/errors/parse-support-code";

/**
 * Get Workspace Admins (organization admins) for a tenant for ticket assignment.
 * Returns first few so we can assign new error-report tickets to org admin.
 */
export async function getWorkspaceAdminsForTenant(tenantId: string): Promise<Array<{ id: string; full_name: string; email: string }>> {
  const admin = createAdminClient();
  let roleId: string | null = null;
  const { data: wsRoleData } = await admin.from("roles").select("id").eq("name", "Workspace Admin").limit(1).single();
  const wsRole = wsRoleData as { id: string } | null;
  if (wsRole?.id) roleId = wsRole.id;
  if (!roleId) {
    const { data: orgRoleData } = await admin.from("roles").select("id").eq("name", "Organization Admin").limit(1).single();
    const orgRole = orgRoleData as { id: string } | null;
    if (orgRole?.id) roleId = orgRole.id;
  }
  if (!roleId) return [];
  const { data: users } = await admin
    .from("users")
    .select("id, full_name, email")
    .eq("tenant_id", tenantId)
    .eq("role_id", roleId)
    .limit(10);
  return (users ?? []) as Array<{ id: string; full_name: string; email: string }>;
}

/**
 * Create a support ticket from a failed user action. Assigns to organization admin (Workspace Admin).
 * Ticket is visible to org admin first; they can escalate to platform admin from the ticket detail.
 */
export async function createSupportTicketFromError(args: {
  errorMessage: string;
  /** Optional context, e.g. "Place number order" */
  actionContext?: string;
}): Promise<{ id: string; ticket_number: string }> {
  const tenantId = await getTenantForSupport();
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) throw new Error("You must be logged in to create a support ticket.");

  const { supportCode, supportRef } = parseSupportCodeAndRef(args.errorMessage);
  const subject = supportCode
    ? `Error report: ${supportCode}${args.actionContext ? ` (${args.actionContext})` : ""}`
    : `Error report${args.actionContext ? `: ${args.actionContext}` : ""}`;

  const { data: creator } = await supabase
    .from("users")
    .select("full_name, email")
    .eq("id", authUser.id)
    .single();
  const creatorName = (creator as { full_name?: string } | null)?.full_name ?? authUser.email ?? "Unknown user";
  const creatorEmail = (creator as { email?: string } | null)?.email ?? authUser.email ?? "";

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .single();
  const tenantName = (tenant as { name?: string } | null)?.name ?? tenantId;

  const description = [
    "This ticket was created from a failed user action.",
    args.actionContext ? `Action: ${args.actionContext}` : null,
    "",
    "Tenant: " + tenantName,
    "User: " + creatorName + (creatorEmail ? ` (${creatorEmail})` : ""),
    supportCode ? `Support code: ${supportCode}` : null,
    supportRef ? `Ref: ${supportRef}` : null,
    "",
    "Error message:",
    args.errorMessage,
  ]
    .filter(Boolean)
    .join("\n");

  const [firstOrgAdmin] = await getWorkspaceAdminsForTenant(tenantId);
  const input: CreateTicketInput = {
    subject,
    description,
    priority: "high",
    support_code: supportCode ?? undefined,
    support_ref: supportRef ?? undefined,
    assigned_to: firstOrgAdmin?.id,
  };
  const ticket = await createTicket(input);
  return { id: ticket.id, ticket_number: ticket.ticket_number };
}

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
    if (input.escalated_to_platform_admin_at && !(oldTicket as { escalated_to_platform_admin_at?: string | null }).escalated_to_platform_admin_at) {
      await notifyTicketEscalated(ticket);
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

