"use client";

import React, { useEffect, useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { getProducts } from "@/app/actions/stripe/products";
import { getActiveSubscription } from "@/app/actions/stripe/subscriptions";
import { createCheckoutSession } from "@/app/actions/stripe/checkout";

export default function PlansPage() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [processingPriceId, setProcessingPriceId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [productsResult, subResult] = await Promise.all([
        getProducts(),
        getActiveSubscription(),
      ]);

      if (productsResult.success) {
        setProducts(productsResult.products || []);
      } else {
        setError(productsResult.error || "Failed to load products");
      }

      if (subResult.success) {
        setCurrentSubscription(subResult.subscription);
      }
    } catch (err) {
      console.error("Error loading data:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (priceId: string) => {
    try {
      setProcessingPriceId(priceId);
      setError(null);

      const result = await createCheckoutSession({
        priceId,
        successUrl: `${window.location.origin}/saas/billing/dashboard?success=true`,
        cancelUrl: `${window.location.origin}/saas/billing/plans?canceled=true`,
      });

      if (result.success && result.url) {
        window.location.href = result.url;
      } else {
        setError(result.error || "Failed to create checkout session");
      }
    } catch (err) {
      console.error("Error creating checkout session:", err);
      setError(err instanceof Error ? err.message : "Failed to create checkout session");
    } finally {
      setProcessingPriceId(null);
    }
  };

  const formatCurrency = (amount: number | null | undefined, currency: string = "usd") => {
    if (amount === null || amount === undefined) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getBillingInterval = (interval: string | null, intervalCount: number | null) => {
    if (!interval) return "one-time";
    if (intervalCount && intervalCount > 1) {
      return `every ${intervalCount} ${interval}s`;
    }
    return `per ${interval}`;
  };

  const isCurrentPlan = (priceId: string) => {
    return currentSubscription?.stripe_price_id === priceId;
  };

  if (loading) {
    return (
      <div>
        <PageBreadcrumb pageTitle="Subscription Plans" />
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500 dark:text-gray-400">Loading plans...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageBreadcrumb pageTitle="Subscription Plans" />

      {error && (
        <div className="mb-5 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-500/15 dark:text-red-300">
          {error}
        </div>
      )}

      {currentSubscription && (
        <div className="mb-6 rounded-lg bg-blue-50 p-4 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Current Plan: {currentSubscription.plan_name}</div>
              <div className="text-sm">
                {formatCurrency(currentSubscription.plan_price, currentSubscription.currency)} /{" "}
                {currentSubscription.billing_cycle}
              </div>
            </div>
            {currentSubscription.cancel_at_period_end && (
              <span className="text-sm text-orange-600 dark:text-orange-400">
                Cancels on{" "}
                {new Date(currentSubscription.current_period_end).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-gray-500 dark:text-gray-400">
            No plans available at the moment. Please check back later.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <div
              key={product.id}
              className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]"
            >
              <div className="mb-4">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white/90">
                  {product.name}
                </h3>
                {product.description && (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {product.description}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                {product.prices && product.prices.length > 0 ? (
                  product.prices.map((price: any) => (
                    <div
                      key={price.id}
                      className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
                    >
                      <div className="mb-3">
                        <div className="text-3xl font-bold text-gray-800 dark:text-white/90">
                          {formatCurrency(price.unit_amount, price.currency)}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {getBillingInterval(price.interval, price.interval_count)}
                        </div>
                      </div>

                      {isCurrentPlan(price.stripe_price_id) ? (
                        <Button variant="outline" disabled className="w-full">
                          Current Plan
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleSubscribe(price.stripe_price_id)}
                          disabled={processingPriceId === price.stripe_price_id}
                          className="w-full"
                        >
                          {processingPriceId === price.stripe_price_id
                            ? "Processing..."
                            : currentSubscription
                            ? "Switch to This Plan"
                            : "Subscribe"}
                        </Button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No pricing available for this product.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 rounded-lg bg-gray-50 p-6 dark:bg-gray-800/30">
        <h4 className="mb-2 font-semibold text-gray-800 dark:text-white/90">Need Help?</h4>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          If you have questions about our plans or need a custom solution, please contact our
          support team.
        </p>
      </div>
    </div>
  );
}




