"use server";

import { stripe } from "@/core/billing/config";
import { createAdminClient } from "@/core/database/admin-client";
import type { Database } from "@/core/database";

type StripeCustomer = Database["public"]["Tables"]["stripe_customers"]["Insert"];

/**
 * Create or retrieve a Stripe customer for a tenant
 */
export async function createOrRetrieveCustomer(tenantId: string): Promise<{
  success: boolean;
  customerId?: string;
  error?: string;
}> {
  try {
    const adminClient = createAdminClient();

    // Get tenant information
    const tenantResult: { data: any | null; error: any } = await adminClient
      .from("tenants")
      .select("*")
      .eq("id", tenantId)
      .single();

    const tenant = tenantResult.data;
    const tenantError = tenantResult.error;

    if (tenantError || !tenant) {
      return { success: false, error: "Tenant not found" };
    }

    // Check if customer already exists
    const customerResult: { data: { stripe_customer_id: string } | null; error: any } = await adminClient
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("tenant_id", tenantId)
      .single();

    const existingCustomer = customerResult.data;
    if (existingCustomer) {
      return { success: true, customerId: existingCustomer.stripe_customer_id };
    }

    // Get primary user for tenant (for email)
    const roleResult: { data: { id: string } | null; error: any } = await adminClient
      .from("roles")
      .select("id")
      .eq("name", "Organization Admin")
      .single();

    const roleData = roleResult.data;
    if (!roleData?.id) {
      return { success: false, error: "Organization Admin role not found" };
    }

    const userResult: { data: { email: string; full_name: string } | null; error: any } = await adminClient
      .from("users")
      .select("email, full_name")
      .eq("tenant_id", tenantId)
      .eq("role_id", roleData.id)
      .limit(1)
      .single();
    
    const primaryUser = userResult.data;

    // Create Stripe customer
    const customer = await stripe.customers.create({
      email: primaryUser?.email || `tenant-${tenantId}@example.com`,
      name: primaryUser?.full_name || tenant.name,
      metadata: {
        tenant_id: tenantId,
        tenant_name: tenant.name,
        tenant_domain: tenant.domain,
      },
    });

    // Save customer to database
    let userId: string | null = null;
    if (primaryUser) {
      const userIdResult: { data: { id: string } | null; error: any } = await adminClient
        .from("users")
        .select("id")
        .eq("email", primaryUser.email)
        .single();
      userId = userIdResult.data?.id || null;
    }

    const customerData: StripeCustomer = {
      tenant_id: tenantId,
      user_id: userId,
      stripe_customer_id: customer.id,
      email: customer.email || primaryUser?.email || "",
      name: customer.name || tenant.name,
      metadata: customer.metadata as any,
    };

    const insertResult: { error: any } = await adminClient
      .from("stripe_customers")
      // @ts-expect-error - Supabase type inference issue with Database types
      .insert(customerData);
    
    const insertError = insertResult.error;

    if (insertError) {
      // If insert fails, try to delete the Stripe customer
      await stripe.customers.del(customer.id).catch(() => {});
      return { success: false, error: insertError.message };
    }

    return { success: true, customerId: customer.id };
  } catch (error) {
    console.error("Error creating Stripe customer:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create customer",
    };
  }
}

/**
 * Get Stripe customer for a tenant
 */
export async function getCustomer(tenantId: string): Promise<{
  success: boolean;
  customer?: any;
  error?: string;
}> {
  try {
    const adminClient = createAdminClient();

    const customerResult: { data: any | null; error: any } = await adminClient
      .from("stripe_customers")
      .select("*")
      .eq("tenant_id", tenantId)
      .single();

    const customer = customerResult.data;
    const error = customerResult.error;

    if (error || !customer) {
      return { success: false, error: "Customer not found" };
    }

    // Fetch full customer details from Stripe
    const stripeCustomer = await stripe.customers.retrieve(customer.stripe_customer_id);

    return { success: true, customer: stripeCustomer };
  } catch (error) {
    console.error("Error retrieving Stripe customer:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to retrieve customer",
    };
  }
}

/**
 * Update Stripe customer
 */
export async function updateCustomer(
  tenantId: string,
  updates: {
    email?: string;
    name?: string;
    phone?: string;
    address?: any;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminClient = createAdminClient();

    const customerResult: { data: { stripe_customer_id: string } | null; error: any } = await adminClient
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("tenant_id", tenantId)
      .single();

    const customer = customerResult.data;
    if (!customer) {
      return { success: false, error: "Customer not found" };
    }

    // Update in Stripe
    await stripe.customers.update(customer.stripe_customer_id, {
      email: updates.email,
      name: updates.name,
      phone: updates.phone,
      address: updates.address,
    });

    // Update in database
    const updateResult: { error: any } = await adminClient
      .from("stripe_customers")
      // @ts-expect-error - Supabase type inference issue with Database types
      .update({
        email: updates.email,
        name: updates.name,
        phone: updates.phone,
        address: updates.address,
      })
      .eq("tenant_id", tenantId);

    const error = updateResult.error;
    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error updating Stripe customer:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update customer",
    };
  }
}

