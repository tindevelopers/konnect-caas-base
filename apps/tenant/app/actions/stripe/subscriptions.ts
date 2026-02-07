"use server";

import { stripe } from "@/core/billing/config";
import { createAdminClient } from "@/core/database/admin-client";
import { getCurrentTenant } from "@/core/multi-tenancy/server";
import { requirePermission } from "@/core/permissions/middleware";
import type Stripe from "stripe";

/**
 * Get all subscriptions for the current tenant
 */
export async function getSubscriptions(): Promise<{
  success: boolean;
  subscriptions?: any[];
  error?: string;
}> {
  try {
    await requirePermission("billing.read");

    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return { success: false, error: "No tenant context found" };
    }

    const adminClient = createAdminClient();

    const { data: subscriptions, error } = await adminClient
      .from("stripe_subscriptions")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, subscriptions: subscriptions || [] };
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch subscriptions",
    };
  }
}

/**
 * Get active subscription for the current tenant
 */
export async function getActiveSubscription(): Promise<{
  success: boolean;
  subscription?: any;
  error?: string;
}> {
  try {
    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return { success: false, error: "No tenant context found" };
    }

    const adminClient = createAdminClient();

    const { data: subscription, error } = await adminClient
      .from("stripe_subscriptions")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("status", ["active", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found" error
      return { success: false, error: error.message };
    }

    return { success: true, subscription: subscription || null };
  } catch (error) {
    console.error("Error fetching active subscription:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch active subscription",
    };
  }
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = true): Promise<{
  success: boolean;
  subscription?: Stripe.Subscription;
  error?: string;
}> {
  try {
    await requirePermission("billing.write");

    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return { success: false, error: "No tenant context found" };
    }

    const adminClient = createAdminClient();

    // Verify subscription belongs to tenant
    const result: { data: { stripe_subscription_id: string } | null; error: any } = await adminClient
      .from("stripe_subscriptions")
      .select("stripe_subscription_id")
      .eq("tenant_id", tenantId)
      .eq("id", subscriptionId)
      .single();

    const dbSubscription = result.data;
    if (!dbSubscription) {
      return { success: false, error: "Subscription not found" };
    }

    // Cancel in Stripe
    const subscription = await stripe.subscriptions.update(dbSubscription.stripe_subscription_id, {
      cancel_at_period_end: cancelAtPeriodEnd,
    });

    // Update in database
    await adminClient
      .from("stripe_subscriptions")
      // @ts-expect-error - Supabase type inference issue with update operations
      .update({
        cancel_at_period_end: cancelAtPeriodEnd,
        canceled_at: cancelAtPeriodEnd ? new Date().toISOString() : null,
      } as any)
      .eq("id", subscriptionId);

    return { success: true, subscription };
  } catch (error) {
    console.error("Error canceling subscription:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to cancel subscription",
    };
  }
}

/**
 * Resume a canceled subscription
 */
export async function resumeSubscription(subscriptionId: string): Promise<{
  success: boolean;
  subscription?: Stripe.Subscription;
  error?: string;
}> {
  try {
    await requirePermission("billing.write");

    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return { success: false, error: "No tenant context found" };
    }

    const adminClient = createAdminClient();

    // Verify subscription belongs to tenant
    const result: { data: { stripe_subscription_id: string } | null; error: any } = await adminClient
      .from("stripe_subscriptions")
      .select("stripe_subscription_id")
      .eq("tenant_id", tenantId)
      .eq("id", subscriptionId)
      .single();

    const dbSubscription = result.data;
    if (!dbSubscription) {
      return { success: false, error: "Subscription not found" };
    }

    // Resume in Stripe
    const subscription = await stripe.subscriptions.update(dbSubscription.stripe_subscription_id, {
      cancel_at_period_end: false,
    });

    // Update in database
    await adminClient
      .from("stripe_subscriptions")
      // @ts-expect-error - Supabase type inference issue with update operations
      .update({
        cancel_at_period_end: false,
        canceled_at: null,
      } as any)
      .eq("id", subscriptionId);

    return { success: true, subscription };
  } catch (error) {
    console.error("Error resuming subscription:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to resume subscription",
    };
  }
}

