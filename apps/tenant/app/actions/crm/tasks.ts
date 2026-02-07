"use server";

import { createClient } from "@/core/database/server";
import { getCurrentTenant } from "@/core/multi-tenancy/server";
import { getTenantForCrm } from "./tenant-helper";
import { logEntityCreated, logEntityUpdated, logEntityDeleted } from "./activities";
// Temporary types until database types are regenerated
type Task = {
  id: string;
  tenant_id: string;
  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  reminder_date: string | null;
  completed_at: string | null;
  created_by: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  contact?: any | null;
  company?: any | null;
  deal?: any | null;
};

/**
 * Get all tasks for the current tenant
 */
export async function getTasks(filters?: {
  status?: string;
  assigned_to?: string;
  due_date?: string;
}): Promise<Task[]> {
  try {
    const tenantId = await getTenantForCrm();

    const supabase = await createClient();
    let query = (supabase.from("tasks") as any)
      .select(`
        *,
        contact:contacts(*),
        company:companies(*),
        deal:deals(*)
      `)
      .eq("tenant_id", tenantId);

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }

    if (filters?.assigned_to) {
      query = query.eq("assigned_to", filters.assigned_to);
    }

    if (filters?.due_date) {
      query = query.lte("due_date", filters.due_date);
    }

    const { data, error } = await query.order("due_date", { ascending: true, nullsFirst: false });

    if (error) {
      console.error("Error fetching tasks:", error);
      throw error;
    }

    return (data as Task[]) || [];
  } catch (error: any) {
    // If no tenant found (Platform Admin with no tenants), return empty array
    if (error.message?.includes("No tenants found")) {
      console.warn("No tenant found for current user, returning empty tasks list");
      return [];
    }
    throw error;
  }
}

/**
 * Get a single task by ID
 */
export async function getTask(id: string): Promise<Task | null> {
  const tenantId = await getTenantForCrm();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      *,
      contact:contacts(*),
      company:companies(*),
      deal:deals(*)
    `)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (error) {
    console.error("Error fetching task:", error);
    throw error;
  }

  return data as Task | null;
}

/**
 * Create a new task
 */
export async function createTask(
  taskData: Omit<Task, "id" | "tenant_id" | "created_at" | "updated_at" | "created_by" | "contact" | "company" | "deal">
): Promise<Task> {
  const tenantId = await getTenantForCrm();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await (supabase.from("tasks") as any)
    .insert({
      ...taskData,
      tenant_id: tenantId,
      created_by: user?.id || null,
    })
    .select(`
      *,
      contact:contacts(*),
      company:companies(*),
      deal:deals(*)
    `)
    .single();

  if (error) {
    console.error("Error creating task:", error);
    throw error;
  }

  // Log activity
  await logEntityCreated("task", data.id, data.title);

  return data as Task;
}

/**
 * Update a task
 */
export async function updateTask(
  id: string,
  updates: Partial<Omit<Task, "id" | "tenant_id" | "created_at" | "created_by" | "contact" | "company" | "deal">>
): Promise<Task> {
  const tenantId = await getTenantForCrm();

  const supabase = await createClient();
  
  // If marking as done, set completed_at
  if (updates.status === "done" && !updates.completed_at) {
    updates.completed_at = new Date().toISOString();
  }

  const { data, error } = await (supabase.from("tasks") as any)
    .update(updates)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select(`
      *,
      contact:contacts(*),
      company:companies(*),
      deal:deals(*)
    `)
    .single();

  if (error) {
    console.error("Error updating task:", error);
    throw error;
  }

  return data as Task;
}

/**
 * Delete a task
 */
export async function deleteTask(id: string): Promise<void> {
  const tenantId = await getTenantForCrm();

  // Get task title before deletion for activity log
  const supabase = await createClient();
  const { data: task } = await (supabase.from("tasks") as any)
    .select("title")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  const { error } = await (supabase.from("tasks") as any)
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("Error deleting task:", error);
    throw error;
  }

  // Log activity
  if (task) {
    await logEntityDeleted("task", id, task.title);
  }
}
