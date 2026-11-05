import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { google } from "googleapis";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: project } = await supabase
    .from("property_projects")
    .select("id, name, address, created_at, updated_at")
    .eq("id", params.id)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: viewings } = await supabase
    .from("viewings")
    .select("id, calendar_event_id, address, client_phone, client_name, client_email, client_message, event_start, event_end, status, sms2h_sent, sms1h_sent, vapi_called, initial_sms_sent, created_at")
    .eq("project_id", params.id)
    .order("event_start", { ascending: true });

  return NextResponse.json({
    project: { id: project.id, name: project.name, address: project.address, createdAt: project.created_at, updatedAt: project.updated_at },
    leads: (viewings ?? []).map((v) => ({
      id: v.id,
      calendarEventId: v.calendar_event_id,
      address: v.address,
      clientName: v.client_name,
      clientPhone: v.client_phone,
      clientEmail: v.client_email,
      clientMessage: v.client_message,
      eventStart: v.event_start,
      eventEnd: v.event_end,
      status: v.status,
      sms2hSent: v.sms2h_sent,
      sms1hSent: v.sms1h_sent,
      vapiCalled: v.vapi_called,
      initialSmsSent: v.initial_sms_sent,
      createdAt: v.created_at,
    })),
  });
}

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
  const { name, address } = body as { name?: string; address?: string };

  const updates: Record<string, string> = {};
  if (name !== undefined) updates.name = name.trim();
  if (address !== undefined) updates.address = address.trim();
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("property_projects")
    .update(updates)
    .eq("id", params.id)
    .eq("user_id", session.user.id)
    .select("id, name, address, updated_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, project: data });
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

  const { data: project } = await admin
    .from("property_projects")
    .select("id, user_id")
    .eq("id", params.id)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: viewings } = await admin
    .from("viewings")
    .select("calendar_event_id")
    .eq("project_id", params.id)
    .not("calendar_event_id", "is", null);

  const calendarEventIds = (viewings ?? []).map((v) => v.calendar_event_id as string).filter(Boolean);
  if (calendarEventIds.length > 0) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const { data: settings } = await admin
      .from("user_settings")
      .select("google_refresh_token")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (clientId && clientSecret && settings?.google_refresh_token) {
      try {
        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, "");
        oauth2Client.setCredentials({ refresh_token: settings.google_refresh_token });
        const calendar = google.calendar({ version: "v3", auth: oauth2Client });
        for (const eventId of calendarEventIds) {
          await calendar.events.delete({ calendarId: "primary", eventId }).catch(() => {});
        }
      } catch {
        // Pokračovat i při chybě mazání z kalendáře
      }
    }
  }

  // cascade smaže i viewings navázané na project_id
  const { error } = await admin.from("property_projects").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
