import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendSms } from "@/lib/smsbrana";
import { initiateVapiCall } from "@/lib/vapi";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

function fillTemplate(template: string, address: string, time: string, clientName: string, brokerName: string, brokerPhone: string) {
  return template
    .replace(/\{address\}/g, address)
    .replace(/\{time\}/g, time)
    .replace(/\{clientName\}/g, clientName)
    .replace(/\{brokerName\}/g, brokerName)
    .replace(/\{brokerPhone\}/g, brokerPhone);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Auth check
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action } = await request.json().catch(() => ({})) as { action?: string };
  if (action !== "sms" && action !== "vapi") {
    return NextResponse.json({ error: "action must be 'sms' or 'vapi'" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  // Načíst prohlídku – pouze vlastní prohlídky uživatele
  const { data: viewing } = await supabaseAdmin
    .from("viewings")
    .select("id, user_id, address, client_phone, client_name, event_start")
    .eq("id", params.id)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!viewing) {
    return NextResponse.json({ error: "Viewing not found" }, { status: 404 });
  }

  // Načíst app_config
  const { data: appConfig } = await supabaseAdmin
    .from("app_config")
    .select("smsbrana_login, smsbrana_password, vapi_api_key, vapi_assistant_id, vapi_phone_number_id, vapi_minutes_before")
    .eq("id", 1)
    .maybeSingle();

  // Načíst user_settings
  const { data: userSettings } = await supabaseAdmin
    .from("user_settings")
    .select("sms_template, broker_name, broker_phone, agency_name, smsbrana_login, smsbrana_password, vapi_api_key, vapi_assistant_id, vapi_phone_number_id")
    .eq("user_id", viewing.user_id)
    .maybeSingle();

  // Použít user_settings pokud jsou vyplněné, jinak app_config
  const smsLogin = userSettings?.smsbrana_login || appConfig?.smsbrana_login;
  const smsPassword = userSettings?.smsbrana_password || appConfig?.smsbrana_password;
  const vapiApiKey = userSettings?.vapi_api_key || appConfig?.vapi_api_key;
  const vapiAssistantId = userSettings?.vapi_assistant_id || appConfig?.vapi_assistant_id;
  const vapiPhoneNumberId = userSettings?.vapi_phone_number_id || appConfig?.vapi_phone_number_id;

  const eventStart = new Date(viewing.event_start);
  const timeStr = format(eventStart, "HH:mm", { locale: cs });
  const name = viewing.client_name || "Klient";

  if (action === "sms") {
    if (!smsLogin || !smsPassword) {
      return NextResponse.json({ error: "SMSbrána není nakonfigurována v nastavení" }, { status: 400 });
    }
    const template = userSettings?.sms_template ??
      "Připomínáme prohlídku za hodinu: {address} v {time}. Odpovězte ANO/NE.";
    const body = fillTemplate(template, viewing.address, timeStr, name, userSettings?.broker_name ?? "", userSettings?.broker_phone ?? "");
    const testNumber = userSettings?.broker_phone || viewing.client_phone;
    const sent = await sendSms(smsLogin, smsPassword, testNumber, body).catch(() => false);
    if (!sent) return NextResponse.json({ error: "SMS se nepodařilo odeslat" }, { status: 500 });
    return NextResponse.json({ ok: true, message: `SMS odeslána na ${testNumber}` });
  }

  if (action === "vapi") {
    if (!vapiApiKey || !vapiAssistantId || !vapiPhoneNumberId) {
      return NextResponse.json({ error: "VAPI není nakonfigurováno v nastavení" }, { status: 400 });
    }
    const testNumber = userSettings?.broker_phone || viewing.client_phone;
    const callId = await initiateVapiCall({
      apiKey: vapiApiKey,
      assistantId: vapiAssistantId,
      phoneNumberId: vapiPhoneNumberId,
      number: testNumber,
      name,
      eventId: viewing.id,
      address: viewing.address,
      startISO: eventStart.toISOString(),
      brokerName: userSettings?.broker_name ?? "",
      brokerPhone: userSettings?.broker_phone ?? "",
      agencyName: userSettings?.agency_name ?? "",
      minutesBefore: appConfig.vapi_minutes_before ?? 30,
    }).catch(() => null);
    if (!callId) return NextResponse.json({ error: "Hovor se nepodařilo spustit" }, { status: 500 });
    return NextResponse.json({ ok: true, message: `Hovor zahájen (${callId})` });
  }
}
