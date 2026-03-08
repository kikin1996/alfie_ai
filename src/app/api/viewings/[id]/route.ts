import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { google } from "googleapis";

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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  // Načíst prohlídku včetně calendar_event_id
  const { data: viewing } = await admin
    .from("viewings")
    .select("id, calendar_event_id, user_id")
    .eq("id", params.id)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!viewing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Pokusit se smazat událost z Google Kalendáře
  if (viewing.calendar_event_id) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (clientId && clientSecret) {
      const { data: settings } = await admin
        .from("user_settings")
        .select("google_refresh_token")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (settings?.google_refresh_token) {
        try {
          const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, "");
          oauth2Client.setCredentials({ refresh_token: settings.google_refresh_token });
          const calendar = google.calendar({ version: "v3", auth: oauth2Client });
          await calendar.events.delete({
            calendarId: "primary",
            eventId: viewing.calendar_event_id,
          });
        } catch {
          // Pokračovat i při chybě mazání z kalendáře
        }
      }
    }
  }

  // Smazat z DB
  const { error } = await admin
    .from("viewings")
    .delete()
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
