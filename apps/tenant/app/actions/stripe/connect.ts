"use server";

import { stripe } from "@/core/billing/config";
import { createAdminClient } from "@/core/database/admin-client";
import { requirePermission } from "@/core/permissions/middleware";
import type Stripe from "stripe";

/**
 * Create a Stripe Connect account for a tenant
 * This allows the tenant to receive payments on the platform
 */
export async function createConnectAccount(
  tenantId: string,
  accountType: "express" | "standard" | "custom" = "express",
  email?: string,
  country?: string
): Promise<{ success: boolean; accountId?: string; error?: string }> {
  try {
    // Check permissions
    await requirePermission("tenants.write");

    const adminClient = createAdminClient();

    // Check if account already exists
    const accountResult: { data: { stripe_account_id: string } | null; error: any } = await adminClient
      .from("stripe_connect_accounts")
      .select("stripe_account_id")
      .eq("tenant_id", tenantId)
      .single();

    const existingAccount = accountResult.data;
    if (existingAccount) {
      return {
        success: true,
        accountId: existingAccount.stripe_account_id,
      };
    }

    // Get tenant details
    const tenantResult: { data: { name: string } | null; error: any } = await adminClient
      .from("tenants")
      .select("name")
      .eq("id", tenantId)
      .single();

    const tenant = tenantResult.data;
    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    // Create Stripe Connect account
    const accountParams: Stripe.AccountCreateParams = {
      type: accountType,
      country: country || "US",
      email: email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "company",
      company: {
        name: tenant.name,
      },
      metadata: {
        tenant_id: tenantId,
      },
    };

    const account = await stripe.accounts.create(accountParams);

    // Save to database
    // @ts-expect-error - Supabase type inference issue with Database types
    await adminClient.from("stripe_connect_accounts").insert({
      tenant_id: tenantId,
      stripe_account_id: account.id,
      account_type: accountType,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      country: account.country || country || "US",
      default_currency: account.default_currency || "usd",
      email: account.email || email,
      business_name: account.business_profile?.name || tenant.name,
      metadata: account.metadata as any,
    });

    return { success: true, accountId: account.id };
  } catch (error) {
    console.error("Error creating connect account:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create connect account",
    };
  }
}

/**
 * Create an account link for Connect onboarding
 */
export async function createConnectAccountLink(
  tenantId: string,
  refreshUrl: string,
  returnUrl: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    await requirePermission("tenants.write");

    const adminClient = createAdminClient();

    // Get connect account
    const accountResult1: { data: { stripe_account_id: string } | null; error: any } = await adminClient
      .from("stripe_connect_accounts")
      .select("stripe_account_id")
      .eq("tenant_id", tenantId)
      .single();

    const connectAccount = accountResult1.data;
    let stripeAccountId: string;

    if (!connectAccount || !connectAccount.stripe_account_id) {
      // Create account first
      const createResult = await createConnectAccount(tenantId);
      if (!createResult.success || !createResult.accountId) {
        return { success: false, error: "Failed to create connect account" };
      }
      stripeAccountId = createResult.accountId;
    } else {
      stripeAccountId = connectAccount.stripe_account_id;
    }

    // Create account link
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return { success: true, url: accountLink.url };
  } catch (error) {
    console.error("Error creating account link:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create account link",
    };
  }
}

/**
 * Create a login link for Connect dashboard
 */
export async function createConnectLoginLink(tenantId: string): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  try {
    await requirePermission("tenants.write");

    const adminClient = createAdminClient();

    // Get connect account
    const accountResult2: { data: { stripe_account_id: string } | null; error: any } = await adminClient
      .from("stripe_connect_accounts")
      .select("stripe_account_id")
      .eq("tenant_id", tenantId)
      .single();

    const connectAccount = accountResult2.data;
    if (!connectAccount) {
      return { success: false, error: "Connect account not found" };
    }

    // Create login link
    const loginLink = await stripe.accounts.createLoginLink(connectAccount.stripe_account_id);

    return { success: true, url: loginLink.url };
  } catch (error) {
    console.error("Error creating login link:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create login link",
    };
  }
}

/**
 * Get Connect account details
 */
export async function getConnectAccount(tenantId: string): Promise<{
  success: boolean;
  account?: any;
  error?: string;
}> {
  try {
    const adminClient = createAdminClient();

    // Get connect account from database
    const accountResult3: { data: any | null; error: any } = await adminClient
      .from("stripe_connect_accounts")
      .select("*")
      .eq("tenant_id", tenantId)
      .single();

    const connectAccount = accountResult3.data;
    const error = accountResult3.error;

    if (error || !connectAccount) {
      return { success: false, error: "Connect account not found" };
    }

    // Fetch full account details from Stripe
    const stripeAccount = await stripe.accounts.retrieve(connectAccount.stripe_account_id);

    return {
      success: true,
      account: {
        ...(connectAccount as Record<string, unknown>),
        stripe_details: stripeAccount,
      },
    };
  } catch (error) {
    console.error("Error retrieving connect account:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to retrieve connect account",
    };
  }
}

