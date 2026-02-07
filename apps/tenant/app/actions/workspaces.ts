"use server";

import { 
  getWorkspaces, 
  getWorkspace, 
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  addUserToWorkspace,
  removeUserFromWorkspace,
  updateWorkspaceUser,
  getUserWorkspaces,
  getWorkspaceMembers
} from "@/core/database/workspaces";
import { requirePermission } from "@/core/permissions/middleware";
import type { Database } from "@/core/database";

type WorkspaceInsert = Database["public"]["Tables"]["workspaces"]["Insert"];
type WorkspaceUpdate = Database["public"]["Tables"]["workspaces"]["Update"];

/**
 * Server action to get all workspaces for current tenant
 */
export async function getAllWorkspaces(tenantId?: string) {
  await requirePermission("tenants.read", { tenantId });
  return getWorkspaces(tenantId);
}

/**
 * Server action to get a single workspace
 */
export async function getWorkspaceById(id: string) {
  await requirePermission("tenants.read");
  return getWorkspace(id);
}

/**
 * Server action to create a workspace
 */
export async function createWorkspaceAction(data: WorkspaceInsert) {
  await requirePermission("tenants.write", { tenantId: data.tenant_id });
  return createWorkspace(data);
}

/**
 * Server action to update a workspace
 */
export async function updateWorkspaceAction(id: string, data: WorkspaceUpdate) {
  await requirePermission("tenants.write");
  return updateWorkspace(id, data);
}

/**
 * Server action to delete a workspace
 */
export async function deleteWorkspaceAction(id: string) {
  await requirePermission("tenants.delete");
  return deleteWorkspace(id);
}

/**
 * Server action to add user to workspace
 */
export async function addUserToWorkspaceAction(
  workspaceId: string,
  userId: string,
  roleId?: string | null,
  permissions?: string[]
) {
  await requirePermission("users.write");
  return addUserToWorkspace(workspaceId, userId, roleId, permissions);
}

/**
 * Server action to remove user from workspace
 */
export async function removeUserFromWorkspaceAction(
  workspaceId: string,
  userId: string
) {
  await requirePermission("users.write");
  return removeUserFromWorkspace(workspaceId, userId);
}

/**
 * Server action to update workspace user
 */
export async function updateWorkspaceUserAction(
  workspaceId: string,
  userId: string,
  updates: {
    role_id?: string | null;
    permissions?: string[];
  }
) {
  await requirePermission("users.write");
  return updateWorkspaceUser(workspaceId, userId, updates);
}

/**
 * Server action to get current user's workspaces
 */
export async function getCurrentUserWorkspaces() {
  await requirePermission("users.read");
  return getUserWorkspaces();
}

/**
 * Server action to get workspace members
 */
export async function getWorkspaceMembersAction(workspaceId: string) {
  await requirePermission("users.read");
  return getWorkspaceMembers(workspaceId);
}

