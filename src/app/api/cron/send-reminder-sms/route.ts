import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendSms } from "@/lib/smsbrana";
import { notify } from "@/lib/notify";
import { initiateVapiCall } from "@/lib/vapi";
import { shortCode, withCode } from "@/lib/shortCode";
import type { ExtraNotification } from "@/types";

function checkCronAuth(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // TEST: bez secretu propustit lokálně
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

/** Převede "HH:MM" na hodiny jako desetinné číslo (18:30 → 18.5) */
function parseHour(t: string): number {
  const [h, m] = (t || "00:00").split(":").map(Number);
  return h + (m || 0) / 60;
}

/**
 * Vrátí efektivní čas odeslání notifikace s ohledem na mrtvou zónu.
 * Pokud přirozený čas (event_start − offsetMin) padá mimo [startHour, endHour),
 * posune se na předchozí den v endHour − offsetMin.
 */
function getEffectiveTime(eventStart: Date, offsetMinutes: number, startHour: number, endHour: number): Date {
  const natural = new Date(eventStart.getTime() - offsetMinutes * 60000);
  const h = natural.getHours() + natural.getMinutes() / 60;

  if (h < startHour || h >= endHour) {
    const effectiveMs = Math.max(0, endHour * 60 - offsetMinutes) * 60000;
    const base = new Date(h < startHour
      ? new Date(eventStart).setDate(eventStart.getDate() - 1)
      : eventStart.getTime());
    base.setHours(0, 0, 0, 0);
    return new Date(base.getTime() + effectiveMs);
  }

  return natural;
}

/** true pokud je |now − effectiveTime| ≤ windowMinutes */
function isInWindow(now: Date, effectiveTime: Date, windowMinutes: number): boolean {
  return Math.abs(now.getTime() - effectiveTime.getTime()) / 60000 <= windowMinutes;
}

function fillTemplate(template: string, address: string, time: string, clientName: string, brokerName: string, brokerPhone: string, agencyName: string = ""): string {
  return template
    .replace(/\{address\}/g, address)
    .replace(/\{time\}/g, time)
    .replace(/\{clientName\}/g, clientName)
    .replace(/\{brokerName\}/g, brokerName)
    .replace(/\{brokerPhone\}/g, brokerPhone)
    .replace(/\{agencyName\}/g, agencyName);
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

  const { data: viewings } = await supabaseAdmin
    .from("viewings")
    .select("id, user_id, address, client_phone, client_name, event_start, sms2h_sent, sms1h_sent, vapi_called, sms2h_enabled, sms1h_enabled, vapi_enabled, extra_notifications, status")
    .not("status", "in", '("confirmed","cancelled")')
    .gte("event_start", new Date().toISOString());

  if (!viewings?.length) {
    return NextResponse.json({ ok: true, actions: 0 });
  }

  // Načíst Telegram + SMS šablonu per-user
  // POZOR: jen sloupce, které jistě existují – ať dotaz nikdy neselže a nezablokuje notifikace.
  const userIds = [...new Set(viewings.map((v) => v.user_id))];
  const { data: settingsList } = await supabaseAdmin
    .from("user_settings")
    .select("user_id, sms_template, notification_time_from, notification_time_to, whatsapp_phone, whatsapp_apikey, notification_channel, notification_email, broker_name, broker_phone, agency_name")
    .in("user_id", userIds);

  const settingsByUser = new Map((settingsList ?? []).map((s) => [s.user_id, s]));

  // Přepínač časového okna – samostatný tolerantní dotaz (sloupec nemusí existovat,
  // pokud neproběhla migrace 016). Když chybí/selže → default true (okno zapnuté).
  const windowByUser = new Map<string, boolean>();
  {
    const { data: winList } = await supabaseAdmin
      .from("user_settings")
      .select("user_id, notification_window_enabled")
      .in("user_id", userIds);
    for (const w of (winList ?? []) as { user_id: string; notification_window_enabled: boolean | null }[]) {
      windowByUser.set(w.user_id, w.notification_window_enabled ?? true);
    }
  }

  // Načíst předplatná uživatelů
  const { data: subscriptionsList } = await supabaseAdmin
    .from("user_subscriptions")
    .select("user_id, credits_remaining, status")
    .in("user_id", userIds)
    .eq("status", "active");

  const subsByUser = new Map((subscriptionsList ?? []).map((s) => [s.user_id, s]));

  // Odpočet kreditů (vrátí true pokud se podařilo)
  const deductCredits = async (userId: string, amount: number): Promise<boolean> => {
    const sub = subsByUser.get(userId);
    if (!sub || sub.credits_remaining < amount) return false;
    const newCredits = sub.credits_remaining - amount;
    const { error } = await supabaseAdmin
      .from("user_subscriptions")
      .update({ credits_remaining: newCredits, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("status", "active")
      .gte("credits_remaining", amount);
    if (!error) sub.credits_remaining = newCredits;
    return !error;
  };

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
    const timeStr = eventStart.toLocaleTimeString("cs-CZ", { timeZone: "Europe/Prague", hour: "2-digit", minute: "2-digit" });
    const name = v.client_name || "Klient";
    const code = shortCode(v.id);
    const agencyName = userSettings?.agency_name ?? "";
    const template = userSettings?.sms_template ??
      "Dobrý den, prosím o potvrzení dnešní prohlídky na adrese {address} v {time}.";
    const brokerName = userSettings?.broker_name ?? "";
    const brokerPhone = userSettings?.broker_phone ?? "";

    const startHour = parseHour(userSettings?.notification_time_from ?? "08:00");
    const endHour = parseHour(userSettings?.notification_time_to ?? "18:00");
    // Když je časové okno vypnuté, notifikace jdou v přirozeném čase (bez mrtvé zóny).
    const windowEnabled = windowByUser.get(v.user_id) ?? true;
    const effTime = (offsetMin: number): Date =>
      windowEnabled
        ? getEffectiveTime(eventStart, offsetMin, startHour, endHour)
        : new Date(eventStart.getTime() - offsetMin * 60000);

    // Okno 2h — 1 kredit
    if (!v.sms2h_sent && v.sms2h_enabled && isInWindow(now, effTime(120), 7) && hasSms) {
      const hasCredits = await deductCredits(v.user_id, 1);
      if (hasCredits) {
        const body = withCode(fillTemplate(template, v.address, timeStr, name, brokerName, brokerPhone, agencyName), code);
        const sent = await sendSms(appConfig.smsbrana_login, appConfig.smsbrana_password, v.client_phone, body).catch(() => false);
        if (sent) {
          await supabaseAdmin.from("viewings").update({ sms2h_sent: true, status: "sms_sent", sms_sent_at: now.toISOString(), updated_at: now.toISOString() }).eq("id", v.id);
          if (userSettings) await notify(userSettings, `SMS 2h odeslána – ${name}`, `📨 SMS 2h odeslána: ${name} (${v.client_phone})\n🔖 ID: ${code}\n📍 ${v.address}\n🕐 ${timeStr}`);
          actions++;
        }
      } else if (userSettings) {
        await notify(userSettings, "⚠️ Nedostatek kreditů", `⚠️ SMS pro ${name} (${v.address}) nebyla odeslána – nedostatek kreditů. Dobijte předplatné.`).catch(() => {});
      }
    }

    // Okno 1h — 1 kredit
    if (!v.sms1h_sent && v.sms1h_enabled && isInWindow(now, effTime(60), 7) && hasSms) {
      const hasCredits = await deductCredits(v.user_id, 1);
      if (hasCredits) {
        const body = withCode(fillTemplate(template, v.address, timeStr, name, brokerName, brokerPhone, agencyName), code);
        const sent = await sendSms(appConfig.smsbrana_login, appConfig.smsbrana_password, v.client_phone, body).catch(() => false);
        if (sent) {
          await supabaseAdmin.from("viewings").update({ sms1h_sent: true, updated_at: now.toISOString() }).eq("id", v.id);
          if (userSettings) await notify(userSettings, `SMS 1h odeslána – ${name}`, `📨 SMS 1h odeslána: ${name} (${v.client_phone})\n🔖 ID: ${code}\n📍 ${v.address}\n🕐 ${timeStr}`);
          actions++;
        }
      } else if (userSettings) {
        await notify(userSettings, "⚠️ Nedostatek kreditů", `⚠️ SMS pro ${name} (${v.address}) nebyla odeslána – nedostatek kreditů. Dobijte předplatné.`).catch(() => {});
      }
    }

    // Okno VAPI hovoru — 5 kreditů
    if (!v.vapi_called && v.vapi_enabled && isInWindow(now, effTime(vapiMinutesBefore), 7) && hasVapi) {
      const hasCredits = await deductCredits(v.user_id, 5);
      if (hasCredits) {
        const callId = await initiateVapiCall({ apiKey: appConfig.vapi_api_key, assistantId: appConfig.vapi_assistant_id, phoneNumberId: appConfig.vapi_phone_number_id, number: v.client_phone, name, eventId: v.id, address: v.address, startISO: eventStart.toISOString(), brokerName, brokerPhone, agencyName: userSettings?.agency_name ?? "", minutesBefore: vapiMinutesBefore }).catch(() => null);
        if (callId) {
          await supabaseAdmin.from("viewings").update({ vapi_called: true, vapi_call_id: callId, updated_at: now.toISOString() }).eq("id", v.id);
          if (userSettings) await notify(userSettings, `VAPI hovor spuštěn – ${name}`, `📞 VAPI hovor spuštěn: ${name} (${v.client_phone})\n🔖 ID: ${code}\n📍 ${v.address}\n🕐 ${timeStr}`);
          actions++;
        }
      } else if (userSettings) {
        await notify(userSettings, "⚠️ Nedostatek kreditů", `⚠️ Hovor pro ${name} (${v.address}) nebyl zahájen – nedostatek kreditů (potřeba 5). Dobijte předplatné.`).catch(() => {});
      }
    }

    // Extra notifikace
    const extras: ExtraNotification[] = v.extra_notifications ?? [];
    let extrasUpdated = false;
    const updatedExtras = [...extras];

    for (let i = 0; i < updatedExtras.length; i++) {
      const notif = updatedExtras[i];
      if (notif.sent || !notif.enabled) continue;

      if (!isInWindow(now, effTime(notif.minutesBefore), 7)) continue;

      if (notif.type === "sms" && hasSms) {
        const hasCredits = await deductCredits(v.user_id, 1);
        if (hasCredits) {
          const body = withCode(fillTemplate(template, v.address, timeStr, name, brokerName, brokerPhone, agencyName), code);
          const sent = await sendSms(appConfig.smsbrana_login, appConfig.smsbrana_password, v.client_phone, body).catch(() => false);
          if (sent) {
            updatedExtras[i] = { ...notif, sent: true };
            extrasUpdated = true;
            if (userSettings) await notify(userSettings, `${notif.label} odeslána – ${name}`, `📨 ${notif.label} odeslána: ${name} (${v.client_phone})\n🔖 ID: ${code}\n📍 ${v.address}\n🕐 ${timeStr}`);
            actions++;
          }
        }
      } else if (notif.type === "vapi" && hasVapi) {
        const hasCredits = await deductCredits(v.user_id, 5);
        if (hasCredits) {
          const callId = await initiateVapiCall({ apiKey: appConfig.vapi_api_key, assistantId: appConfig.vapi_assistant_id, phoneNumberId: appConfig.vapi_phone_number_id, number: v.client_phone, name, eventId: v.id, address: v.address, startISO: eventStart.toISOString(), brokerName, brokerPhone, agencyName: userSettings?.agency_name ?? "", minutesBefore: notif.minutesBefore }).catch(() => null);
          if (callId) {
            await supabaseAdmin.from("viewings").update({ vapi_call_id: callId }).eq("id", v.id);
            updatedExtras[i] = { ...notif, sent: true };
            extrasUpdated = true;
            if (userSettings) await notify(userSettings, `${notif.label} hovor spuštěn – ${name}`, `📞 ${notif.label} hovor spuštěn: ${name} (${v.client_phone})\n🔖 ID: ${code}\n📍 ${v.address}\n🕐 ${timeStr}`);
            actions++;
          }
        }
      }
    }

    if (extrasUpdated) {
      await supabaseAdmin.from("viewings").update({ extra_notifications: updatedExtras, updated_at: now.toISOString() }).eq("id", v.id);
    }
  }

  return NextResponse.json({ ok: true, actions });
}
