import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { notify } from "@/lib/notify";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

function checkCronAuth(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function isMissingPhone(phone: string | null | undefined): boolean {
  if (!phone) return true;
  const p = phone.trim();
  return !p || p === "—" || p === "-";
}

export async function GET(request: NextRequest) {
  if (!checkCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  // Načíst všechny nadcházející prohlídky s chybějícím telefonem
  const { data: viewings } = await supabaseAdmin
    .from("viewings")
    .select("id, user_id, address, client_phone, event_start")
    .gte("event_start", new Date().toISOString())
    .not("status", "eq", "cancelled");

  const missing = (viewings ?? []).filter((v) => isMissingPhone(v.client_phone));

  if (!missing.length) {
    return NextResponse.json({ ok: true, notified: 0 });
  }

  // Seskupit prohlídky podle user_id
  const byUser = new Map<string, typeof missing>();
  for (const v of missing) {
    if (!byUser.has(v.user_id)) byUser.set(v.user_id, []);
    byUser.get(v.user_id)!.push(v);
  }

  // Načíst nastavení notifikací pro tyto uživatele
  const userIds = [...byUser.keys()];
  const { data: settingsList } = await supabaseAdmin
    .from("user_settings")
    .select("user_id, whatsapp_phone, whatsapp_apikey, notification_channel, notification_email")
    .in("user_id", userIds);

  const settingsByUser = new Map((settingsList ?? []).map((s) => [s.user_id, s]));

  let notified = 0;
  for (const [userId, viewingList] of byUser) {
    const settings = settingsByUser.get(userId);
    if (!settings) continue;

    const list = viewingList
      .map((v) => `• ${v.address} (${format(new Date(v.event_start), "EEEE d.M. HH:mm", { locale: cs })})`)
      .join("\n");

    await notify(
      settings,
      `⚠️ ${viewingList.length} prohlídka bez tel. čísla`,
      `⚠️ Připomínka: tyto prohlídky stále nemají telefonní číslo klienta:\n\n${list}\n\nDoplňte číslo v Google Kalendáři nebo prohlídku zrušte.`
    ).catch(() => {});
    notified++;
  }

  return NextResponse.json({ ok: true, notified, missing: missing.length });
}
