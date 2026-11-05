import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const BUCKET = "project-documents";
const VALID_TYPES = ["purchase_contract", "rental_contract", "other"];

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await supabase
    .from("project_documents")
    .select("id, type, file_name, created_at")
    .eq("project_id", params.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    documents: (data ?? []).map((d) => ({ id: d.id, type: d.type, fileName: d.file_name, createdAt: d.created_at })),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  const { data: project } = await admin
    .from("property_projects")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file") as File | null;
  const type = (form?.get("type") as string | null) ?? "other";
  if (!file) return NextResponse.json({ error: "Chybí soubor" }, { status: 400 });
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: "Neplatný typ dokumentu" }, { status: 400 });

  const storagePath = `${session.user.id}/${params.id}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, await file.arrayBuffer(), { contentType: file.type || "application/octet-stream" });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: doc, error } = await admin
    .from("project_documents")
    .insert({
      project_id: params.id,
      user_id: session.user.id,
      type,
      file_name: file.name,
      storage_path: storagePath,
    })
    .select("id, type, file_name, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ document: { id: doc.id, type: doc.type, fileName: doc.file_name, createdAt: doc.created_at } });
}
