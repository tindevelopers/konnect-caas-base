"use server";

import { stripe } from "@/core/billing/config";
import { createAdminClient } from "@/core/database/admin-client";
import { getCurrentTenant } from "@/core/multi-tenancy/server";
import { requirePermission } from "@/core/permissions/middleware";

/**
 * Record usage for a metered subscription
 */
export async function recordUsage(params: {
  subscriptionItemId: string;
  quantity: number;
  timestamp?: number;
  action?: "increment" | "set";
}): Promise<{ success: boolean; usageRecord?: Record<string, unknown>; error?: string }> {
  try {
    await requirePermission("billing.write");

    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return { success: false, error: "No tenant context found" };
    }

    // Create usage record in Stripe
    const usageRecord = await (stripe.subscriptionItems as any).createUsageRecord(
      params.subscriptionItemId,
      {
        quantity: params.quantity,
        timestamp: params.timestamp || Math.floor(Date.now() / 1000),
        action: params.action || "increment",
      }
    );

    return { success: true, usageRecord };
  } catch (error) {
    console.error("Error recording usage:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to record usage",
    };
  }
}

/**
 * Get usage records for a subscription item
 */
export async function getUsageRecords(
  subscriptionItemId: string,
  limit: number = 100
): Promise<{
  success: boolean;
  usageRecords?: Record<string, unknown>[];
  error?: string;
}> {
  try {
    await requirePermission("billing.read");

    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return { success: false, error: "No tenant context found" };
    }

    // Fetch usage records from Stripe
    const usageRecords = await (stripe.subscriptionItems as any).listUsageRecordSummaries(
      subscriptionItemId,
      { limit }
    );

    return { success: true, usageRecords: usageRecords.data as Record<string, unknown>[] };
  } catch (error) {
    console.error("Error fetching usage records:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch usage records",
    };
  }
}

/**
 * Track a custom usage event (e.g., API calls, storage, etc.)
 * This is a helper function that can be called from your application
 * to track usage and automatically record it in Stripe
 */
export async function trackUsageEvent(params: {
  eventType: string;
  quantity: number;
  metadata?: Record<string, string>;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return { success: false, error: "No tenant context found" };
    }

    const adminClient = createAdminClient();

    // Get active subscription with metered billing
    const result: { data: { stripe_subscription_id: string } | null; error: any } = await adminClient
      .from("stripe_subscriptions")
      .select("stripe_subscription_id")
      .eq("tenant_id", tenantId)
      .in("status", ["active", "trialing"])
      .single();

    const subscription = result.data;
    if (!subscription) {
      return { success: false, error: "No active subscription found" };
    }

    // Get subscription from Stripe to find metered items
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripe_subscription_id
    );

    // Find metered subscription items
    const meteredItems = stripeSubscription.items.data.filter(
      (item) => item.price.recurring?.usage_type === "metered"
    );

    if (meteredItems.length === 0) {
      return { success: false, error: "No metered subscription items found" };
    }

    // Record usage for the first metered item (you can customize this logic)
    await (stripe.subscriptionItems as any).createUsageRecord(meteredItems[0].id, {
      quantity: params.quantity,
      timestamp: Math.floor(Date.now() / 1000),
      action: "increment",
    });

    // Optionally, log usage in your own database for analytics
    // await adminClient.from("usage_logs").insert({
    //   tenant_id: tenantId,
    //   event_type: params.eventType,
    //   quantity: params.quantity,
    //   metadata: params.metadata,
    //   stripe_usage_record_id: usageRecord.id,
    // });

    return { success: true };
  } catch (error) {
    console.error("Error tracking usage event:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to track usage event",
    };
  }
}

/**
 * Get current usage for the billing period
 */
export async function getCurrentUsage(): Promise<{
  success: boolean;
  usage?: Array<{
    subscriptionItemId: string;
    totalUsage: number;
    period: { start: number; end: number };
  }>;
  error?: string;
}> {
  try {
    await requirePermission("billing.read");

    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return { success: false, error: "No tenant context found" };
    }

    const adminClient = createAdminClient();

    // Get active subscription
    const result: { data: { stripe_subscription_id: string; current_period_start: string; current_period_end: string } | null; error: any } = await adminClient
      .from("stripe_subscriptions")
      .select("stripe_subscription_id, current_period_start, current_period_end")
      .eq("tenant_id", tenantId)
      .in("status", ["active", "trialing"])
      .single();

    const subscription = result.data;
    if (!subscription) {
      return { success: false, error: "No active subscription found" };
    }

    // Get subscription from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripe_subscription_id
    );

    // Get usage for each metered item
    const usage = await Promise.all(
      stripeSubscription.items.data
        .filter((item) => item.price.recurring?.usage_type === "metered")
        .map(async (item) => {
          const summaries = await (stripe.subscriptionItems as any).listUsageRecordSummaries(
            item.id,
            { limit: 1 }
          );

          return {
            subscriptionItemId: item.id,
            totalUsage: summaries.data[0]?.total_usage || 0,
            period: {
              start: (stripeSubscription as any).current_period_start,
              end: (stripeSubscription as any).current_period_end,
            },
          };
        })
    );

    return { success: true, usage };
  } catch (error) {
    console.error("Error fetching current usage:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch current usage",
    };
  }
}


