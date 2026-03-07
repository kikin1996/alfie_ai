import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/subscription
 * Vrátí aktuální předplatné přihlášeného uživatele (včetně detailů plánu).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data } = await supabaseAdmin
    .from("user_subscriptions")
    .select("*, plan:subscription_plans(*)")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!data) return NextResponse.json(null);

  const mapped = {
    id: data.id,
    userId: data.user_id,
    planId: data.plan_id,
    creditsRemaining: data.credits_remaining,
    periodStart: data.period_start,
    periodEnd: data.period_end,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    plan: data.plan ? {
      id: data.plan.id,
      name: data.plan.name,
      priceCzk: data.plan.price_czk,
      creditsPerMonth: data.plan.credits_per_month,
      description: data.plan.description,
      sortOrder: data.plan.sort_order,
    } : undefined,
  };
  return NextResponse.json(mapped);
}

/**
 * POST /api/subscription
 * Aktivuje nebo změní plán předplatného.
 * Body: { planId: string }
 *
 * Poznámka: platba není implementována – změna plánu je okamžitá (demo).
 * Pro produkci propojte s platební bránou (Stripe, GoPay…).
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

  // Ověřit že plán existuje
  const { data: plan } = await supabaseAdmin
    .from("subscription_plans")
    .select("id, credits_per_month")
    .eq("id", planId)
    .maybeSingle();

  if (!plan) return NextResponse.json({ error: "Plán neexistuje" }, { status: 400 });

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const { data, error } = await supabaseAdmin
    .from("user_subscriptions")
    .upsert(
      {
        user_id: session.user.id,
        plan_id: planId,
        credits_remaining: plan.credits_per_month,
        period_start: now.toISOString(),
        period_end: periodEnd.toISOString(),
        status: "active",
        updated_at: now.toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select("*, plan:subscription_plans(*)")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
