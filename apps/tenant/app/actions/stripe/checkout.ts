"use server";

import { stripe, formatAmountForStripe } from "@/core/billing/config";
import { createAdminClient } from "@/core/database/admin-client";
import { createClient } from "@/core/database/server";
import { getCurrentTenant } from "@/core/multi-tenancy/server";

/**
 * Create a Stripe Checkout session for subscription
 */
export async function createCheckoutSession(params: {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
  promotionCode?: string;
}): Promise<{ success: boolean; sessionId?: string; url?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "User not authenticated" };
    }

    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return { success: false, error: "No tenant context found" };
    }

    const adminClient = createAdminClient();

    // Get or create customer
    let customerId: string | undefined;
    const customerResult: { data: { stripe_customer_id: string } | null; error: any } = await adminClient
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("tenant_id", tenantId)
      .single();

    const existingCustomer = customerResult.data;
    if (existingCustomer) {
      customerId = existingCustomer.stripe_customer_id;
    } else {
      // Create customer
      const tenantResult: { data: { name: string } | null; error: any } = await adminClient
        .from("tenants")
        .select("name")
        .eq("id", tenantId)
        .single();
      
      const tenant = tenantResult.data;

      const customer = await stripe.customers.create({
        email: user.email,
        name: tenant?.name || user.email,
        metadata: {
          tenant_id: tenantId,
          user_id: user.id,
        },
      });

      // Save to database
      // @ts-expect-error - Supabase type inference issue with Database types
      await adminClient.from("stripe_customers").insert({
        tenant_id: tenantId,
        stripe_customer_id: customer.id,
        email: user.email || "",
        name: tenant?.name || user.email || "",
        metadata: { tenant_id: tenantId, user_id: user.id },
      });

      customerId = customer.id;
    }

    // Build checkout session params
    const sessionParams: any = {
      customer: customerId,
      mode: "subscription",
      line_items: [
        {
          price: params.priceId,
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      allow_promotion_codes: params.promotionCode ? false : true,
      billing_address_collection: "auto",
      metadata: {
        tenant_id: tenantId,
        user_id: user.id,
      },
      subscription_data: {
        metadata: {
          tenant_id: tenantId,
          user_id: user.id,
        },
      },
    };

    // Add trial if specified
    if (params.trialDays && params.trialDays > 0) {
      sessionParams.subscription_data.trial_period_days = params.trialDays;
    }

    // Add promotion code if specified
    if (params.promotionCode) {
      sessionParams.discounts = [{ promotion_code: params.promotionCode }];
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create(sessionParams);

    return { success: true, sessionId: session.id, url: session.url || undefined };
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create checkout session",
    };
  }
}

/**
 * Create a Stripe Billing Portal session
 */
export async function createBillingPortalSession(
  returnUrl: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "User not authenticated" };
    }

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
      return { success: false, error: "Customer not found. Please subscribe first." };
    }

    // Create billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      return_url: returnUrl,
    });

    return { success: true, url: session.url };
  } catch (error) {
    console.error("Error creating billing portal session:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create billing portal session",
    };
  }
}

/**
 * Create a one-time payment session
 */
export async function createPaymentSession(params: {
  amount: number;
  currency?: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}): Promise<{ success: boolean; sessionId?: string; url?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "User not authenticated" };
    }

    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return { success: false, error: "No tenant context found" };
    }

    const adminClient = createAdminClient();

    // Get or create customer
    let customerId: string | undefined;
    const customerResult: { data: { stripe_customer_id: string } | null; error: any } = await adminClient
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("tenant_id", tenantId)
      .single();

    const existingCustomer = customerResult.data;
    if (existingCustomer) {
      customerId = existingCustomer.stripe_customer_id;
    }

    // Create checkout session for one-time payment
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: params.currency || "usd",
            product_data: {
              name: params.description,
            },
            unit_amount: formatAmountForStripe(params.amount, params.currency || "usd"),
          },
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        tenant_id: tenantId,
        user_id: user.id,
        ...params.metadata,
      },
    });

    return { success: true, sessionId: session.id, url: session.url || undefined };
  } catch (error) {
    console.error("Error creating payment session:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create payment session",
    };
  }
}

/**
 * Get checkout session details
 */
export async function getCheckoutSession(sessionId: string): Promise<{
  success: boolean;
  session?: any;
  error?: string;
}> {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["customer", "subscription", "payment_intent"],
    });

    return { success: true, session };
  } catch (error) {
    console.error("Error retrieving checkout session:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to retrieve checkout session",
    };
  }
}


