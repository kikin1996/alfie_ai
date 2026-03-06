import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { parseCalendarEvent, eventMatchesTrigger, normalizePhone, isSuspiciousClientName } from "@/lib/calendarParser";
import { geminiParseEvent } from "@/lib/geminiParseEvent";
import { notify } from "@/lib/notify";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

function isMissingPhone(phone: string | null | undefined): boolean {
  if (!phone) return true;
  const p = phone.trim();
  return !p || p === "—" || p === "-";
}

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
    .select("user_id, trigger_keyword, google_refresh_token, whatsapp_phone, whatsapp_apikey, notification_channel, notification_email")
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
  const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 1 měsíc dopředu
  let totalSynced = 0;

  for (const row of settingsList as {
    user_id: string;
    trigger_keyword: string;
    google_refresh_token: string;
    whatsapp_phone?: string;
    whatsapp_apikey?: string;
    notification_channel?: string;
    notification_email?: string;
  }[]) {
    const missingPhoneItems: { address: string; start: string }[] = [];
      const suspiciousNameItems: { address: string; start: string; name: string; reason: string }[] = [];
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
      const keyword = (row.trigger_keyword ?? "#prohlidka").trim();

      for (const ev of items) {
        const start = ev.start?.dateTime ?? ev.start?.date;
        const end = ev.end?.dateTime ?? ev.end?.date;
        if (!start || !ev.id) continue;

        const summary = ev.summary ?? "";
        const description = ev.description ?? "";
        const location = ev.location ?? "";
        let parsed = parseCalendarEvent(
          ev.id,
          summary,
          description,
          location,
          start,
          end ?? start,
          keyword
        );

        if (!parsed && eventMatchesTrigger(summary, description, keyword)) {
          const fullText = [summary, description, location].filter(Boolean).join(" ");
          const gemini = await geminiParseEvent(fullText);
          if (gemini && (gemini.address || gemini.clientPhone)) {
            parsed = {
              id: ev.id,
              summary,
              description,
              location,
              start,
              end: end ?? start,
              address: gemini.address || "—",
              clientPhone: normalizePhone(gemini.clientPhone || "—"),
              clientName: gemini.clientName || "Klient",
            };
          }
        }
        if (!parsed) continue;

        const nameCheck = isSuspiciousClientName(parsed.clientName);
        const clientName = nameCheck.fixedName ?? parsed.clientName;

        await supabaseAdmin.from("viewings").upsert(
          {
            user_id: row.user_id,
            calendar_event_id: ev.id,
            address: parsed.address,
            client_phone: parsed.clientPhone,
            client_name: clientName,
            event_start: parsed.start,
            event_end: parsed.end,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,calendar_event_id" }
        );
        if (isMissingPhone(parsed.clientPhone)) {
          missingPhoneItems.push({ address: parsed.address, start: parsed.start });
        }
        // Upozornit pouze na neopravitelné chyby (bez fixedName)
        if (nameCheck.suspicious && !nameCheck.fixedName) {
          suspiciousNameItems.push({ address: parsed.address, start: parsed.start, name: parsed.clientName, reason: nameCheck.reason ?? "" });
        }
        totalSynced++;
      }

      // Upozornění na chybějící telefonní čísla
      if (missingPhoneItems.length > 0) {
        const list = missingPhoneItems
          .map((v) => `• ${v.address} (${format(new Date(v.start), "d.M. HH:mm", { locale: cs })})`)
          .join("\n");
        await notify(row, `⚠️ Chybí tel. číslo u ${missingPhoneItems.length} prohlídky`, `⚠️ Nové prohlídky bez telefonního čísla:\n${list}\n\nDoplňte číslo klienta v Google Kalendáři nebo prohlídku zrušte.`).catch(() => {});
      }

      // Upozornění na podezřelá jména klientů
      if (suspiciousNameItems.length > 0) {
        const list = suspiciousNameItems
          .map((v) => `• „${v.name}" – ${v.reason}\n  ${v.address} (${format(new Date(v.start), "d.M. HH:mm", { locale: cs })})`)
          .join("\n");
        await notify(row, `⚠️ Zkontrolujte jména klientů (${suspiciousNameItems.length})`, `⚠️ U těchto prohlídek vypadá jméno klienta podezřele – zkontrolujte prosím v kalendáři:\n\n${list}`).catch(() => {});
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
