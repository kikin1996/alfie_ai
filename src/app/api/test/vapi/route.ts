import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
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

  const { apiKey, assistantId, phoneNumberId, phone } = body as {
    apiKey: string;
    assistantId: string;
    phoneNumberId: string;
    phone: string;
  };

  if (!apiKey || !assistantId || !phoneNumberId) {
    return NextResponse.json({ error: "Zadejte API Key, Assistant ID a Phone Number ID" }, { status: 400 });
  }

  const callId = await initiateVapiCall({
    apiKey,
    assistantId,
    phoneNumberId,
    number: phone,
    name: "Test",
    eventId: "test",
    address: "Testovací adresa",
    startISO: new Date().toISOString(),
  }).catch((e: Error) => {
    throw e;
  });

  return NextResponse.json({ ok: true, callId });
}
