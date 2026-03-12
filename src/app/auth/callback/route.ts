import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

/**
 * GET /auth/callback
 * Supabase OAuth callback – vymění auth code za session a přesměruje do dashboardu.
 * Díky tomu Google v OAuth dialogu zobrazí doménu aplikace místo supabase.co URL.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
