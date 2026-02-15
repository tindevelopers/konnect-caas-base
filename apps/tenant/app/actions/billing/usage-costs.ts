"use server";

import { createAdminClient } from "@/core/database/admin-client";
import { stripe } from "@/core/billing/config";
import { getEffectiveMarkupPercent } from "./pricing";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CostType = "ai_minutes" | "number_upfront" | "number_monthly";

export interface RecordCostParams {
  tenantId: string;
  costType: CostType;
  /** Our cost from the provider (e.g. Telnyx) */
  costAmount: number;
  /** Number of units (minutes, count, etc.) */
  units: number;
  currency?: string;
  /** External reference (conversation_id, order_id) */
  sourceId?: string;
  /** Source system (telnyx_conversation, telnyx_number_order) */
  sourceType?: string;
  metadata?: Record<string, unknown>;
}

export interface TenantUsageCost {
  id: string;
  tenant_id: string;
  cost_type: CostType;
  cost_amount: number;
  billed_amount: number;
  markup_percent: number;
  units: number;
  currency: string;
  source_id: string | null;
  source_type: string | null;
  stripe_usage_record_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Record cost + apply markup + send to Stripe
// ---------------------------------------------------------------------------

/**
 * Record a billable cost event for a tenant.
 * 1. Resolves effective markup (tenant override or platform default)
 * 2. Computes billed_amount = costAmount * (1 + markup/100)
 * 3. Inserts into tenant_usage_costs
 * 4. Attempts to send to Stripe metered billing (best-effort)
 */
export async function recordCostAndBillAction(
  params: RecordCostParams
): Promise<{ success: boolean; usageCost?: TenantUsageCost; error?: string }> {
  try {
    if (!params.tenantId?.trim()) {
      return { success: false, error: "tenantId is required" };
    }
    if (params.costAmount < 0) {
      return { success: false, error: "costAmount must be >= 0" };
    }

    const tenantId = params.tenantId.trim();
    const markupPercent = await getEffectiveMarkupPercent(tenantId);
    const billedAmount = params.costAmount * (1 + markupPercent / 100);
    const currency = params.currency ?? "USD";

    const adminClient = createAdminClient();

    // Insert cost record
    const { data, error } = await (adminClient.from("tenant_usage_costs") as any)
      .insert({
        tenant_id: tenantId,
        cost_type: params.costType,
        cost_amount: params.costAmount,
        billed_amount: billedAmount,
        markup_percent: markupPercent,
        units: params.units,
        currency,
        source_id: params.sourceId ?? null,
        source_type: params.sourceType ?? null,
        metadata: params.metadata ?? {},
      })
      .select("*")
      .single();

    if (error) {
      console.error("[recordCostAndBill] DB insert error:", error);
      return { success: false, error: `Failed to record cost: ${error.message}` };
    }

    const usageCost: TenantUsageCost = {
      id: data.id,
      tenant_id: data.tenant_id,
      cost_type: data.cost_type,
      cost_amount: Number(data.cost_amount),
      billed_amount: Number(data.billed_amount),
      markup_percent: Number(data.markup_percent),
      units: Number(data.units),
      currency: data.currency,
      source_id: data.source_id,
      source_type: data.source_type,
      stripe_usage_record_id: data.stripe_usage_record_id,
      metadata: data.metadata ?? {},
      created_at: data.created_at,
    };

    // Best-effort: send to Stripe metered billing
    try {
      const stripeRecordId = await sendToStripeMeteredBilling({
        tenantId,
        costType: params.costType,
        billedAmount,
        units: params.units,
        currency,
      });

      if (stripeRecordId) {
        await (adminClient.from("tenant_usage_costs") as any)
          .update({ stripe_usage_record_id: stripeRecordId })
          .eq("id", usageCost.id);
        usageCost.stripe_usage_record_id = stripeRecordId;
      }
    } catch (stripeError) {
      console.error("[recordCostAndBill] Stripe billing error (non-fatal):", stripeError);
      // Don't fail the overall operation; cost is recorded in our DB
    }

    return { success: true, usageCost };
  } catch (error) {
    console.error("[recordCostAndBill] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to record cost",
    };
  }
}

// ---------------------------------------------------------------------------
// Stripe metered billing helper
// ---------------------------------------------------------------------------

/**
 * Stripe product metadata key used to map cost types to metered subscription items.
 * When setting up Stripe products, set metadata.cost_type = "ai_minutes" | "number_upfront" | "number_monthly"
 */
const STRIPE_COST_TYPE_META_KEY = "cost_type";

async function sendToStripeMeteredBilling(args: {
  tenantId: string;
  costType: CostType;
  billedAmount: number;
  units: number;
  currency: string;
}): Promise<string | null> {
  if (!stripe) {
    console.warn("[Stripe] Stripe not configured, skipping metered billing.");
    return null;
  }

  const adminClient = createAdminClient();

  // Get tenant's active subscription
  const { data: sub } = await (adminClient.from("stripe_subscriptions") as any)
    .select("stripe_subscription_id")
    .eq("tenant_id", args.tenantId)
    .in("status", ["active", "trialing"])
    .limit(1)
    .single();

  if (!sub?.stripe_subscription_id) {
    console.warn(`[Stripe] No active subscription for tenant ${args.tenantId}, skipping.`);
    return null;
  }

  // Retrieve subscription from Stripe
  const stripeSubscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);

  // Find the metered subscription item matching our cost type
  const meteredItem = stripeSubscription.items.data.find((item) => {
    // Check price metadata for cost_type
    if (item.price.metadata?.[STRIPE_COST_TYPE_META_KEY] === args.costType) return true;
    // Check product metadata if price doesn't have it
    const productId =
      typeof item.price.product === "string" ? item.price.product : (item.price.product as any)?.id;
    if (productId && (item.price as any).product_data?.metadata?.[STRIPE_COST_TYPE_META_KEY] === args.costType) return true;
    // Fallback: match by usage_type being metered (first metered item)
    return false;
  });

