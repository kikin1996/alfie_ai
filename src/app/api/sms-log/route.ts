import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

interface SmsLogEntry {
  type: string;
  text: string;
  sentAt: string;
}

const typeLabels: Record<string, string> = {
  initial: "Úvodní SMS",
  sms2h: "SMS 2h před",
  sms1h: "SMS 1h před",
  post_viewing: "Dotaz po prohlídce",
  reply_in: "Odpověď klienta",
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const projectId = params.get("projectId"); // uuid | "none" | null (= all)
  const from = params.get("from"); // YYYY-MM-DD
  const to = params.get("to"); // YYYY-MM-DD
  const q = (params.get("q") ?? "").trim().toLowerCase();

  const { data: projects } = await supabase
    .from("property_projects")
    .select("id, name")
    .eq("user_id", session.user.id);
  const projectNameById = new Map((projects ?? []).map((p) => [p.id, p.name]));

  let viewingsQuery = supabase
    .from("viewings")
    .select("id, project_id, address, client_name, event_start, sms_log, sms2h_enabled, sms2h_sent, sms1h_enabled, sms1h_sent, initial_sms_sent, post_viewing_sms_sent, status")
    .eq("user_id", session.user.id);

  if (projectId === "none") viewingsQuery = viewingsQuery.is("project_id", null);
  else if (projectId) viewingsQuery = viewingsQuery.eq("project_id", projectId);

  const { data: viewings, error } = await viewingsQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const fromMs = from ? new Date(from).getTime() : null;
  const toMs = to ? new Date(to).getTime() + 24 * 60 * 60 * 1000 : null; // včetně celého "do" dne

  const history: {
    viewingId: string; projectName: string | null; address: string; clientName: string;
    type: string; label: string; text: string; sentAt: string; direction: "in" | "out";
  }[] = [];
  const pending: {
    viewingId: string; projectName: string | null; address: string; clientName: string;
    label: string; eventStart: string;
  }[] = [];

  for (const v of (viewings ?? []) as {
    id: string; project_id: string | null; address: string; client_name: string; event_start: string;
    sms_log: SmsLogEntry[] | null; sms2h_enabled: boolean; sms2h_sent: boolean; sms1h_enabled: boolean;
    sms1h_sent: boolean; initial_sms_sent: boolean; post_viewing_sms_sent: boolean; status: string;
  }[]) {
    const projectName = v.project_id ? projectNameById.get(v.project_id) ?? null : null;
    const clientNameLower = (v.client_name ?? "").toLowerCase();
    if (q && !clientNameLower.includes(q)) continue;

    for (const entry of v.sms_log ?? []) {
      const sentMs = new Date(entry.sentAt).getTime();
      if (fromMs !== null && sentMs < fromMs) continue;
      if (toMs !== null && sentMs >= toMs) continue;
      history.push({
        viewingId: v.id,
        projectName,
        address: v.address,
        clientName: v.client_name,
        type: entry.type,
        label: typeLabels[entry.type] ?? entry.type,
        text: entry.text,
        sentAt: entry.sentAt,
        direction: entry.type === "reply_in" ? "in" : "out",
      });
    }

    // Co ještě nebylo odesláno (jen u budoucích/neprošlých prohlídek)
    if (v.status !== "cancelled") {
      const eventMs = new Date(v.event_start).getTime();
      if (!v.initial_sms_sent) pending.push({ viewingId: v.id, projectName, address: v.address, clientName: v.client_name, label: "Úvodní SMS", eventStart: v.event_start });
      if (v.sms2h_enabled && !v.sms2h_sent && eventMs > now) pending.push({ viewingId: v.id, projectName, address: v.address, clientName: v.client_name, label: "SMS 2h před", eventStart: v.event_start });
      if (v.sms1h_enabled && !v.sms1h_sent && eventMs > now) pending.push({ viewingId: v.id, projectName, address: v.address, clientName: v.client_name, label: "SMS 1h před", eventStart: v.event_start });
      if (!v.post_viewing_sms_sent && eventMs <= now) pending.push({ viewingId: v.id, projectName, address: v.address, clientName: v.client_name, label: "Dotaz po prohlídce", eventStart: v.event_start });
    }
  }

  history.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  pending.sort((a, b) => new Date(a.eventStart).getTime() - new Date(b.eventStart).getTime());

  return NextResponse.json({
    history,
    pending,
    projects: (projects ?? []).map((p) => ({ id: p.id, name: p.name })),
  });
}
