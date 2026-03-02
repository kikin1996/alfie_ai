import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { sendSms } from "@/lib/smsbrana";

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

  const { login, password, phone } = body as {
    login: string;
    password: string;
    phone: string;
  };

  if (!login || !password) {
    return NextResponse.json({ error: "Zadejte login a heslo SMSbrány" }, { status: 400 });
  }

  const sent = await sendSms(
    login,
    password,
    phone,
    "Alfie AI: testovací SMS – vše funguje správně! ✓"
  ).catch((e: Error) => { throw e; });

  if (!sent) {
    return NextResponse.json({ error: "SMSbrána odmítla zprávu – zkontrolujte přihlašovací údaje." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
