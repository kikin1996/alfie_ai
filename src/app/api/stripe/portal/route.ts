import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";

/**
 * POST /api/stripe/portal
 * Vytvoří Stripe Customer Portal session a vrátí URL pro přesměrování.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: sub } = await supabaseAdmin
    .from("user_subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: "Nenalezen Stripe zákazník. Nejprve aktivujte předplatné." }, { status: 400 });
  }

  const stripe = getStripe();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.headers.get("origin") ?? "http://localhost:3000";

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${baseUrl}/subscription`,
  });

  return NextResponse.json({ url: portalSession.url });
}
