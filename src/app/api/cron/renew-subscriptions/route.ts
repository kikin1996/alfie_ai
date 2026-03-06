import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function checkCronAuth(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!checkCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
  }

  const now = new Date();

  // Najít všechna aktivní předplatná, jejichž period_end je <= now
  const { data: expired, error } = await supabaseAdmin
    .from("user_subscriptions")
    .select("id, user_id, plan_id, plan:subscription_plans(credits_per_month)")
    .eq("status", "active")
    .lte("period_end", now.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!expired?.length) {
    return NextResponse.json({ ok: true, renewed: 0 });
  }

  let renewed = 0;

  for (const sub of expired as unknown as {
    id: string;
    user_id: string;
    plan_id: string;
    plan: { credits_per_month: number } | null;
  }[]) {
    const credits = sub.plan?.credits_per_month ?? 0;
    const periodStart = now.toISOString();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const { error: updateError } = await supabaseAdmin
      .from("user_subscriptions")
      .update({
        credits_remaining: credits,
        period_start: periodStart,
        period_end: periodEnd.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", sub.id);

    if (!updateError) renewed++;
  }

  return NextResponse.json({ ok: true, renewed });
}
