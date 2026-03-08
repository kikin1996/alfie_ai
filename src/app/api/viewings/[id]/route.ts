import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { address, clientName, clientPhone } = body as {
    address?: string;
    clientName?: string;
    clientPhone?: string;
  };

  const admin = getSupabaseAdmin();

  // Ověřit vlastnictví
  const { data: viewing } = await admin
    .from("viewings")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!viewing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: Record<string, string> = {};
  if (address !== undefined) updates.address = address;
  if (clientName !== undefined) updates.client_name = clientName;
  if (clientPhone !== undefined) updates.client_phone = clientPhone;

  const { error } = await admin
    .from("viewings")
    .update(updates)
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
