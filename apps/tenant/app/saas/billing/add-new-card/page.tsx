"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { createSetupIntent, attachPaymentMethod } from "@/app/actions/stripe/payment-methods";
import { getStripe } from "@/core/billing/client";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient as createBrowserClient } from "@/core/database/client";

function AddPaymentMethodForm({ router }: { router: ReturnType<typeof useRouter> }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    async function getTenantId() {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
      const result: { data: { tenant_id: string | null } | null; error: any } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", user.id)
        .single();
      const userData = result.data;
      if (userData?.tenant_id) {
        setTenantId(userData.tenant_id);
      }
      }
    }
    getTenantId();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || !tenantId) return;

    setLoading(true);
    setError(null);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message || "An error occurred");
        setLoading(false);
        return;
      }

      const { error: confirmError, paymentMethod } = await stripe.createPaymentMethod({
        elements,
      });

      if (confirmError || !paymentMethod) {
        setError(confirmError?.message || "Failed to create payment method");
        setLoading(false);
        return;
      }

      // Attach payment method to customer
      const result = await attachPaymentMethod(paymentMethod.id, true);

      if (result.success) {
        router.push("/saas/billing/dashboard");
      } else {
        setError(result.error || "Failed to save payment method");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <PaymentElement />
      </div>
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-500/15 dark:text-red-300">
          {error}
        </div>
      )}
      <div className="flex gap-3">
        <Button type="submit" disabled={loading || !stripe}>
          {loading ? "Adding..." : "Add Payment Method"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default function AddNewCardPage() {
  const router = useRouter();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    async function setup() {
      try {
        const supabase = createBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.push("/signin");
          return;
        }

        const userResult: { data: { tenant_id: string | null } | null; error: any } = await supabase
          .from("users")
          .select("tenant_id")
          .eq("id", user.id)
          .single();

        const userData = userResult.data;
        if (!userData?.tenant_id) {
          console.error("User has no tenant");
          return;
        }

        setTenantId(userData.tenant_id);

        // Create setup intent
        const setupResult = await createSetupIntent();
        if (setupResult.success && setupResult.clientSecret) {
          setClientSecret(setupResult.clientSecret);
        }
      } catch (error) {
        console.error("Error setting up payment form:", error);
      } finally {
        setLoading(false);
      }
    }

    setup();
  }, []);

  if (loading) {
    return (
      <div>
        <PageBreadcrumb pageTitle="Add Payment Method" />
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div>
        <PageBreadcrumb pageTitle="Add Payment Method" />
        <div className="rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-500/15 dark:text-red-300">
          Failed to initialize payment form. Please try again.
        </div>
      </div>
    );
  }

  const stripePromise = getStripe();

  return (
    <div>
      <PageBreadcrumb pageTitle="Add Payment Method" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Add Payment Method</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Add a new payment method to your account
          </p>
        </div>

        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <AddPaymentMethodForm router={router} />
        </Elements>
      </div>
    </div>
  );
}
