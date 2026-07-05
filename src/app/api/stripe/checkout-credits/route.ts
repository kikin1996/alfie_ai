import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";
import { getCreditPack } from "@/lib/creditPacks";

/**
 * POST /api/stripe/checkout-credits
 * Body: { packId: string }
 * Jednorázové přikoupení balíčku kreditů. POUZE pro uživatele s aktivním
 * předplatným (vynuceno na serveru, nejen skryto v UI).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { packId } = await request.json().catch(() => ({})) as { packId?: string };
    const pack = packId ? getCreditPack(packId) : undefined;
    if (!pack) return NextResponse.json({ error: "Neplatný balíček kreditů" }, { status: 400 });

    const supabaseAdmin = getSupabaseAdmin();

    // Vynutit aktivní předplatné – přikoupení kreditů je jen pro předplatitele
    const { data: sub } = await supabaseAdmin
      .from("user_subscriptions")
      .select("status, stripe_customer_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!sub || sub.status !== "active") {
      return NextResponse.json(
        { error: "Přikoupení kreditů je dostupné jen s aktivním předplatným." },
        { status: 403 }
      );
    }

    const stripe = getStripe();
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? request.headers.get("origin") ?? "http://localhost:3000").trim().replace(/\/$/, "");

    // Reuse Stripe customer (aktivní předplatitel ho má)
    let customerId = sub.stripe_customer_id ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email ?? undefined,
        metadata: { user_id: session.user.id },
      });
      customerId = customer.id;
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "czk",
            product_data: { name: `Renote – ${pack.label}` },
            unit_amount: pack.priceCzk * 100,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/subscription?topup=1`,
      cancel_url: `${baseUrl}/subscription?cancelled=1`,
      metadata: {
        user_id: session.user.id,
        type: "credit_topup",
        pack_id: pack.id,
        credits: String(pack.credits),
        amount_czk: String(pack.priceCzk),
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[checkout-credits] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
