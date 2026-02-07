"use client";

import React, { useEffect, useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { getActiveSubscription, getUpcomingInvoice, getInvoices } from "@/app/actions/stripe/subscriptions";
import { getPaymentMethods } from "@/app/actions/stripe/payment-methods";
import { createBillingPortalSession } from "@/app/actions/stripe/checkout";
import { useRouter } from "next/navigation";

export default function BillingDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const [upcomingInvoice, setUpcomingInvoice] = useState<any>(null);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [subResult, invoiceResult, invoicesResult, pmResult] = await Promise.all([
        getActiveSubscription(),
        getUpcomingInvoice(),
        getInvoices(5),
        getPaymentMethods(),
      ]);

      if (subResult.success) {
        setSubscription(subResult.subscription);
      }

      if (invoiceResult.success) {
        setUpcomingInvoice(invoiceResult.invoice);
      }

      if (invoicesResult.success) {
        setRecentInvoices(invoicesResult.invoices || []);
      }

      if (pmResult.success) {
        setPaymentMethods(pmResult.paymentMethods || []);
      }
    } catch (err) {
      console.error("Error loading billing data:", err);
      setError(err instanceof Error ? err.message : "Failed to load billing data");
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      const result = await createBillingPortalSession(
        `${window.location.origin}/saas/billing/dashboard`
      );

      if (result.success && result.url) {
        window.location.href = result.url;
      } else {
        setError(result.error || "Failed to open billing portal");
      }
    } catch (err) {
      console.error("Error opening billing portal:", err);
      setError(err instanceof Error ? err.message : "Failed to open billing portal");
    }
  };

  const formatCurrency = (amount: number | null | undefined, currency: string = "usd") => {
    if (amount === null || amount === undefined) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div>
        <PageBreadcrumb pageTitle="Billing Dashboard" />
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500 dark:text-gray-400">Loading billing information...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageBreadcrumb pageTitle="Billing Dashboard" />

      {error && (
        <div className="mb-5 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-500/15 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Current Subscription */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90">
            Current Subscription
          </h3>

          {subscription ? (
            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Plan</div>
                <div className="text-lg font-semibold text-gray-800 dark:text-white/90">
                  {subscription.plan_name || "Unknown Plan"}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Status</div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                      subscription.status === "active"
                        ? "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300"
                        : subscription.status === "trialing"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-500/15 dark:text-gray-300"
                    }`}
                  >
                    {subscription.status}
                  </span>
                  {subscription.cancel_at_period_end && (
                    <span className="text-xs text-orange-600 dark:text-orange-400">
                      (Cancels on {formatDate(subscription.current_period_end)})
                    </span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Price</div>
                <div className="text-lg font-semibold text-gray-800 dark:text-white/90">
                  {formatCurrency(subscription.plan_price, subscription.currency)} /{" "}
                  {subscription.billing_cycle || "month"}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Current Period</div>
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  {formatDate(subscription.current_period_start)} -{" "}
                  {formatDate(subscription.current_period_end)}
                </div>
              </div>

              {subscription.trial_end && new Date(subscription.trial_end) > new Date() && (
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Trial Ends</div>
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    {formatDate(subscription.trial_end)}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400 mb-4">No active subscription</p>
              <Button onClick={() => router.push("/saas/billing/plans")}>
                View Plans
              </Button>
            </div>
          )}
        </div>

        {/* Upcoming Invoice */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90">
            Upcoming Invoice
          </h3>

          {upcomingInvoice ? (
            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Amount Due</div>
                <div className="text-2xl font-bold text-gray-800 dark:text-white/90">
                  {formatCurrency(upcomingInvoice.amount_due, upcomingInvoice.currency)}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Due Date</div>
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  {upcomingInvoice.period_end
                    ? formatDate(new Date(upcomingInvoice.period_end * 1000).toISOString())
                    : "N/A"}
                </div>
              </div>

              {upcomingInvoice.lines?.data && upcomingInvoice.lines.data.length > 0 && (
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Line Items</div>
                  <div className="space-y-2">
                    {upcomingInvoice.lines.data.map((line: any, index: number) => (
                      <div
                        key={index}
                        className="flex justify-between text-sm text-gray-700 dark:text-gray-300"
                      >
                        <span>{line.description}</span>
                        <span>{formatCurrency(line.amount, upcomingInvoice.currency)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">No upcoming invoices</p>
            </div>
          )}
        </div>

        {/* Payment Methods */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Payment Methods
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/saas/billing/payment-methods")}
            >
              Manage
            </Button>
          </div>

          {paymentMethods.length > 0 ? (
            <div className="space-y-3">
              {paymentMethods.map((pm) => (
                <div
                  key={pm.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">💳</div>
                    <div>
                      <div className="text-sm font-medium text-gray-800 dark:text-white/90">
                        {pm.card_brand?.toUpperCase()} •••• {pm.card_last4}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Expires {pm.card_exp_month}/{pm.card_exp_year}
                      </div>
                    </div>
                  </div>
                  {pm.is_default && (
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-500/15 dark:text-blue-300">
                      Default
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400 mb-4">No payment methods added</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/saas/billing/payment-methods")}
              >
                Add Payment Method
              </Button>
            </div>
          )}
        </div>

        {/* Recent Invoices */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Recent Invoices
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/saas/billing/invoices")}
            >
              View All
            </Button>
          </div>

          {recentInvoices.length > 0 ? (
            <div className="space-y-3">
              {recentInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-800 dark:text-white/90">
                      {invoice.invoice_number || "Draft"}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(invoice.created_at)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-800 dark:text-white/90">
                      {formatCurrency(invoice.total, invoice.currency)}
                    </div>
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        invoice.status === "paid"
                          ? "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300"
                          : invoice.status === "open"
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-500/15 dark:text-gray-300"
                      }`}
                    >
                      {invoice.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">No invoices yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-3">
        {subscription && (
          <Button onClick={handleManageBilling}>
            Manage Billing
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => router.push("/saas/billing/plans")}
        >
          {subscription ? "Change Plan" : "View Plans"}
        </Button>
      </div>
    </div>
  );
}
