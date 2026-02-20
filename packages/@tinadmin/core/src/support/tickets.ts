"use server";

import { createClient } from "@/core/database/server";
import { createTenantAwareClient, createTenantAwareServerClient, getSupabaseClient } from "@/core/database/tenant-client";
import type { Database } from "@/core/database";
import type {
  SupportTicket,
  CreateTicketInput,
  UpdateTicketInput,
  TicketStatus,
  TicketPriority,
} from "./types";

/**
 * Get all support tickets for the current tenant
 */
export async function getSupportTickets(
  filters?: {
    status?: TicketStatus;
    priority?: TicketPriority;
    assigned_to?: string;
    created_by?: string;
    category_id?: string;
  },
  tenantId?: string
): Promise<SupportTicket[]> {
  const client = tenantId 
    ? await createTenantAwareClient(tenantId)
    : await createClient();
  const supabase = getSupabaseClient(client);
  
  let query = supabase
    .from("support_tickets")
    .select(`
      *,
      category:support_categories(*),
      created_by_user:users!support_tickets_created_by_fkey(id, full_name, email, avatar_url),
      assigned_to_user:users!support_tickets_assigned_to_fkey(id, full_name, email, avatar_url)
    `)
    .order("created_at", { ascending: false });
  
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.priority) {
    query = query.eq("priority", filters.priority);
  }
  if (filters?.assigned_to) {
    query = query.eq("assigned_to", filters.assigned_to);
  }
  if (filters?.created_by) {
    query = query.eq("created_by", filters.created_by);
  }
  if (filters?.category_id) {
    query = query.eq("category_id", filters.category_id);
  }
  
  const { data, error } = await query;
  
  if (error) {
    throw new Error(`Failed to fetch support tickets: ${error.message}`);
  }
  
  return data || [];
}

/**
 * Get a support ticket by ID
 */
export async function getSupportTicketById(
  ticketId: string,
  tenantId?: string
): Promise<SupportTicket | null> {
  const client = tenantId 
    ? await createTenantAwareClient(tenantId)
    : await createClient();
  const supabase = getSupabaseClient(client);
  
  const { data, error } = await supabase
    .from("support_tickets")
    .select(`
      *,
      category:support_categories(*),
      created_by_user:users!support_tickets_created_by_fkey(id, full_name, email, avatar_url),
      assigned_to_user:users!support_tickets_assigned_to_fkey(id, full_name, email, avatar_url)
    `)
    .eq("id", ticketId)
    .single();
  
  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to fetch support ticket: ${error.message}`);
  }
  
  return data;
}

/**
 * Get a support ticket by ticket number
 */
export async function getSupportTicketByNumber(
  ticketNumber: string,
  tenantId?: string
): Promise<SupportTicket | null> {
  const client = tenantId 
    ? await createTenantAwareClient(tenantId)
    : await createClient();
  const supabase = getSupabaseClient(client);
  
  const { data, error } = await supabase
    .from("support_tickets")
    .select(`
      *,
      category:support_categories(*),
      created_by_user:users!support_tickets_created_by_fkey(id, full_name, email, avatar_url),
      assigned_to_user:users!support_tickets_assigned_to_fkey(id, full_name, email, avatar_url)
    `)
    .eq("ticket_number", ticketNumber)
    .single();
  
  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to fetch support ticket: ${error.message}`);
  }
  
  return data;
}

/**
 * Create a new support ticket
 */
