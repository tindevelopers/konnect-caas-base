"use server";

import {
  getSupportCategories,
  getSupportCategoryById,
  createSupportCategory,
  updateSupportCategory,
  deleteSupportCategory,
  type CreateCategoryInput,
} from "@tinadmin/core/support";
import { getTenantForSupport } from "./tenant-helper";

/**
 * Get all support categories for the current tenant
 */
export async function getAllSupportCategories() {
  try {
    const tenantId = await getTenantForSupport();
    return await getSupportCategories(tenantId);
  } catch (error: any) {
    // If no tenant found (Platform Admin with no tenants), return empty array
    if (error.message?.includes("No tenants found")) {
      return [];
    }
    throw error;
  }
}

/**
 * Get a support category by ID
 */
export async function getSupportCategory(categoryId: string) {
  try {
    const tenantId = await getTenantForSupport();
    return await getSupportCategoryById(categoryId, tenantId);
  } catch (error: any) {
    if (error.message?.includes("No tenants found")) {
      return null;
    }
    throw error;
  }
}

/**
 * Create a new support category
 */
export async function createCategory(input: CreateCategoryInput) {
  const tenantId = await getTenantForSupport();
  return await createSupportCategory(input, tenantId);
}

/**
 * Update a support category
 */
export async function updateCategory(
  categoryId: string,
  input: Partial<CreateCategoryInput>
) {
  const tenantId = await getTenantForSupport();
  return await updateSupportCategory(categoryId, input, tenantId);
}

/**
 * Delete a support category
 */
export async function deleteCategory(categoryId: string) {
  const tenantId = await getTenantForSupport();
  return await deleteSupportCategory(categoryId, tenantId);
}

