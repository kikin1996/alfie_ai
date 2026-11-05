import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendSms } from "@/lib/smsbrana";
import { shortCode, withCode } from "@/lib/shortCode";
import { toVocative } from "@/lib/czechVocative";

const defaultTemplate =
  "Dobrý den, {clientName}, rozhodli jste se ohledně nemovitosti na adrese {address}? Napište prosím ANO (máte zájem) nebo NE (nemáte zájem). Děkujeme, {brokerName}";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  const { data: viewing } = await admin
    .from("viewings")
    .select("id, user_id, address, client_phone, client_name, sms_log")
    .eq("id", params.id)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!viewing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!viewing.client_phone) return NextResponse.json({ error: "Zájemce nemá telefon" }, { status: 400 });

  const { data: appConfig } = await admin
    .from("app_config")
    .select("smsbrana_login, smsbrana_password")
    .eq("id", 1)
    .maybeSingle();

  if (!appConfig?.smsbrana_login || !appConfig?.smsbrana_password) {
    return NextResponse.json({ error: "SMS brána není nakonfigurována" }, { status: 500 });
  }

  const { data: sub } = await admin
    .from("user_subscriptions")
    .select("credits_remaining")
    .eq("user_id", session.user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!sub || sub.credits_remaining < 1) {
    return NextResponse.json({ error: "Nedostatek kreditů" }, { status: 402 });
  }

  const { data: settings } = await admin
    .from("user_settings")
    .select("broker_name")
    .eq("user_id", session.user.id)
    .maybeSingle();

  const code = shortCode(viewing.id);
  const body = withCode(
    defaultTemplate
      .replace(/\{clientName\}/g, toVocative(viewing.client_name || "Klient"))
      .replace(/\{address\}/g, viewing.address)
      .replace(/\{brokerName\}/g, settings?.broker_name ?? ""),
    code
  );

  const sent = await sendSms(appConfig.smsbrana_login, appConfig.smsbrana_password, viewing.client_phone, body).catch(() => false);
  if (!sent) return NextResponse.json({ error: "Odeslání SMS selhalo" }, { status: 500 });

  await admin
    .from("user_subscriptions")
    .update({ credits_remaining: sub.credits_remaining - 1, updated_at: new Date().toISOString() })
    .eq("user_id", session.user.id)
    .eq("status", "active");

  const smsLog = (viewing.sms_log as { type: string; text: string; sentAt: string }[] | null) ?? [];
  await admin
    .from("viewings")
    .update({
      post_viewing_sms_sent: true,
      sms_log: [...smsLog, { type: "post_viewing", text: body, sentAt: new Date().toISOString() }],
      updated_at: new Date().toISOString(),
    })
    .eq("id", viewing.id);

  return NextResponse.json({ ok: true });
}
