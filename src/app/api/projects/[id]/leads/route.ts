import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { google } from "googleapis";
import type { ExtraNotification } from "@/types";

export async function POST(
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
  const { clientName, clientPhone, clientEmail, message, eventStart } = body as {
    clientName?: string;
    clientPhone?: string;
    clientEmail?: string;
    message?: string;
    eventStart?: string;
  };

  if (!clientPhone?.trim() || !eventStart) {
    return NextResponse.json({ error: "Zadejte telefon a čas prohlídky" }, { status: 400 });
  }
  const startDate = new Date(eventStart);
  if (isNaN(startDate.getTime())) {
    return NextResponse.json({ error: "Neplatný čas prohlídky" }, { status: 400 });
  }
  const endDate = new Date(startDate.getTime() + 30 * 60000);

  const admin = getSupabaseAdmin();

  const { data: project } = await admin
    .from("property_projects")
    .select("id, address")
    .eq("id", params.id)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!project) return NextResponse.json({ error: "Projekt nenalezen" }, { status: 404 });

  const { data: settings } = await admin
    .from("user_settings")
    .select("google_refresh_token, trigger_keyword, default_sms2h_enabled, default_sms1h_enabled, default_vapi_enabled, default_extra_notifications")
    .eq("user_id", session.user.id)
    .maybeSingle();

  // Pokus o zápis do Google Kalendáře (nepovinné – chybějící připojení nebo chyba nic neblokuje)
  let calendarEventId: string | null = null;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (clientId && clientSecret && settings?.google_refresh_token) {
    try {
      const keyword = (settings.trigger_keyword ?? "prohlídka").split(",")[0].trim() || "prohlídka";
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, "");
      oauth2Client.setCredentials({ refresh_token: settings.google_refresh_token });
      const calendar = google.calendar({ version: "v3", auth: oauth2Client });
      const { data: event } = await calendar.events.insert({
        calendarId: "primary",
        requestBody: {
          summary: `${clientName?.trim() || "Klient"}, ${project.address}, ${clientPhone.trim()}, ${keyword}`,
          location: project.address,
          start: { dateTime: startDate.toISOString(), timeZone: "Europe/Prague" },
          end: { dateTime: endDate.toISOString(), timeZone: "Europe/Prague" },
        },
      });
      calendarEventId = event.id ?? null;
    } catch {
      // Zápis do kalendáře selhal – zájemce i tak vytvoříme
    }
  }

  const defaultExtras = (settings?.default_extra_notifications ?? []) as ExtraNotification[];

  const { data: viewing, error } = await admin
    .from("viewings")
    .insert({
      user_id: session.user.id,
      project_id: project.id,
      calendar_event_id: calendarEventId,
      address: project.address,
      client_name: clientName?.trim() || "Klient",
      client_phone: clientPhone.trim(),
      client_email: clientEmail?.trim() || null,
      client_message: message?.trim() || null,
      event_start: startDate.toISOString(),
      event_end: endDate.toISOString(),
      sms2h_enabled: settings?.default_sms2h_enabled ?? true,
      sms1h_enabled: settings?.default_sms1h_enabled ?? true,
      vapi_enabled: settings?.default_vapi_enabled ?? true,
      extra_notifications: defaultExtras.map((n) => ({ ...n, id: crypto.randomUUID(), sent: false, enabled: true })),
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, leadId: viewing.id, calendarSynced: !!calendarEventId });
}
