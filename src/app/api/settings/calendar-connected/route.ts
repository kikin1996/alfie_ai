import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await supabase
    .from("user_settings")
    .select("google_refresh_token")
    .eq("user_id", session.user.id)
    .maybeSingle();

  return NextResponse.json({
    connected: !!data?.google_refresh_token,
  });
}
