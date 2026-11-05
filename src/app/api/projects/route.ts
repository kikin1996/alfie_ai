import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: projects, error } = await supabase
    .from("property_projects")
    .select("id, name, address, created_at, updated_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const projectIds = (projects ?? []).map((p) => p.id);
  const countByProject = new Map<string, number>();
  if (projectIds.length > 0) {
    const { data: viewings } = await supabase
      .from("viewings")
      .select("project_id")
      .in("project_id", projectIds)
      .not("status", "in", '("cancelled")');
    for (const v of (viewings ?? []) as { project_id: string }[]) {
      countByProject.set(v.project_id, (countByProject.get(v.project_id) ?? 0) + 1);
    }
  }

  return NextResponse.json({
    projects: (projects ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      leadsCount: countByProject.get(p.id) ?? 0,
    })),
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = (body?.name as string | undefined)?.trim();
  const address = (body?.address as string | undefined)?.trim();
  if (!name || !address) {
    return NextResponse.json({ error: "Zadejte název a adresu" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("property_projects")
    .insert({ user_id: session.user.id, name, address })
    .select("id, name, address, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    project: { id: data.id, name: data.name, address: data.address, createdAt: data.created_at, updatedAt: data.updated_at },
  });
}