/**
 * Update Connect account in database (called from webhooks)
 */
export async function updateConnectAccount(
  accountId: string,
  accountData: Partial<Stripe.Account>
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminClient = createAdminClient();

    const updateData: any = {};

    if (accountData.charges_enabled !== undefined) {
      updateData.charges_enabled = accountData.charges_enabled;
    }
    if (accountData.payouts_enabled !== undefined) {
      updateData.payouts_enabled = accountData.payouts_enabled;
    }
    if (accountData.details_submitted !== undefined) {
      updateData.details_submitted = accountData.details_submitted;
    }
    if (accountData.email) {
      updateData.email = accountData.email;
    }
    if (accountData.business_profile?.name) {
      updateData.business_name = accountData.business_profile.name;
    }
    if (accountData.metadata) {
      updateData.metadata = accountData.metadata;
    }

    await adminClient
      .from("stripe_connect_accounts")
      // @ts-expect-error - Supabase type inference issue with Database types
      .update(updateData)
      .eq("stripe_account_id", accountId);

    return { success: true };
  } catch (error) {
    console.error("Error updating connect account:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update connect account",
    };
  }
}

/**
 * Create a payment for a connected account (platform fee model)
 */
export async function createConnectedPayment(
  tenantId: string,
  amount: number,
  currency: string = "usd",
  platformFeePercent: number = 10 // Platform takes 10% by default
): Promise<{ success: boolean; paymentIntentId?: string; error?: string }> {
  try {
    const adminClient = createAdminClient();

    // Get connect account
    const accountResult4: { data: { stripe_account_id: string } | null; error: any } = await adminClient
      .from("stripe_connect_accounts")
      .select("stripe_account_id")
      .eq("tenant_id", tenantId)
      .single();

    const connectAccount = accountResult4.data;
    if (!connectAccount) {
      return { success: false, error: "Connect account not found" };
    }

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

    // Calculate platform fee (in cents)
    const platformFee = Math.round((amount * platformFeePercent) / 100);

    // Create payment intent with destination charge
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customer.stripe_customer_id,
      transfer_data: {
        destination: connectAccount.stripe_account_id,
      },
      application_fee_amount: platformFee,
      metadata: {
        tenant_id: tenantId,
        platform_fee_percent: platformFeePercent.toString(),
      },
    });

    return { success: true, paymentIntentId: paymentIntent.id };
  } catch (error) {
    console.error("Error creating connected payment:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create payment",
    };
  }
}

/**
 * Create a payout to connected account
 */
export async function createPayout(
  tenantId: string,
  amount: number,
  currency: string = "usd"
): Promise<{ success: boolean; payoutId?: string; error?: string }> {
  try {
    await requirePermission("billing.write");

    const adminClient = createAdminClient();

    // Get connect account
    const accountResultPayout: { data: { stripe_account_id: string } | null; error: any } = await adminClient
      .from("stripe_connect_accounts")
      .select("stripe_account_id")
      .eq("tenant_id", tenantId)
      .single();

    const connectAccount = accountResultPayout.data;
    if (!connectAccount) {
      return { success: false, error: "Connect account not found" };
    }

    // Create payout
    const payout = await stripe.payouts.create(
      {
        amount,
        currency,
        metadata: {
          tenant_id: tenantId,
        },
      },
      {
        stripeAccount: connectAccount.stripe_account_id,
      }
    );

    return { success: true, payoutId: payout.id };
  } catch (error) {
    console.error("Error creating payout:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create payout",
    };
  }
}

/**
 * Get balance for connected account
 */
export async function getConnectAccountBalance(tenantId: string): Promise<{
  success: boolean;
  balance?: any;
  error?: string;
}> {
  try {
    const adminClient = createAdminClient();

    // Get connect account
    const accountResult6: { data: { stripe_account_id: string } | null; error: any } = await adminClient
      .from("stripe_connect_accounts")
      .select("stripe_account_id")
      .eq("tenant_id", tenantId)
      .single();

    const connectAccount = accountResult6.data;
    if (!connectAccount) {
      return { success: false, error: "Connect account not found" };
    }

    // Get balance
    const balance = await stripe.balance.retrieve({
      stripeAccount: connectAccount.stripe_account_id,
    });

    return { success: true, balance };
  } catch (error) {
    console.error("Error retrieving balance:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to retrieve balance",
    };
  }
}


