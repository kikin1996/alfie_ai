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

  const { address, clientName, clientPhone, eventStart } = body as {
    address?: string;
    clientName?: string;
    clientPhone?: string;
    eventStart?: string; // ISO nebo "YYYY-MM-DDTHH:mm" z datetime-local inputu
  };

  const admin = getSupabaseAdmin();

  // Ověřit vlastnictví + načíst aktuální hodnoty (pro sloučení a zápis do kalendáře)
  const { data: viewing } = await admin
    .from("viewings")
    .select("id, calendar_event_id, user_id, address, client_name, client_phone, event_start, event_end")
    .eq("id", params.id)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!viewing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Sloučit nové hodnoty se stávajícími
  const finalAddress = address !== undefined ? address : (viewing.address ?? "");
  const finalName = clientName !== undefined ? clientName : (viewing.client_name ?? "");
  const finalPhone = clientPhone !== undefined ? clientPhone : (viewing.client_phone ?? "");

  const updates: Record<string, string> = {};
  if (address !== undefined) updates.address = address;
  if (clientName !== undefined) updates.client_name = clientName;
  if (clientPhone !== undefined) updates.client_phone = clientPhone;

  // Čas – zachovat délku prohlídky (end − start), případně default 30 min
  let finalStart = viewing.event_start as string;
  let finalEnd = (viewing.event_end as string | null) ?? null;
  let timeChanged = false;
  if (eventStart !== undefined) {
    const newStart = new Date(eventStart);
    if (!isNaN(newStart.getTime())) {
      const oldStartMs = new Date(viewing.event_start).getTime();
      const oldEndMs = viewing.event_end ? new Date(viewing.event_end).getTime() : oldStartMs + 30 * 60000;
      const durationMs = Math.max(0, oldEndMs - oldStartMs) || 30 * 60000;
      const newEnd = new Date(newStart.getTime() + durationMs);
      finalStart = newStart.toISOString();
      finalEnd = newEnd.toISOString();
      updates.event_start = finalStart;
      updates.event_end = finalEnd;
      timeChanged = true;
    }
  }

  // Zapsat změny zpět do Google Kalendáře (aby je příští synchronizace nepřepsala)
  let calendarSynced = false;
  if (viewing.calendar_event_id) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (clientId && clientSecret) {
      const { data: settings } = await admin
        .from("user_settings")
        .select("google_refresh_token, trigger_keyword")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (settings?.google_refresh_token) {
        const keyword = (settings.trigger_keyword ?? "prohlídka").trim() || "prohlídka";
        try {
          const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, "");
          oauth2Client.setCredentials({ refresh_token: settings.google_refresh_token });
          const calendar = google.calendar({ version: "v3", auth: oauth2Client });

          // Formát, který parser znovu spolehlivě naparsuje:
          //   summary:     "Jméno, prohlídka"
          //   description: "Tel: +420... \nAdresa: Ulice, Město"
          const patchBody: {
            summary: string;
            description: string;
            start?: { dateTime: string; timeZone: string };
            end?: { dateTime: string; timeZone: string };
          } = {
            summary: `${finalName || "Klient"}, ${keyword}`,
            description: `Tel: ${finalPhone || "—"}\nAdresa: ${finalAddress || "—"}`,
          };
          if (timeChanged) {
            patchBody.start = { dateTime: finalStart, timeZone: "Europe/Prague" };
            patchBody.end = { dateTime: finalEnd ?? finalStart, timeZone: "Europe/Prague" };
          }

          await calendar.events.patch({
            calendarId: "primary",
            eventId: viewing.calendar_event_id,
            requestBody: patchBody,
          });
          calendarSynced = true;
        } catch {
          // Kalendář se nepodařilo aktualizovat – DB změnu i tak uložíme, ale upozorníme
        }
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date().toISOString();
    const { error } = await admin
      .from("viewings")
      .update(updates)
      .eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, calendarSynced, eventStart: finalStart, eventEnd: finalEnd });
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
