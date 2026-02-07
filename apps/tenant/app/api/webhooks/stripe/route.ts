import { NextRequest, NextResponse } from "next/server";
import { getStripe, stripeConfig, isStripeConfigured } from "@/core/billing/config";
import { createAdminClient } from "@/core/database/admin-client";
import Stripe from "stripe";

/**
 * Stripe webhook handler
 * Handles events from Stripe and updates the database accordingly
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, stripe-signature",
    },
  });
}

export async function POST(req: NextRequest) {
  // Check if Stripe is configured
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { 
        error: "Stripe is not configured. To enable payment processing, please set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in your environment variables." 
      },
      { status: 503 }
    );
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  if (!stripeConfig.webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook secret not configured. Please set STRIPE_WEBHOOK_SECRET in your environment variables." },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, stripeConfig.webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: `Webhook Error: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 400 }
    );
  }

  const adminClient = createAdminClient();

  // Log the webhook event
  await (adminClient.from("stripe_webhook_events") as any).insert({
    stripe_event_id: event.id,
    event_type: event.type,
    livemode: event.livemode,
    event_data: event.data as any,
  });

  try {
    switch (event.type) {
      case "customer.created":
      case "customer.updated":
        await handleCustomerEvent(event.data.object as Stripe.Customer);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionEvent(event.data.object as Stripe.Subscription);
        break;

      case "invoice.created":
      case "invoice.updated":
      case "invoice.paid":
      case "invoice.payment_failed":
        await handleInvoiceEvent(event.data.object as Stripe.Invoice);
        break;

      case "payment_method.attached":
      case "payment_method.updated":
      case "payment_method.detached":
        await handlePaymentMethodEvent(event.data.object as Stripe.PaymentMethod, event.type);
        break;

      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Mark event as processed
    await ((adminClient
      .from("stripe_webhook_events") as any)
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      } as any)
      .eq("stripe_event_id", event.id));

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`Error processing webhook event ${event.type}:`, error);

    // Log error
    await ((adminClient
      .from("stripe_webhook_events") as any)
      .update({
        error_message: error instanceof Error ? error.message : "Unknown error",
      } as any)
      .eq("stripe_event_id", event.id));

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed" },
      { status: 500 }
    );
  }
}

async function handleCustomerEvent(customer: Stripe.Customer) {
  const adminClient = createAdminClient();
  const tenantId = customer.metadata?.tenant_id;

  if (!tenantId) {
    console.warn("Customer has no tenant_id in metadata:", customer.id);
    return;
  }

  await ((adminClient
    .from("stripe_customers") as any)
    .upsert(
      {
        tenant_id: tenantId,
        stripe_customer_id: customer.id,
        email: customer.email || "",
        name: customer.name || "",
        phone: customer.phone || null,
        address: customer.address as any,
        metadata: customer.metadata as any,
      } as any,
      {
        onConflict: "stripe_customer_id",
      }
    ));
}

async function handleSubscriptionEvent(subscription: Stripe.Subscription) {
  const adminClient = createAdminClient();
  const tenantId = subscription.metadata?.tenant_id;

  if (!tenantId) {
    console.warn("Subscription has no tenant_id in metadata:", subscription.id);
    return;
  }

  const price = subscription.items.data[0]?.price;
  const product = typeof price?.product === "string" ? price.product : price?.product?.id;

  await ((adminClient
    .from("stripe_subscriptions") as any)
    .upsert(
      {
        tenant_id: tenantId,
        stripe_customer_id:
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id,
        stripe_subscription_id: subscription.id,
        stripe_price_id: price?.id || null,
        stripe_product_id: product || null,
        status: subscription.status,
        current_period_start: new Date((subscription as any).current_period_start * 1000).toISOString(),
        current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000).toISOString()
          : null,
        trial_start: subscription.trial_start
          ? new Date(subscription.trial_start * 1000).toISOString()
          : null,
        trial_end: subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
        plan_name: price?.nickname || product || "Unknown Plan",
        plan_price: price?.unit_amount || null,
        billing_cycle: price?.recurring?.interval || null,
        currency: price?.currency || "usd",
        metadata: subscription.metadata as any,
      } as any,
      { onConflict: 'stripe_subscription_id' }
    ));
}

async function handleInvoiceEvent(invoice: Stripe.Invoice) {
  const adminClient = createAdminClient();
  const tenantId = invoice.metadata?.tenant_id;

  if (!tenantId) {
    console.warn("Invoice has no tenant_id in metadata:", invoice.id);
    return;
  }

  await ((adminClient
    .from("stripe_invoices") as any)
    .upsert(
      {
        tenant_id: tenantId,
        stripe_customer_id:
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id || "",
        stripe_subscription_id:
          typeof (invoice as any).subscription === "string" ? (invoice as any).subscription : null,
        stripe_invoice_id: invoice.id,
        invoice_number: invoice.number || null,
        status: invoice.status || "draft",
        amount_due: invoice.amount_due,
        amount_paid: invoice.amount_paid,
        subtotal: invoice.subtotal,
        total: invoice.total,
        tax: (invoice as any).tax || null,
        currency: invoice.currency,
        due_date: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
        paid_at:
          invoice.status_transitions?.paid_at
            ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
            : null,
        invoice_pdf: invoice.invoice_pdf || null,
        invoice_hosted_url: invoice.hosted_invoice_url || null,
        line_items: invoice.lines?.data as any,
        metadata: invoice.metadata as any,
      } as any,
      {
        onConflict: "stripe_invoice_id",
      }
    ));
}

async function handlePaymentMethodEvent(
  paymentMethod: Stripe.PaymentMethod,
  eventType: string
) {
  const adminClient = createAdminClient();

  if (eventType === "payment_method.detached") {
    // Delete the payment method from database
    await adminClient
      .from("stripe_payment_methods")
      .delete()
      .eq("stripe_payment_method_id", paymentMethod.id);
    return;
  }

  // Get customer to find tenant_id
  const customerId =
    typeof paymentMethod.customer === "string"
      ? paymentMethod.customer
      : paymentMethod.customer?.id;

  if (!customerId) {
    console.warn("Payment method has no customer:", paymentMethod.id);
    return;
  }

  const result: { data: { tenant_id: string } | null; error: any } = await adminClient
    .from("stripe_customers")
    .select("tenant_id")
    .eq("stripe_customer_id", customerId)
    .single();

  const customer = result.data;
  if (!customer) {
    console.warn("Customer not found in database:", customerId);
    return;
  }

  await ((adminClient
    .from("stripe_payment_methods") as any)
    .upsert(
      {
        tenant_id: customer.tenant_id,
        stripe_customer_id: customerId,
        stripe_payment_method_id: paymentMethod.id,
        type: paymentMethod.type,
        card_brand: paymentMethod.card?.brand || null,
        card_last4: paymentMethod.card?.last4 || null,
        card_exp_month: paymentMethod.card?.exp_month || null,
        card_exp_year: paymentMethod.card?.exp_year || null,
        billing_details: paymentMethod.billing_details as any,
        metadata: paymentMethod.metadata as any,
      } as any,
      { onConflict: 'stripe_payment_method_id' }
    ));
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const adminClient = createAdminClient();

  // If this was a subscription checkout, the subscription webhook will handle it
  if (session.mode === "subscription") {
    return;
  }

  // Handle one-time payments if needed
  console.log("Checkout session completed:", session.id);
}
