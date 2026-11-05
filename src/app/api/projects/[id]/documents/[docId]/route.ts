import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const BUCKET = "project-documents";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data: doc } = await admin
    .from("project_documents")
    .select("storage_path, user_id, project_id")
    .eq("id", params.docId)
    .eq("project_id", params.id)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: signed, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(doc.storage_path, 60);

  if (error || !signed) return NextResponse.json({ error: error?.message ?? "Nelze vygenerovat odkaz" }, { status: 500 });
  return NextResponse.redirect(signed.signedUrl);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data: doc } = await admin
    .from("project_documents")
    .select("storage_path")
    .eq("id", params.docId)
    .eq("project_id", params.id)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await admin.storage.from(BUCKET).remove([doc.storage_path]);
  const { error } = await admin.from("project_documents").delete().eq("id", params.docId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
