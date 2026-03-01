import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { parseCalendarEvent } from "@/lib/calendarParser";

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

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET" },
      { status: 500 }
    );
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch {
    return NextResponse.json(
      { error: "Supabase admin not configured (SUPABASE_SERVICE_ROLE_KEY)" },
      { status: 500 }
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, "");
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const { data: settingsList } = await supabaseAdmin
    .from("user_settings")
    .select("user_id, trigger_keyword, google_refresh_token")
    .not("google_refresh_token", "is", null);

  if (!settingsList?.length) {
    return NextResponse.json({
      ok: true,
      message: "No users with Google Calendar connected",
      synced: 0,
    });
  }

  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(); // +90 dní
  let totalSynced = 0;

  for (const row of settingsList as {
    user_id: string;
    trigger_keyword: string;
    google_refresh_token: string;
  }[]) {
    try {
      oauth2Client.setCredentials({ refresh_token: row.google_refresh_token });
      const { data: events } = await calendar.events.list({
        calendarId: "primary",
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
      });

      const items = events.items ?? [];
      const keyword = row.trigger_keyword;

      for (const ev of items) {
        const start = ev.start?.dateTime ?? ev.start?.date;
        const end = ev.end?.dateTime ?? ev.end?.date;
        if (!start || !ev.id) continue;

        const parsed = parseCalendarEvent(
          ev.id,
          ev.summary ?? "",
          ev.description ?? "",
          ev.location ?? "",
          start,
          end ?? start,
          keyword
        );
        if (!parsed) continue;

        await supabaseAdmin.from("viewings").upsert(
          {
            user_id: row.user_id,
            calendar_event_id: ev.id,
            address: parsed.address,
            client_phone: parsed.clientPhone,
            client_name: parsed.clientName,
            event_start: parsed.start,
            event_end: parsed.end,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,calendar_event_id" }
        );
        totalSynced++;
      }
    } catch (err) {
      console.error(`Sync calendar for user ${row.user_id}:`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    synced: totalSynced,
    users: settingsList.length,
  });
}
