import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { initiateVapiCall } from "@/lib/vapi";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.phone) {
    return NextResponse.json({ error: "Chybí telefonní číslo" }, { status: 400 });
  }

  const { apiKey, assistantId, phoneNumberId, phone, clientName, address, startISO } = body as {
    apiKey: string;
    assistantId: string;
    phoneNumberId: string;
    phone: string;
    clientName?: string;
    address?: string;
    startISO?: string;
  };

  if (!apiKey || !assistantId || !phoneNumberId) {
    return NextResponse.json({ error: "Zadejte API Key, Assistant ID a Phone Number ID" }, { status: 400 });
  }

  // Načíst broker/agency name z user_settings
  let brokerName = "";
  let agencyName = "";
  try {
    const admin = getSupabaseAdmin();
    const { data: settings } = await admin
      .from("user_settings")
      .select("broker_name, agency_name")
      .eq("user_id", session.user.id)
      .maybeSingle();
    brokerName = settings?.broker_name ?? "";
    agencyName = settings?.agency_name ?? "";
  } catch {
    // Pokud selže, pokračujeme s prázdnými hodnotami
  }

  try {
    const callId = await initiateVapiCall({
      apiKey,
      assistantId,
      phoneNumberId,
      number: phone,
      name: clientName || "Test Klient",
      eventId: "test",
      address: address || "Testovací adresa 123, Praha",
      startISO: startISO || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      brokerName,
      agencyName,
    });
    return NextResponse.json({ ok: true, callId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Neznámá chyba";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
