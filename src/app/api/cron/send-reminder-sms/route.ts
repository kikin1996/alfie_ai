import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendSms } from "@/lib/smsbrana";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { initiateVapiCall } from "@/lib/vapi";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import type { ExtraNotification } from "@/types";

function checkCronAuth(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

function fillTemplate(template: string, address: string, time: string, clientName: string): string {
  return template
    .replace(/\{address\}/g, address)
    .replace(/\{time\}/g, time)
    .replace(/\{clientName\}/g, clientName);
}

export async function GET(request: NextRequest) {
  if (!checkCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
  }

  // Načíst globální konfiguraci (SMSbrána + VAPI)
  const { data: appConfig } = await supabaseAdmin
    .from("app_config")
    .select("smsbrana_login, smsbrana_password, vapi_api_key, vapi_assistant_id, vapi_phone_number_id, vapi_minutes_before")
    .eq("id", 1)
    .maybeSingle();

  const hasSms = appConfig?.smsbrana_login && appConfig?.smsbrana_password;
  const hasVapi = appConfig?.vapi_api_key && appConfig?.vapi_assistant_id && appConfig?.vapi_phone_number_id;
  const vapiMinutesBefore: number = appConfig?.vapi_minutes_before ?? 30;
  const vapiWindowLow = vapiMinutesBefore - 10;
  const vapiWindowHigh = vapiMinutesBefore + 10;

  const { data: viewings } = await supabaseAdmin
    .from("viewings")
    .select("id, user_id, address, client_phone, client_name, event_start, sms2h_sent, sms1h_sent, vapi_called, sms2h_enabled, sms1h_enabled, vapi_enabled, extra_notifications, status")
    .not("status", "in", '("confirmed","cancelled")')
    .gte("event_start", new Date().toISOString());

  if (!viewings?.length) {
    return NextResponse.json({ ok: true, actions: 0 });
  }

  // Načíst Telegram + SMS šablonu per-user
  const userIds = [...new Set(viewings.map((v) => v.user_id))];
  const { data: settingsList } = await supabaseAdmin
    .from("user_settings")
    .select("user_id, sms_template, whatsapp_phone, whatsapp_apikey, broker_name, agency_name")
    .in("user_id", userIds);

  const settingsByUser = new Map((settingsList ?? []).map((s) => [s.user_id, s]));

  const now = new Date();
  let actions = 0;

  for (const v of viewings as {
    id: string; user_id: string; address: string; client_phone: string;
    client_name: string; event_start: string; sms2h_sent: boolean;
    sms1h_sent: boolean; vapi_called: boolean; sms2h_enabled: boolean;
    sms1h_enabled: boolean; vapi_enabled: boolean;
    extra_notifications: ExtraNotification[]; status: string;
  }[]) {
    const userSettings = settingsByUser.get(v.user_id);

    const eventStart = new Date(v.event_start);
    const diffMinutes = (eventStart.getTime() - now.getTime()) / 60000;
    const timeStr = format(eventStart, "HH:mm", { locale: cs });
    const name = v.client_name || "Klient";
    const template = userSettings?.sms_template ??
      "Dobrý den, potvrzujeme prohlídku na adrese {address} dnes v {time}. Odpovězte ANO pro potvrzení nebo NE pro zrušení.";

    const hasWa = userSettings?.whatsapp_phone && userSettings?.whatsapp_apikey;

    // Okno 2h (100–140 min)
    if (!v.sms2h_sent && v.sms2h_enabled && diffMinutes >= 100 && diffMinutes <= 140 && hasSms) {
      const body = fillTemplate(template, v.address, timeStr, name);
      const sent = await sendSms(appConfig.smsbrana_login, appConfig.smsbrana_password, v.client_phone, body).catch(() => false);
      if (sent) {
        await supabaseAdmin.from("viewings").update({ sms2h_sent: true, status: "sms_sent", sms_sent_at: now.toISOString(), updated_at: now.toISOString() }).eq("id", v.id);
        if (hasWa) await sendWhatsAppMessage(userSettings.whatsapp_phone, userSettings.whatsapp_apikey, `📨 SMS 2h odeslána: ${name} (${v.client_phone})\n📍 ${v.address}\n🕐 ${timeStr}`).catch(() => {});
        actions++;
      }
    }

    // Okno 1h (40–80 min)
    if (!v.sms1h_sent && v.sms1h_enabled && diffMinutes >= 40 && diffMinutes <= 80 && hasSms) {
      const body = fillTemplate("Připomínáme prohlídku za hodinu: {address} v {time}. Odpovězte ANO/NE.", v.address, timeStr, name);
      const sent = await sendSms(appConfig.smsbrana_login, appConfig.smsbrana_password, v.client_phone, body).catch(() => false);
      if (sent) {
        await supabaseAdmin.from("viewings").update({ sms1h_sent: true, updated_at: now.toISOString() }).eq("id", v.id);
        if (hasWa) await sendWhatsAppMessage(userSettings.whatsapp_phone, userSettings.whatsapp_apikey, `📨 SMS 1h odeslána: ${name} (${v.client_phone})\n📍 ${v.address}\n🕐 ${timeStr}`).catch(() => {});
        actions++;
      }
    }

    // Okno VAPI hovoru (vapiMinutesBefore ± 10 min)
    if (!v.vapi_called && v.vapi_enabled && diffMinutes >= vapiWindowLow && diffMinutes <= vapiWindowHigh && hasVapi) {
      const callId = await initiateVapiCall({ apiKey: appConfig.vapi_api_key, assistantId: appConfig.vapi_assistant_id, phoneNumberId: appConfig.vapi_phone_number_id, number: v.client_phone, name, eventId: v.id, address: v.address, startISO: eventStart.toISOString(), brokerName: userSettings?.broker_name ?? "", agencyName: userSettings?.agency_name ?? "", minutesBefore: vapiMinutesBefore }).catch(() => null);
      if (callId) {
        await supabaseAdmin.from("viewings").update({ vapi_called: true, updated_at: now.toISOString() }).eq("id", v.id);
        if (hasWa) await sendWhatsAppMessage(userSettings.whatsapp_phone, userSettings.whatsapp_apikey, `📞 VAPI hovor spuštěn: ${name} (${v.client_phone})\n📍 ${v.address}\n🕐 ${timeStr}`).catch(() => {});
        actions++;
      }
    }

    // Extra notifikace
    const extras: ExtraNotification[] = v.extra_notifications ?? [];
    let extrasUpdated = false;
    const updatedExtras = [...extras];

    for (let i = 0; i < updatedExtras.length; i++) {
      const notif = updatedExtras[i];
      if (notif.sent || !notif.enabled) continue;

      const windowLow = notif.minutesBefore - 20;
      const windowHigh = notif.minutesBefore + 20;
      if (diffMinutes < windowLow || diffMinutes > windowHigh) continue;

      if (notif.type === "sms" && hasSms) {
        const body = fillTemplate(template, v.address, timeStr, name);
        const sent = await sendSms(appConfig.smsbrana_login, appConfig.smsbrana_password, v.client_phone, body).catch(() => false);
        if (sent) {
          updatedExtras[i] = { ...notif, sent: true };
          extrasUpdated = true;
          if (hasWa) await sendWhatsAppMessage(userSettings.whatsapp_phone, userSettings.whatsapp_apikey, `📨 ${notif.label} odeslána: ${name} (${v.client_phone})\n📍 ${v.address}\n🕐 ${timeStr}`).catch(() => {});
          actions++;
        }
      } else if (notif.type === "vapi" && hasVapi) {
        const callId = await initiateVapiCall({ apiKey: appConfig.vapi_api_key, assistantId: appConfig.vapi_assistant_id, phoneNumberId: appConfig.vapi_phone_number_id, number: v.client_phone, name, eventId: v.id, address: v.address, startISO: eventStart.toISOString(), brokerName: userSettings?.broker_name ?? "", agencyName: userSettings?.agency_name ?? "", minutesBefore: notif.minutesBefore }).catch(() => null);
        if (callId) {
          updatedExtras[i] = { ...notif, sent: true };
          extrasUpdated = true;
          if (hasWa) await sendWhatsAppMessage(userSettings.whatsapp_phone, userSettings.whatsapp_apikey, `📞 ${notif.label} hovor spuštěn: ${name} (${v.client_phone})\n📍 ${v.address}\n🕐 ${timeStr}`).catch(() => {});
          actions++;
        }
      }
    }

    if (extrasUpdated) {
      await supabaseAdmin.from("viewings").update({ extra_notifications: updatedExtras, updated_at: now.toISOString() }).eq("id", v.id);
    }
  }

  return NextResponse.json({ ok: true, actions });
}
