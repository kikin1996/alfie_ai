import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").trim();
}

function isConfirm(body: string): boolean {
  const t = body.trim().toUpperCase();
  return t === "YES" || t === "ANO" || t === "ÁNO" || t === "OK" || t === "1";
}

function isCancel(body: string): boolean {
  const t = body.trim().toUpperCase();
  return t === "NO" || t === "NE" || t === "CANCEL" || t === "ZRUŠIT" || t === "STORNOVAT";
}

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form" }, { status: 400 });
  }

  const from = formData.get("From")?.toString() ?? "";
  const body = formData.get("Body")?.toString() ?? "";
  const fromNormalized = normalizePhone(from);

  if (!fromNormalized || !body) {
    return NextResponse.json({ error: "Missing From or Body" }, { status: 400 });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  const newStatus = isConfirm(body) ? "confirmed" : isCancel(body) ? "cancelled" : null;
  if (!newStatus) {
    return NextResponse.json({ ok: true, message: "Ignored" });
  }

  const { data: viewings } = await supabaseAdmin
    .from("viewings")
    .select("id, client_phone, status")
    .eq("status", "sms_sent")
    .gte("sms_sent_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  const viewing = (viewings ?? []).find(
    (v) => normalizePhone((v as { client_phone: string }).client_phone) === fromNormalized
  );

  if (!viewing) {
    return NextResponse.json({ ok: true, message: "No matching viewing" });
  }

  await supabaseAdmin
    .from("viewings")
    .update({
      status: newStatus,
      confirmed_at: newStatus === "confirmed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", (viewing as { id: string }).id);

  return NextResponse.json({ ok: true, status: newStatus });
}
