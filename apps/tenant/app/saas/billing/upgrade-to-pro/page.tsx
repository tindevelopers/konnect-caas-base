"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { CheckIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { createBrowserClient } from "@/core/database";

const proFeatures = [
  "50,000 orders per month",
  "Unlimited integrations",
  "Exclusive AutoFile discount",
  "50 GB Storage",
  "Custom Templates",
  "Advanced Marketing tool",
  "Priority Support",
  "Advanced Analytics",
  "API Access",
  "White-label Options",
];

const currentPlan = {
  name: "Professional",
  price: 199,
  features: [
    "25,500 orders per month",
    "Unlimited integrations",
    "Exclusive AutoFile discount",
    "10 GB Storage",
  ],
};

const proPlan = {
  name: "Pro",
  price: 399,
  features: proFeatures,
};

export default function UpgradeToProPage() {
  const router = useRouter();
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<"monthly" | "annual">("monthly");

  const monthlyPrice = proPlan.price;
  const annualPrice = proPlan.price * 12 * 0.83; // 17% discount

  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      // Get tenant ID
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
        alert("Unable to determine tenant. Please try again.");
        return;
      }

      // Get plans and find the Pro plan price
      const { getProducts } = await import("@/app/actions/stripe/products");
      const { createCheckoutSession } = await import("@/app/actions/stripe/checkout");

      const plansResult = await getProducts();
      if (!plansResult.success || !plansResult.products) {
        alert("Unable to load plans. Please try again.");
        return;
      }

      const proPlanFromStripe = plansResult.products.find((p: any) =>
        p.name.toLowerCase().includes("pro")
      );

      if (!proPlanFromStripe || !proPlanFromStripe.prices) {
        alert("Pro plan not found. Please contact support.");
        return;
      }

      // Find the price for the selected billing cycle
      const price = proPlanFromStripe.prices.find((p: any) => 
        p.billing_cycle === selectedBillingCycle
      );

      if (!price) {
        alert(`No ${selectedBillingCycle} pricing found for Pro plan.`);
        return;
      }

      // Create checkout session
      const checkoutResult = await createCheckoutSession({
        priceId: price.id,
        successUrl: `${window.location.origin}/saas/billing/dashboard?success=true`,
        cancelUrl: `${window.location.origin}/saas/billing/upgrade-to-pro?canceled=true`
      });

      if (checkoutResult.success && checkoutResult.url) {
        window.location.href = checkoutResult.url;
      } else {
        alert(checkoutResult.error || "Failed to start checkout. Please try again.");
      }
    } catch (error) {
      console.error("Error upgrading:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Upgrade to Pro" />
      <div className="space-y-6">
        {/* Billing Cycle Toggle */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setSelectedBillingCycle("monthly")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              selectedBillingCycle === "monthly"
                ? "bg-brand-500 text-white"
                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setSelectedBillingCycle("annual")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              selectedBillingCycle === "annual"
                ? "bg-brand-500 text-white"
                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
            }`}
          >
            Annual
            <span className="ml-2 rounded-full bg-green-500 px-2 py-0.5 text-xs text-white">
              Save 17%
            </span>
          </button>
        </div>

        {/* Plan Comparison */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Current Plan */}
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-6">
              <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                {currentPlan.name}
              </h3>
              <div className="mb-4">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">
                  ${currentPlan.price}
                </span>
                <span className="text-gray-500 dark:text-gray-400">/month</span>
              </div>
              <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                Current Plan
              </span>
            </div>

            <ul className="space-y-3">
              {currentPlan.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <CheckIcon className="h-5 w-5 shrink-0 text-gray-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pro Plan */}
          <div className="relative rounded-3xl border-2 border-brand-500 bg-white p-6 shadow-lg dark:border-brand-500 dark:bg-gray-900">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="rounded-full bg-brand-500 px-4 py-1 text-xs font-semibold text-white">
                RECOMMENDED
              </span>
            </div>

            <div className="mb-6 mt-4">
              <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                {proPlan.name}
              </h3>
              <div className="mb-4">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">
                  $
                  {selectedBillingCycle === "monthly"
                    ? monthlyPrice
                    : Math.round(annualPrice / 12)}
                </span>
                <span className="text-gray-500 dark:text-gray-400">/month</span>
                {selectedBillingCycle === "annual" && (
                  <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Billed annually (${Math.round(annualPrice)}/year)
                  </div>
                )}
              </div>
            </div>

            <ul className="mb-6 space-y-3">
              {proPlan.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <CheckIcon className="h-5 w-5 shrink-0 text-brand-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            <Button onClick={handleUpgrade} className="w-full" disabled={loading}>
              {loading ? "Processing..." : "Upgrade to Pro"}
            </Button>
          </div>
        </div>

        {/* Additional Info */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-800/50">
          <h4 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            What happens when you upgrade?
          </h4>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li>• Your current plan will be upgraded immediately</li>
            <li>• You&apos;ll be charged the prorated difference for the current billing period</li>
            <li>• All Pro features will be available immediately</li>
            <li>• Your renewal date will remain the same</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