export async function createSupportTicket(
  input: CreateTicketInput,
  tenantId?: string
): Promise<SupportTicket> {
  // Use server client so auth.getUser() sees the request session (cookies)
  const client = tenantId
    ? await createTenantAwareServerClient(tenantId)
    : await createClient();
  const supabase = getSupabaseClient(client);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not authenticated");
  }
  
  // Get tenant_id from user if not provided
  let finalTenantId = tenantId;
  if (!finalTenantId) {
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    
    if (!userData || !(userData as { tenant_id: string }).tenant_id) {
      throw new Error("User does not belong to a tenant");
    }
    finalTenantId = (userData as { tenant_id: string }).tenant_id;
  }
  
  const { data, error } = await (supabase
    .from("support_tickets") as any)
    .insert({
      tenant_id: finalTenantId as string,
      subject: input.subject,
      description: input.description || null,
      priority: input.priority || "medium",
      category_id: input.category_id || null,
      created_by: user.id,
      assigned_to: input.assigned_to || null,
      support_code: input.support_code || null,
      support_ref: input.support_ref || null,
    })
    .select(`
      *,
      category:support_categories(*),
      created_by_user:users!support_tickets_created_by_fkey(id, full_name, email, avatar_url),
      assigned_to_user:users!support_tickets_assigned_to_fkey(id, full_name, email, avatar_url)
    `)
    .single();
  
  if (error) {
    throw new Error(`Failed to create support ticket: ${error.message}`);
  }
  
  return data;
}

/**
 * Update a support ticket
 */
export async function updateSupportTicket(
  ticketId: string,
  input: UpdateTicketInput,
  tenantId?: string
): Promise<SupportTicket> {
  const client = tenantId 
    ? await createTenantAwareClient(tenantId)
    : await createClient();
  const supabase = getSupabaseClient(client);
  
  const updateData: Record<string, any> = {};
  if (input.subject !== undefined) updateData.subject = input.subject;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.priority !== undefined) updateData.priority = input.priority;
  if (input.category_id !== undefined) updateData.category_id = input.category_id;
  if (input.assigned_to !== undefined) updateData.assigned_to = input.assigned_to;
  if (input.escalated_to_platform_admin_at !== undefined) updateData.escalated_to_platform_admin_at = input.escalated_to_platform_admin_at;
  
  const { data, error } = await (supabase
    .from("support_tickets") as any)
    .update(updateData)
    .eq("id", ticketId)
    .select(`
      *,
      category:support_categories(*),
      created_by_user:users!support_tickets_created_by_fkey(id, full_name, email, avatar_url),
      assigned_to_user:users!support_tickets_assigned_to_fkey(id, full_name, email, avatar_url)
    `)
    .single();
  
  if (error) {
    throw new Error(`Failed to update support ticket: ${error.message}`);
  }
  
  return data;
}

/**
 * Delete a support ticket
 */
export async function deleteSupportTicket(
  ticketId: string,
  tenantId?: string
): Promise<void> {
  const client = tenantId 
    ? await createTenantAwareClient(tenantId)
    : await createClient();
  const supabase = getSupabaseClient(client);
  
  const { error } = await supabase
    .from("support_tickets")
    .delete()
    .eq("id", ticketId);
  
  if (error) {
    throw new Error(`Failed to delete support ticket: ${error.message}`);
  }
}

/**
 * Get ticket statistics for the current tenant
 */
export async function getSupportTicketStats(
  tenantId?: string
): Promise<{
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
  pending: number; // open + in_progress
  solved: number; // resolved + closed
}> {
  const client = tenantId 
    ? await createTenantAwareClient(tenantId)
    : await createClient();
  const supabase = getSupabaseClient(client);
  
  const { data, error } = await supabase
    .from("support_tickets")
    .select("status");
  
  if (error) {
    throw new Error(`Failed to fetch ticket statistics: ${error.message}`);
  }
  
  const stats = {
    total: data?.length || 0,
    open: data?.filter((t: { status: string }) => t.status === "open").length || 0,
    in_progress: data?.filter((t: { status: string }) => t.status === "in_progress").length || 0,
    resolved: data?.filter((t: { status: string }) => t.status === "resolved").length || 0,
    closed: data?.filter((t: { status: string }) => t.status === "closed").length || 0,
    pending: 0,
    solved: 0,
  };
  
  stats.pending = stats.open + stats.in_progress;
  stats.solved = stats.resolved + stats.closed;
  
  return stats;
}

