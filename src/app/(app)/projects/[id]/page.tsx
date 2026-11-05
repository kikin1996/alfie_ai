"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Phone, Mail, MessageSquare, Calendar, Trash2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type LeadStatus = "pending" | "sms_sent" | "confirmed" | "cancelled";

interface Lead {
  id: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string | null;
  clientMessage?: string | null;
  eventStart: string;
  status: LeadStatus;
  sms2hSent: boolean;
  sms1hSent: boolean;
  initialSmsSent: boolean;
  calendarEventId?: string | null;
}

interface ProjectDetail {
  id: string;
  name: string;
  address: string;
}

const statusLabels: Record<LeadStatus, string> = {
  pending: "Čeká",
  sms_sent: "SMS odeslána",
  confirmed: "Potvrzeno",
  cancelled: "Zrušeno",
};

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [message, setMessage] = useState("");
  const [eventStart, setEventStart] = useState("");

  const load = async () => {
    const res = await fetch(`/api/projects/${id}`);
    const data = await res.json().catch(() => null);
    if (!res.ok) { setError(data?.error ?? "Projekt nenalezen"); return; }
    setProject(data.project);
    setLeads(data.leads);
  };

  useEffect(() => {
    if (!authLoading && user && id) load();
  }, [authLoading, user, id]);

  const createLead = async () => {
    if (!clientPhone.trim() || !eventStart) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName, clientPhone, clientEmail, message,
          eventStart: new Date(eventStart).toISOString(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError(data?.error ?? "Nepodařilo se vytvořit zájemce"); return; }
      setClientName(""); setClientPhone(""); setClientEmail(""); setMessage(""); setEventStart("");
      setAdding(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const cancelLead = async (leadId: string) => {
    await fetch(`/api/viewings/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    await load();
  };

  if (authLoading || leads === null || !project) {
    if (error) return <p className="text-sm text-destructive">{error}</p>;
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <Button size="sm" variant="ghost" onClick={() => router.push("/projects")}>
        <ArrowLeft className="h-4 w-4 mr-1.5" /> Zpět na projekty
      </Button>

      <div>
        <h1 className="font-display text-2xl font-bold">{project.name}</h1>
        <p className="text-sm text-muted-foreground">{project.address}</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Zájemci ({leads.length})</h2>
        <Button size="sm" onClick={() => setAdding((v) => !v)}>
          <Plus className="h-4 w-4 mr-1.5" /> Nový zájemce
        </Button>
      </div>

      {adding && (
        <Card>
          <CardHeader><CardTitle className="text-base">Nový zájemce</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Jméno zájemce" value={clientName} onChange={(e) => setClientName(e.target.value)} />
            <Input placeholder="Telefon" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
            <Input placeholder="E-mail (nepovinné)" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
            <Textarea placeholder="Zpráva / poznámka od zájemce (nepovinné)" value={message} onChange={(e) => setMessage(e.target.value)} />
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Datum a čas prohlídky</label>
              <Input type="datetime-local" value={eventStart} onChange={(e) => setEventStart(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={saving} onClick={createLead}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Vytvořit a naplánovat SMS"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Zrušit</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {leads.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">Zatím žádní zájemci. Přidej prvního tlačítkem výše.</p>
      )}

      <div className="space-y-3">
        {leads.map((lead) => (
          <Card key={lead.id}>
            <CardContent className="flex flex-wrap items-start justify-between gap-3 py-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{lead.clientName}</span>
                  <Badge variant={lead.status}>{statusLabels[lead.status]}</Badge>
                </div>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {lead.clientPhone}</p>
                {lead.clientEmail && <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Mail className="h-3.5 w-3.5" /> {lead.clientEmail}</p>}
                {lead.clientMessage && <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><MessageSquare className="h-3.5 w-3.5" /> {lead.clientMessage}</p>}
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" /> {new Date(lead.eventStart).toLocaleString("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {!lead.calendarEventId && <span className="text-xs">(nezapsáno do Google Kalendáře)</span>}
                </p>
              </div>
              {lead.status !== "cancelled" && (
                <Button size="xs" variant="ghost" onClick={() => cancelLead(lead.id)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Zrušit
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
