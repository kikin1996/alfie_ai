import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("whatsapp_phone, whatsapp_apikey")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!settings?.whatsapp_phone || !settings?.whatsapp_apikey) {
    return NextResponse.json({ error: "WhatsApp není nakonfigurován v Nastavení." }, { status: 400 });
  }

  try {
    await sendWhatsAppMessage(
      settings.whatsapp_phone,
      settings.whatsapp_apikey,
      "✅ Testovací zpráva z Alfie AI – WhatsApp notifikace fungují správně!"
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Chyba odesílání" }, { status: 500 });
  }
}
