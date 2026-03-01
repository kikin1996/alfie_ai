import { NextRequest, NextResponse } from "next/server";
import Twilio from "twilio";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

function checkCronAuth(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

function fillTemplate(
  template: string,
  address: string,
  time: string,
  clientName: string
): string {
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
    return NextResponse.json(
      { error: "Supabase admin not configured" },
      { status: 500 }
    );
  }

  const { data: pendingViewings } = await supabaseAdmin
    .from("viewings")
    .select("id, user_id, address, client_phone, client_name, event_start")
    .eq("status", "pending");

  if (!pendingViewings?.length) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const userIds = [...new Set(pendingViewings.map((v) => v.user_id))];
  const { data: settingsList } = await supabaseAdmin
    .from("user_settings")
    .select("user_id, twilio_account_sid, twilio_auth_token, twilio_phone_number, sms_template, sms_hours_before")
    .in("user_id", userIds);

  const settingsByUser = new Map(
    (settingsList ?? []).map((s) => [s.user_id, s])
  );

  const now = new Date();
  let sent = 0;

  for (const v of pendingViewings as {
    id: string;
    user_id: string;
    address: string;
    client_phone: string;
    client_name: string;
    event_start: string;
  }[]) {
    const settings = settingsByUser.get(v.user_id);
    if (
      !settings?.twilio_account_sid ||
      !settings?.twilio_auth_token ||
      !settings?.twilio_phone_number
    ) {
      continue;
    }

    const eventStart = new Date(v.event_start);
    const hoursBefore = (settings as { sms_hours_before?: number }).sms_hours_before ?? 2;
    const windowStart = new Date(eventStart.getTime() - hoursBefore * 60 * 60 * 1000);
    const windowEnd = new Date(windowStart.getTime() + 30 * 60 * 1000); // 30 min window to send

    if (now < windowStart || now > windowEnd) continue;

    const template =
      (settings as { sms_template?: string }).sms_template ??
      "Dobrý den, potvrzujeme prohlídku na adrese {address} dnes v {time}. Odpovězte YES pro potvrzení.";
    const timeStr = format(eventStart, "HH:mm", { locale: cs });
    const body = fillTemplate(
      template,
      v.address,
      timeStr,
      v.client_name || "Klient"
    );

    try {
      const client = Twilio(
        settings.twilio_account_sid,
        settings.twilio_auth_token
      );
      await client.messages.create({
        body,
        from: settings.twilio_phone_number,
        to: v.client_phone.replace(/\s/g, ""),
      });

      await supabaseAdmin
        .from("viewings")
        .update({
          status: "sms_sent",
          sms_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", v.id);
      sent++;
    } catch (err) {
      console.error(`Send SMS for viewing ${v.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, sent });
}
