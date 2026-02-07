"use server";

import { createClient } from "@/core/database/server";
import { getCurrentTenant } from "@/core/multi-tenancy/server";
import { getTenantForCrm } from "./tenant-helper";

// Temporary types until database types are regenerated
type Activity = {
  id: string;
  tenant_id: string;
  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  task_id: string | null;
  note_id: string | null;
  type: "created" | "updated" | "deleted" | "note_added" | "task_created" | "task_completed" | "deal_stage_changed" | "email_sent" | "call_made" | "meeting_scheduled";
  description: string;
  metadata: Record<string, any> | null;
  created_by: string | null;
  created_at: string;
};

/**
 * Get activities for a specific entity (contact, company, deal, or task)
 */
export async function getActivities(filters: {
  contact_id?: string;
  company_id?: string;
  deal_id?: string;
  task_id?: string;
}): Promise<Activity[]> {
  try {
    const tenantId = await getTenantForCrm();

    const supabase = await createClient();
    let query = (supabase.from("activities") as any)
      .select("*")
      .eq("tenant_id", tenantId);

    if (filters.contact_id) {
      query = query.eq("contact_id", filters.contact_id);
    }

    if (filters.company_id) {
      query = query.eq("company_id", filters.company_id);
    }

    if (filters.deal_id) {
      query = query.eq("deal_id", filters.deal_id);
    }

    if (filters.task_id) {
      query = query.eq("task_id", filters.task_id);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching activities:", error);
      throw error;
    }

    return (data as Activity[]) || [];
  } catch (error: any) {
    // If no tenant found (Platform Admin with no tenants), return empty array
    if (error.message?.includes("No tenants found")) {
      console.warn("No tenant found for current user, returning empty activities list");
      return [];
    }
    throw error;
  }
}

/**
 * Create a new activity
 */
export async function createActivity(
  activityData: Omit<Activity, "id" | "tenant_id" | "created_at" | "created_by">
): Promise<Activity> {
  const tenantId = await getTenantForCrm();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await (supabase.from("activities") as any)
    .insert({
      ...activityData,
      tenant_id: tenantId,
      created_by: user?.id || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating activity:", error);
    throw error;
  }

  return data as Activity;
}

/**
 * Log activity for entity creation
 */
export async function logEntityCreated(
  type: "contact" | "company" | "deal" | "task",
  entityId: string,
  entityName: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const activityData: any = {
      type: "created",
      description: `${type.charAt(0).toUpperCase() + type.slice(1)} "${entityName}" was created`,
      metadata: metadata || {},
    };

    if (type === "contact") activityData.contact_id = entityId;
    else if (type === "company") activityData.company_id = entityId;
    else if (type === "deal") activityData.deal_id = entityId;
    else if (type === "task") activityData.task_id = entityId;

    await createActivity(activityData);
  } catch (error) {
    // Don't throw - activity logging should not break the main operation
    console.error("Error logging entity created activity:", error);
  }
}

/**
 * Log activity for entity update
 */
export async function logEntityUpdated(
  type: "contact" | "company" | "deal" | "task",
  entityId: string,
  entityName: string,
  changes?: Record<string, any>
): Promise<void> {
  try {
    const activityData: any = {
      type: "updated",
      description: `${type.charAt(0).toUpperCase() + type.slice(1)} "${entityName}" was updated`,
      metadata: { changes: changes || {} },
    };

    if (type === "contact") activityData.contact_id = entityId;
    else if (type === "company") activityData.company_id = entityId;
    else if (type === "deal") activityData.deal_id = entityId;
    else if (type === "task") activityData.task_id = entityId;

    await createActivity(activityData);
  } catch (error) {
    console.error("Error logging entity updated activity:", error);
  }
}

/**
 * Log activity for entity deletion
 */
export async function logEntityDeleted(
  type: "contact" | "company" | "deal" | "task",
  entityId: string,
  entityName: string
): Promise<void> {
  try {
    const activityData: any = {
      type: "deleted",
      description: `${type.charAt(0).toUpperCase() + type.slice(1)} "${entityName}" was deleted`,
      metadata: {},
    };

    if (type === "contact") activityData.contact_id = entityId;
    else if (type === "company") activityData.company_id = entityId;
    else if (type === "deal") activityData.deal_id = entityId;
    else if (type === "task") activityData.task_id = entityId;

    await createActivity(activityData);
  } catch (error) {
    console.error("Error logging entity deleted activity:", error);
  }
}

/**
 * Log activity for note addition
 */
export async function logNoteAdded(
  noteId: string,
  entityType: "contact" | "company" | "deal",
  entityId: string
): Promise<void> {
  try {
    const activityData: any = {
      type: "note_added",
      description: "A note was added",
      note_id: noteId,
      metadata: {},
    };

    if (entityType === "contact") activityData.contact_id = entityId;
    else if (entityType === "company") activityData.company_id = entityId;
    else if (entityType === "deal") activityData.deal_id = entityId;

    await createActivity(activityData);
  } catch (error) {
    console.error("Error logging note added activity:", error);
  }
}
