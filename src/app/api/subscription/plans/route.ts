import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("subscription_plans")
    .select("*")
    .order("sort_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const mapped = (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    priceCzk: p.price_czk,
    creditsPerMonth: p.credits_per_month,
    description: p.description,
    sortOrder: p.sort_order,
  }));
  return NextResponse.json(mapped);
}
