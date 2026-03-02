import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import type { ExtraNotification } from "@/types";

type BuiltInField = "sms2h_enabled" | "sms1h_enabled" | "vapi_enabled";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const viewingId = params.id;

  // Ověřit vlastnictví
  const { data: existing } = await supabase
    .from("viewings")
    .select("id")
    .eq("id", viewingId)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const validFields: BuiltInField[] = ["sms2h_enabled", "sms1h_enabled", "vapi_enabled"];

  // Varianta 1: toggle vestavěného příznaku
  if ("field" in body && "value" in body) {
    const { field, value } = body as { field: BuiltInField; value: boolean };
    if (!validFields.includes(field) || typeof value !== "boolean") {
      return NextResponse.json({ error: "Invalid field or value" }, { status: 400 });
    }
    await supabase
      .from("viewings")
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq("id", viewingId);
    return NextResponse.json({ ok: true });
  }

  // Varianta 2: nahradit pole extra notifikací
  if ("extraNotifications" in body) {
    const extras = body.extraNotifications as ExtraNotification[];
    if (!Array.isArray(extras)) {
      return NextResponse.json({ error: "extraNotifications must be an array" }, { status: 400 });
    }
    await supabase
      .from("viewings")
      .update({ extra_notifications: extras, updated_at: new Date().toISOString() })
      .eq("id", viewingId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
}
