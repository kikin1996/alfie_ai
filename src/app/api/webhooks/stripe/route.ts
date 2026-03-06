import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: `Webhook Error: ${(err as Error).message}` }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  // checkout.session.completed – nová platba proběhla
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;
    const planId = session.metadata?.plan_id;
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
    const stripeSubId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

    if (!userId || !planId) {
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    // Načíst počet kreditů plánu
    const { data: plan } = await supabaseAdmin
      .from("subscription_plans")
      .select("credits_per_month")
      .eq("id", planId)
      .maybeSingle();

    const credits = plan?.credits_per_month ?? 0;
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await supabaseAdmin
      .from("user_subscriptions")
      .upsert(
        {
          user_id: userId,
          plan_id: planId,
          credits_remaining: credits,
          period_start: now.toISOString(),
          period_end: periodEnd.toISOString(),
          status: "active",
          stripe_customer_id: customerId ?? null,
          stripe_subscription_id: stripeSubId ?? null,
          updated_at: now.toISOString(),
        },
        { onConflict: "user_id" }
      );
  }

  // invoice.paid – automatická obnova předplatného
  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice & { subscription?: string | { id: string } | null };
    const stripeSubId = typeof invoice.subscription === "string" ? invoice.subscription : (invoice.subscription as { id: string } | null | undefined)?.id;
    if (!stripeSubId) return NextResponse.json({ ok: true });

    // Najít uživatele podle stripe_subscription_id
    const { data: sub } = await supabaseAdmin
      .from("user_subscriptions")
      .select("user_id, plan_id, plan:subscription_plans(credits_per_month)")
      .eq("stripe_subscription_id", stripeSubId)
      .maybeSingle();

    if (sub) {
      const credits = (sub.plan as unknown as { credits_per_month: number } | null)?.credits_per_month ?? 0;
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      await supabaseAdmin
        .from("user_subscriptions")
        .update({
          credits_remaining: credits,
          period_start: now.toISOString(),
          period_end: periodEnd.toISOString(),
          status: "active",
          updated_at: now.toISOString(),
        })
        .eq("stripe_subscription_id", stripeSubId);
    }
  }

  // customer.subscription.deleted – zrušení předplatného
  if (event.type === "customer.subscription.deleted") {
    const stripeSub = event.data.object as Stripe.Subscription;
    await supabaseAdmin
      .from("user_subscriptions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("stripe_subscription_id", stripeSub.id);
  }

  return NextResponse.json({ ok: true });
}