/**
 * Update subscription (change plan)
 */
export async function updateSubscription(
  subscriptionId: string,
  newPriceId: string
): Promise<{
  success: boolean;
  subscription?: Stripe.Subscription;
  error?: string;
}> {
  try {
    await requirePermission("billing.write");

    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return { success: false, error: "No tenant context found" };
    }

    const adminClient = createAdminClient();

    // Verify subscription belongs to tenant
    const result: { data: { stripe_subscription_id: string } | null; error: any } = await adminClient
      .from("stripe_subscriptions")
      .select("stripe_subscription_id")
      .eq("tenant_id", tenantId)
      .eq("id", subscriptionId)
      .single();

    const dbSubscription = result.data;
    if (!dbSubscription) {
      return { success: false, error: "Subscription not found" };
    }

    // Get current subscription from Stripe
    const currentSubscription = await stripe.subscriptions.retrieve(dbSubscription.stripe_subscription_id);

    // Update subscription in Stripe
    const subscription = await stripe.subscriptions.update(dbSubscription.stripe_subscription_id, {
      items: [
        {
          id: currentSubscription.items.data[0].id,
          price: newPriceId,
        },
      ],
      proration_behavior: "always_invoice",
    });

    // Update in database
    await adminClient
      .from("stripe_subscriptions")
      // @ts-expect-error - Supabase type inference issue with update operations
      .update({
        stripe_price_id: newPriceId,
        status: subscription.status,
      } as any)
      .eq("id", subscriptionId);

    return { success: true, subscription };
  } catch (error) {
    console.error("Error updating subscription:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update subscription",
    };
  }
}

/**
 * Get subscription details from Stripe
 */
export async function getSubscriptionDetails(subscriptionId: string): Promise<{
  success: boolean;
  subscription?: Stripe.Subscription;
  error?: string;
}> {
  try {
    await requirePermission("billing.read");

    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return { success: false, error: "No tenant context found" };
    }

    const adminClient = createAdminClient();

    // Verify subscription belongs to tenant
    const result: { data: { stripe_subscription_id: string } | null; error: any } = await adminClient
      .from("stripe_subscriptions")
      .select("stripe_subscription_id")
      .eq("tenant_id", tenantId)
      .eq("id", subscriptionId)
      .single();

    const dbSubscription = result.data;
    if (!dbSubscription) {
      return { success: false, error: "Subscription not found" };
    }

    // Get from Stripe
    const subscription = await stripe.subscriptions.retrieve(dbSubscription.stripe_subscription_id, {
      expand: ["latest_invoice", "customer", "default_payment_method"],
    });

    return { success: true, subscription };
  } catch (error) {
    console.error("Error fetching subscription details:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch subscription details",
    };
  }
}

/**
 * Get upcoming invoice for a subscription
 */
export async function getUpcomingInvoice(): Promise<{
  success: boolean;
  invoice?: Stripe.Invoice;
  error?: string;
}> {
  try {
    await requirePermission("billing.read");

    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return { success: false, error: "No tenant context found" };
    }

    const adminClient = createAdminClient();

    // Get customer
    const customerResult: { data: { stripe_customer_id: string } | null; error: any } = await adminClient
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("tenant_id", tenantId)
      .single();

    const customer = customerResult.data;
    if (!customer) {
      return { success: false, error: "Customer not found" };
    }

    // Get upcoming invoice
    const invoice = await stripe.invoices.list({
      customer: customer.stripe_customer_id,
      limit: 1,
      status: 'draft',
    }).then(result => result.data[0]);

    return { success: true, invoice };
  } catch (error) {
    console.error("Error fetching upcoming invoice:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch upcoming invoice",
    };
  }
}

/**
 * Get all invoices for the current tenant
 */
export async function getInvoices(limit: number = 10): Promise<{
  success: boolean;
  invoices?: any[];
  error?: string;
}> {
  try {
    await requirePermission("billing.read");

    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return { success: false, error: "No tenant context found" };
    }

    const adminClient = createAdminClient();

    const { data: invoices, error } = await adminClient
      .from("stripe_invoices")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, invoices: invoices || [] };
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch invoices",
    };
  }
}
