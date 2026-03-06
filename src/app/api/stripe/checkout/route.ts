import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";

/**
 * POST /api/stripe/checkout
 * Body: { planId: string }
 * Vrátí: { url: string } – URL Stripe Checkout session (sandbox)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { planId } = await request.json().catch(() => ({})) as { planId?: string };
  if (!planId) return NextResponse.json({ error: "planId is required" }, { status: 400 });

  const supabaseAdmin = getSupabaseAdmin();

  // Načíst plán a jeho Stripe price ID
  const { data: plan } = await supabaseAdmin
    .from("subscription_plans")
    .select("id, name, stripe_price_id, credits_per_month")
    .eq("id", planId)
    .maybeSingle();

  if (!plan) return NextResponse.json({ error: "Plán neexistuje" }, { status: 400 });
  if (!plan.stripe_price_id) {
    return NextResponse.json({ error: "Stripe price ID není nastaveno pro tento plán. Nastavte ho v Supabase (subscription_plans.stripe_price_id)." }, { status: 400 });
  }

  const stripe = getStripe();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.headers.get("origin") ?? "http://localhost:3000";

  // Zjistit nebo vytvořit Stripe customer
  let customerId: string | undefined;
  const { data: sub } = await supabaseAdmin
    .from("user_subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (sub?.stripe_customer_id) {
    customerId = sub.stripe_customer_id;
  } else {
    const customer = await stripe.customers.create({
      email: session.user.email ?? undefined,
      metadata: { user_id: session.user.id },
    });
    customerId = customer.id;
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
    success_url: `${baseUrl}/subscription?success=1`,
    cancel_url: `${baseUrl}/subscription?cancelled=1`,
    metadata: {
      user_id: session.user.id,
      plan_id: planId,
    },
    subscription_data: {
      metadata: {
        user_id: session.user.id,
        plan_id: planId,
      },
    },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
