"use server";

import { stripe } from "@/core/billing/config";
import { createAdminClient } from "@/core/database/admin-client";

/**
 * Sync Stripe products to database
 */
export async function syncProducts(): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> {
  try {
    const adminClient = createAdminClient();

    // Fetch all active products from Stripe
    const products = await stripe.products.list({
      active: true,
      limit: 100,
    });

    let syncedCount = 0;

    for (const product of products.data) {
      // Upsert product
      const { error } = await adminClient
        .from("stripe_products")
        .upsert(
          {
            stripe_product_id: product.id,
            name: product.name,
            description: product.description || null,
            active: product.active,
            metadata: product.metadata as any,
          } as any,
          {
            onConflict: "stripe_product_id",
          }
        );

      if (error) {
        console.error(`Error syncing product ${product.id}:`, error);
        continue;
      }

      // Fetch and sync prices for this product
      const prices = await stripe.prices.list({
        product: product.id,
        active: true,
        limit: 100,
      });

      for (const price of prices.data) {
        await adminClient
          .from("stripe_prices")
          .upsert(
            {
              stripe_price_id: price.id,
              stripe_product_id: product.id,
              active: price.active,
              unit_amount: price.unit_amount ? price.unit_amount / 100 : null, // Convert from cents
              currency: price.currency,
              billing_cycle: price.recurring?.interval === 'year' ? 'annual' : 'monthly',
              interval_count: price.recurring?.interval_count || 1,
              metadata: price.metadata as Record<string, unknown>,
            } as any,
            { onConflict: 'stripe_price_id' }
          );
      }

      syncedCount++;
    }

    return { success: true, count: syncedCount };
  } catch (error) {
    console.error("Error syncing products:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to sync products",
    };
  }
}

/**
 * Get all products with prices
 */
export async function getProducts(): Promise<{
  success: boolean;
  products?: any[];
  error?: string;
}> {
  try {
    const adminClient = createAdminClient();

    const { data: products, error } = await adminClient
      .from("stripe_products")
      .select(`
        *,
        prices:stripe_prices(*)
      `)
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, products: products || [] };
  } catch (error) {
    console.error("Error fetching products:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch products",
    };
  }
}

/**
 * Get a single product with prices
 */
export async function getProduct(productId: string): Promise<{
  success: boolean;
  product?: any;
  error?: string;
}> {
  try {
    const adminClient = createAdminClient();

    const { data: product, error } = await adminClient
      .from("stripe_products")
      .select(`
        *,
        prices:stripe_prices(*)
      `)
      .eq("stripe_product_id", productId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, product };
  } catch (error) {
    console.error("Error fetching product:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch product",
    };
  }
}

/**
 * Get all prices for a product
 */
export async function getPrices(productId?: string): Promise<{
  success: boolean;
  prices?: any[];
  error?: string;
}> {
  try {
    const adminClient = createAdminClient();

    let query = adminClient
      .from("stripe_prices")
      .select("*")
      .eq("active", true);

    if (productId) {
      query = query.eq("stripe_product_id", productId);
    }

    const { data: prices, error } = await query.order("unit_amount", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, prices: prices || [] };
  } catch (error) {
    console.error("Error fetching prices:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch prices",
    };
  }
}
