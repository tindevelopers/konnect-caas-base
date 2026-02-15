"use server";

import { createAdminClient } from "@/core/database/admin-client";
import { isPlatformAdmin } from "@/app/actions/organization-admins";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlatformPricingSettings {
  id: string;
  markup_percent: number;
  currency: string;
  updated_at: string;
}

export interface TenantPricingSettings {
  id: string;
  tenant_id: string;
  markup_percent: number | null;
  notes: string | null;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Platform pricing (singleton)
// ---------------------------------------------------------------------------

export async function getPlatformPricingSettingsAction(): Promise<PlatformPricingSettings> {
  const isAdmin = await isPlatformAdmin();
  if (!isAdmin) {
    throw new Error("Only Platform Admins can view platform pricing settings.");
  }

  const adminClient = createAdminClient();
  const { data, error } = await (adminClient.from("platform_pricing_settings") as any)
    .select("*")
    .limit(1)
    .single();

  if (error) {
    // If no row exists yet, return defaults
    if (error.code === "PGRST116") {
      return {
        id: "",
        markup_percent: 25,
        currency: "USD",
        updated_at: new Date().toISOString(),
      };
    }
    throw new Error(`Failed to fetch platform pricing: ${error.message}`);
  }

  return {
    id: data.id,
    markup_percent: Number(data.markup_percent),
    currency: data.currency,
    updated_at: data.updated_at,
  };
}

export async function updatePlatformPricingSettingsAction(args: {
  markupPercent: number;
  currency?: string;
}): Promise<PlatformPricingSettings> {
  const isAdmin = await isPlatformAdmin();
  if (!isAdmin) {
    throw new Error("Only Platform Admins can update platform pricing settings.");
  }

  if (args.markupPercent < 0 || args.markupPercent > 999) {
    throw new Error("Markup percent must be between 0 and 999.");
  }

  const adminClient = createAdminClient();

  // Try to update existing row first
  const { data: existing } = await (adminClient.from("platform_pricing_settings") as any)
    .select("id")
    .limit(1)
    .single();

  if (existing?.id) {
    const { data, error } = await (adminClient.from("platform_pricing_settings") as any)
      .update({
        markup_percent: args.markupPercent,
        ...(args.currency ? { currency: args.currency } : {}),
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throw new Error(`Failed to update platform pricing: ${error.message}`);

    return {
      id: data.id,
      markup_percent: Number(data.markup_percent),
      currency: data.currency,
      updated_at: data.updated_at,
    };
  }

  // Insert if no row exists
  const { data, error } = await (adminClient.from("platform_pricing_settings") as any)
    .insert({
      markup_percent: args.markupPercent,
      currency: args.currency ?? "USD",
    })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to create platform pricing: ${error.message}`);

  return {
    id: data.id,
    markup_percent: Number(data.markup_percent),
    currency: data.currency,
    updated_at: data.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Tenant pricing
// ---------------------------------------------------------------------------

export async function getTenantPricingSettingsAction(
  tenantId: string
): Promise<TenantPricingSettings | null> {
  const isAdmin = await isPlatformAdmin();
  if (!isAdmin) {
    throw new Error("Only Platform Admins can view tenant pricing settings.");
  }

  if (!tenantId?.trim()) throw new Error("tenantId is required.");

  const adminClient = createAdminClient();
  const { data, error } = await (adminClient.from("tenant_pricing_settings") as any)
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch tenant pricing: ${error.message}`);
  if (!data) return null;

  return {
    id: data.id,
    tenant_id: data.tenant_id,
    markup_percent: data.markup_percent != null ? Number(data.markup_percent) : null,
    notes: data.notes,
    updated_at: data.updated_at,
  };
}

export async function upsertTenantPricingSettingsAction(args: {
  tenantId: string;
  markupPercent: number | null;
  notes?: string | null;
}): Promise<TenantPricingSettings> {
  const isAdmin = await isPlatformAdmin();
  if (!isAdmin) {
    throw new Error("Only Platform Admins can update tenant pricing settings.");
  }

  if (!args.tenantId?.trim()) throw new Error("tenantId is required.");
  if (args.markupPercent != null && (args.markupPercent < 0 || args.markupPercent > 999)) {
    throw new Error("Markup percent must be between 0 and 999.");
  }

  const adminClient = createAdminClient();
  const { data, error } = await (adminClient.from("tenant_pricing_settings") as any)
    .upsert(
      {
        tenant_id: args.tenantId.trim(),
        markup_percent: args.markupPercent,
        notes: args.notes ?? null,
      },
      { onConflict: "tenant_id" }
    )
    .select("*")
    .single();

  if (error) throw new Error(`Failed to upsert tenant pricing: ${error.message}`);

  return {
    id: data.id,
    tenant_id: data.tenant_id,
    markup_percent: data.markup_percent != null ? Number(data.markup_percent) : null,
    notes: data.notes,
    updated_at: data.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Effective markup resolution (used by billing/cost recording)
// ---------------------------------------------------------------------------

/**
 * Get the effective markup percent for a tenant.
 * Returns the tenant override if set, otherwise the platform default.
 * This function uses the admin client and does NOT require auth context.
 */
export async function getEffectiveMarkupPercent(tenantId: string): Promise<number> {
  const adminClient = createAdminClient();

  // Check tenant override first
  const { data: tenantPricing } = await (adminClient.from("tenant_pricing_settings") as any)
    .select("markup_percent")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (tenantPricing?.markup_percent != null) {
    return Number(tenantPricing.markup_percent);
  }

  // Fall back to platform default
  const { data: platformPricing } = await (adminClient.from("platform_pricing_settings") as any)
    .select("markup_percent")
    .limit(1)
    .single();

  return platformPricing?.markup_percent != null ? Number(platformPricing.markup_percent) : 25;
}

// ---------------------------------------------------------------------------
// List all tenant pricing (for admin dashboard)
// ---------------------------------------------------------------------------

export async function listAllTenantPricingAction(): Promise<
  Array<TenantPricingSettings & { tenant_name?: string }>
> {
  const isAdmin = await isPlatformAdmin();
  if (!isAdmin) {
    throw new Error("Only Platform Admins can list tenant pricing settings.");
  }

  const adminClient = createAdminClient();
  const { data, error } = await (adminClient.from("tenant_pricing_settings") as any)
    .select("*, tenants(name)")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Failed to list tenant pricing: ${error.message}`);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    tenant_id: row.tenant_id,
    markup_percent: row.markup_percent != null ? Number(row.markup_percent) : null,
    notes: row.notes,
    updated_at: row.updated_at,
    tenant_name: row.tenants?.name ?? undefined,
  }));
}