  if (!meteredItem) {
    // If no specific match, try the first metered item as fallback
    const fallbackItem = stripeSubscription.items.data.find(
      (item) => item.price.recurring?.usage_type === "metered"
    );

    if (!fallbackItem) {
      console.warn(`[Stripe] No metered item for cost_type=${args.costType}, tenant=${args.tenantId}`);
      return null;
    }

    // Report in cents (smallest currency unit)
    const quantityCents = Math.round(args.billedAmount * 100);
    if (quantityCents <= 0) return null;

    const record = await (stripe.subscriptionItems as any).createUsageRecord(fallbackItem.id, {
      quantity: quantityCents,
      timestamp: Math.floor(Date.now() / 1000),
      action: "increment",
    });

    return record?.id ?? null;
  }

  // Report in cents
  const quantityCents = Math.round(args.billedAmount * 100);
  if (quantityCents <= 0) return null;

  const record = await (stripe.subscriptionItems as any).createUsageRecord(meteredItem.id, {
    quantity: quantityCents,
    timestamp: Math.floor(Date.now() / 1000),
    action: "increment",
  });

  return record?.id ?? null;
}

// ---------------------------------------------------------------------------
// Query usage costs (for dashboard)
// ---------------------------------------------------------------------------

export interface UsageCostSummary {
  tenant_id: string;
  tenant_name?: string;
  total_cost: number;
  total_billed: number;
  ai_minutes_cost: number;
  ai_minutes_billed: number;
  number_upfront_cost: number;
  number_upfront_billed: number;
  number_monthly_cost: number;
  number_monthly_billed: number;
  event_count: number;
}

export async function listTenantUsageCostsAction(args?: {
  tenantId?: string;
  costType?: CostType;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: TenantUsageCost[]; total: number }> {
  const adminClient = createAdminClient();

  let query = (adminClient.from("tenant_usage_costs") as any)
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (args?.tenantId) query = query.eq("tenant_id", args.tenantId);
  if (args?.costType) query = query.eq("cost_type", args.costType);
  if (args?.startDate) query = query.gte("created_at", args.startDate);
  if (args?.endDate) query = query.lte("created_at", args.endDate);
  if (args?.limit) query = query.limit(args.limit);
  if (args?.offset) query = query.range(args.offset, args.offset + (args.limit ?? 50) - 1);

  const { data, error, count } = await query;

  if (error) throw new Error(`Failed to list usage costs: ${error.message}`);

  return {
    data: (data ?? []).map((row: any) => ({
      id: row.id,
      tenant_id: row.tenant_id,
      cost_type: row.cost_type,
      cost_amount: Number(row.cost_amount),
      billed_amount: Number(row.billed_amount),
      markup_percent: Number(row.markup_percent),
      units: Number(row.units),
      currency: row.currency,
      source_id: row.source_id,
      source_type: row.source_type,
      stripe_usage_record_id: row.stripe_usage_record_id,
      metadata: row.metadata ?? {},
      created_at: row.created_at,
    })),
    total: count ?? 0,
  };
}

/**
 * Get aggregated cost summary per tenant for a period.
 */
export async function getTenantCostSummariesAction(args?: {
  startDate?: string;
  endDate?: string;
}): Promise<UsageCostSummary[]> {
  const adminClient = createAdminClient();

  let query = (adminClient.from("tenant_usage_costs") as any).select("*");

  if (args?.startDate) query = query.gte("created_at", args.startDate);
  if (args?.endDate) query = query.lte("created_at", args.endDate);

  const { data, error } = await query;

  if (error) throw new Error(`Failed to get cost summaries: ${error.message}`);

  // Aggregate in JS (Supabase doesn't support GROUP BY easily via PostgREST)
  const byTenant = new Map<string, UsageCostSummary>();

  for (const row of data ?? []) {
    const tid = row.tenant_id as string;
    if (!byTenant.has(tid)) {
      byTenant.set(tid, {
        tenant_id: tid,
        total_cost: 0,
        total_billed: 0,
        ai_minutes_cost: 0,
        ai_minutes_billed: 0,
        number_upfront_cost: 0,
        number_upfront_billed: 0,
        number_monthly_cost: 0,
        number_monthly_billed: 0,
        event_count: 0,
      });
    }
    const summary = byTenant.get(tid)!;
    const cost = Number(row.cost_amount);
    const billed = Number(row.billed_amount);
    summary.total_cost += cost;
    summary.total_billed += billed;
    summary.event_count++;

    switch (row.cost_type) {
      case "ai_minutes":
        summary.ai_minutes_cost += cost;
        summary.ai_minutes_billed += billed;
        break;
      case "number_upfront":
        summary.number_upfront_cost += cost;
        summary.number_upfront_billed += billed;
        break;
      case "number_monthly":
        summary.number_monthly_cost += cost;
        summary.number_monthly_billed += billed;
        break;
    }
  }

  // Enrich with tenant names
  const tenantIds = Array.from(byTenant.keys());
  if (tenantIds.length > 0) {
    const { data: tenants } = await (adminClient.from("tenants") as any)
      .select("id, name")
      .in("id", tenantIds);

    const nameMap = new Map<string, string>();
    for (const t of tenants ?? []) {
      nameMap.set(t.id, t.name);
    }
    for (const [tid, summary] of byTenant) {
      summary.tenant_name = nameMap.get(tid) ?? undefined;
    }
  }

  return Array.from(byTenant.values()).sort((a, b) => b.total_billed - a.total_billed);
}
