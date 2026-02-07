"use server";

import { stripe } from "@/core/billing/config";
import { createAdminClient } from "@/core/database/admin-client";
import { getCurrentTenant } from "@/core/multi-tenancy/server";
import { requirePermission } from "@/core/permissions/middleware";

/**
 * Get all payment methods for the current tenant
 */
export async function getPaymentMethods(): Promise<{
  success: boolean;
  paymentMethods?: Record<string, unknown>[];
  error?: string;
}> {
  try {
    await requirePermission("billing.read");

    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return { success: false, error: "No tenant context found" };
    }

    const adminClient = createAdminClient();

    const paymentMethodsResult: { data: any[] | null; error: any } = await adminClient
      .from("stripe_payment_methods")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    const paymentMethods = paymentMethodsResult.data;
    const error = paymentMethodsResult.error;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, paymentMethods: paymentMethods || [] };
  } catch (error) {
    console.error("Error fetching payment methods:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch payment methods",
    };
  }
}

/**
 * Set default payment method
 */
export async function setDefaultPaymentMethod(paymentMethodId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await requirePermission("billing.write");

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

    // Get payment method from database
    const paymentMethodResult: { data: { stripe_payment_method_id: string } | null; error: any } = await adminClient
      .from("stripe_payment_methods")
      .select("stripe_payment_method_id")
      .eq("id", paymentMethodId)
      .eq("tenant_id", tenantId)
      .single();

    const paymentMethod = paymentMethodResult.data;
    if (!paymentMethod) {
      return { success: false, error: "Payment method not found" };
    }

    // Update default payment method in Stripe
    await stripe.customers.update(customer.stripe_customer_id, {
      invoice_settings: {
        default_payment_method: paymentMethod.stripe_payment_method_id,
      },
    });

    // Update in database - set all to false first
    await adminClient
      .from("stripe_payment_methods")
      // @ts-expect-error - Supabase type inference issue with Database types
      .update({ is_default: false })
      .eq("tenant_id", tenantId);

    // Then set the selected one to true
    await adminClient
      .from("stripe_payment_methods")
      // @ts-expect-error - Supabase type inference issue with Database types
      .update({ is_default: true })
      .eq("id", paymentMethodId);

    return { success: true };
  } catch (error) {
    console.error("Error setting default payment method:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to set default payment method",
    };
  }
}

/**
 * Delete a payment method
 */
export async function deletePaymentMethod(paymentMethodId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await requirePermission("billing.write");

    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return { success: false, error: "No tenant context found" };
    }

    const adminClient = createAdminClient();

    // Get payment method from database
    const paymentMethodResult: { data: { stripe_payment_method_id: string } | null; error: any } = await adminClient
      .from("stripe_payment_methods")
      .select("stripe_payment_method_id")
      .eq("id", paymentMethodId)
      .eq("tenant_id", tenantId)
      .single();

    const paymentMethod = paymentMethodResult.data;
    if (!paymentMethod) {
      return { success: false, error: "Payment method not found" };
    }

    // Detach payment method in Stripe
    await stripe.paymentMethods.detach(paymentMethod.stripe_payment_method_id);

    // Delete from database
    await adminClient
      .from("stripe_payment_methods")
      .delete()
      .eq("id", paymentMethodId);

    return { success: true };
  } catch (error) {
    console.error("Error deleting payment method:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete payment method",
    };
  }
}

/**
 * Create a setup intent for adding a new payment method
 */
export async function createSetupIntent(): Promise<{
  success: boolean;
  clientSecret?: string;
  error?: string;
}> {
  try {
    await requirePermission("billing.write");

    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return { success: false, error: "No tenant context found" };
    }

    const adminClient = createAdminClient();

    // Get customer
    const customerResult1: { data: { stripe_customer_id: string } | null; error: any } = await adminClient
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("tenant_id", tenantId)
      .single();

    const customer = customerResult1.data;
    if (!customer) {
      return { success: false, error: "Customer not found" };
    }

    // Create setup intent
    const setupIntent = await stripe.setupIntents.create({
      customer: customer.stripe_customer_id,
      payment_method_types: ["card"],
      metadata: {
        tenant_id: tenantId,
      },
    });

    return { success: true, clientSecret: setupIntent.client_secret || undefined };
  } catch (error) {
    console.error("Error creating setup intent:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create setup intent",
    };
  }
}

/**
 * Attach a payment method to the customer
 */
export async function attachPaymentMethod(
  paymentMethodId: string,
  makeDefault: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePermission("billing.write");

    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return { success: false, error: "No tenant context found" };
    }

    const adminClient = createAdminClient();

    // Get customer
    const customerResult2: { data: { stripe_customer_id: string } | null; error: any } = await adminClient
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("tenant_id", tenantId)
      .single();

    const customer = customerResult2.data;
    if (!customer) {
      return { success: false, error: "Customer not found" };
    }

    // Attach the payment method to the customer
    await stripe.paymentMethods.attach(
      paymentMethodId,
      {
        customer: customer.stripe_customer_id,
      }
    );

    // Get the payment method details
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    // Save to database
    const insertResult: { error: any } = await adminClient
      .from("stripe_payment_methods")
      // @ts-expect-error - Supabase type inference issue with Database types
      .insert({
        tenant_id: tenantId,
        stripe_customer_id: customer.stripe_customer_id,
        stripe_payment_method_id: paymentMethod.id,
        type: paymentMethod.type as "card" | "bank_account" | "us_bank_account" | "sepa_debit",
        card_brand: paymentMethod.card?.brand,
        card_last4: paymentMethod.card?.last4,
        card_exp_month: paymentMethod.card?.exp_month,
        card_exp_year: paymentMethod.card?.exp_year,
        is_default: makeDefault,
        billing_details: paymentMethod.billing_details as unknown as Record<string, unknown>,
      });

    const insertError = insertResult.error;
    if (insertError) {
      console.error("Error saving payment method to database:", insertError);
      // Don't fail the request if DB insert fails, as the payment method is already attached in Stripe
    }

    // Set as default if requested
    if (makeDefault) {
      await stripe.customers.update(customer.stripe_customer_id, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // Update in database
      await adminClient
        .from("stripe_payment_methods")
        // @ts-expect-error - Supabase type inference issue with Database types
        .update({ is_default: false })
        .eq("tenant_id", tenantId);

      await adminClient
        .from("stripe_payment_methods")
        // @ts-expect-error - Supabase type inference issue with Database types
        .update({ is_default: true })
        .eq("stripe_payment_method_id", paymentMethodId);
    }

    return { success: true };
  } catch (error) {
    console.error("Error attaching payment method:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to attach payment method",
    };
  }
}
