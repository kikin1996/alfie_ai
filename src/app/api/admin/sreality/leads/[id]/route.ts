import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function isAdmin(email: string | undefined): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || !email) return false;
  return email === adminEmail;
}

async function resolveEmail(request: NextRequest): Promise<string | undefined> {
  const supabase = await createClient();
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const { data: { user } } = await supabase.auth.getUser(token);
    return user?.email;
  }
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.email;
}

const VALID_STATUSES = ["new", "scheduled", "done", "archived"];
const VALID_REACTIONS = ["interested", "not_interested", "no_show", "thinking"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const email = await resolveEmail(request);
  if (!isAdmin(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.status !== undefined) {
    if (body.status !== null && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Neplatný status" }, { status: 400 });
    }
    update.status = body.status;
  }
  if (body.viewingAt !== undefined) {
    update.viewing_at = body.viewingAt || null;
  }
  if (body.reaction !== undefined) {
    if (body.reaction !== null && !VALID_REACTIONS.includes(body.reaction)) {
      return NextResponse.json({ error: "Neplatná reakce" }, { status: 400 });
    }
    update.reaction = body.reaction;
  }
  if (body.notes !== undefined) {
    update.notes = body.notes || null;
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("sreality_leads")
    .update(update)
    .eq("id", params.id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Poptávka nenalezena" }, { status: 404 });
  return NextResponse.json(data);
}
