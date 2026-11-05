"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Phone, Mail, MessageSquare, Calendar, Trash2, ArrowLeft, Link2, FileText, Upload, Archive, Send } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type LeadStatus = "pending" | "sms_sent" | "confirmed" | "cancelled";
type ListingType = "sale" | "rent";
type Reaction = "interested" | "not_interested" | null;
type DocType = "purchase_contract" | "rental_contract" | "other";

interface Lead {
  id: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string | null;
  clientMessage?: string | null;
  eventStart: string;
  status: LeadStatus;
  calendarEventId?: string | null;
  reaction: Reaction;
  postViewingSmsSent: boolean;
}

interface ProjectDoc {
  id: string;
  type: DocType;
  fileName: string;
}

interface ProjectDetail {
  id: string;
  name: string;
  address: string;
  listingType?: ListingType | null;
  listingUrl?: string | null;
  description?: string | null;
  archivedAt?: string | null;
}

const statusLabels: Record<LeadStatus, string> = {
  pending: "Čeká",
  sms_sent: "SMS odeslána",
  confirmed: "Potvrzeno",
  cancelled: "Zrušeno",
};

const docTypeLabels: Record<DocType, string> = {
  purchase_contract: "Kupní smlouva",
  rental_contract: "Nájemní smlouva",
  other: "Ostatní",
};

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [documents, setDocuments] = useState<ProjectDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingInfo, setEditingInfo] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<DocType>("purchase_contract");

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [message, setMessage] = useState("");
  const [eventStart, setEventStart] = useState("");

  const [infoListingType, setInfoListingType] = useState<ListingType | "">("");
  const [infoListingUrl, setInfoListingUrl] = useState("");
  const [infoDescription, setInfoDescription] = useState("");

  const load = async () => {
    const res = await fetch(`/api/projects/${id}`);
    const data = await res.json().catch(() => null);
    if (!res.ok) { setError(data?.error ?? "Projekt nenalezen"); return; }
    setProject(data.project);
    setLeads(data.leads);
    setDocuments(data.documents ?? []);
    setInfoListingType(data.project.listingType ?? "");
    setInfoListingUrl(data.project.listingUrl ?? "");
    setInfoDescription(data.project.description ?? "");
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

  const setReaction = async (leadId: string, reaction: Reaction) => {
    await fetch(`/api/viewings/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reaction }),
    });
    await load();
  };

  const sendPostViewingSms = async (leadId: string) => {
    const res = await fetch(`/api/viewings/${leadId}/post-viewing-sms`, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (!res.ok) { setError(data?.error ?? "Nepodařilo se odeslat SMS"); return; }
    await load();
  };

  const saveInfo = async () => {
    setSavingInfo(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingType: infoListingType || null,
          listingUrl: infoListingUrl,
          description: infoDescription,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError(data?.error ?? "Nepodařilo se uložit"); return; }
      setEditingInfo(false);
      await load();
    } finally {
      setSavingInfo(false);
    }
  };

  const archiveProject = async () => {
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !project?.archivedAt }),
    });
    await load();
  };

  const uploadDocument = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("type", docType);
      const res = await fetch(`/api/projects/${id}/documents`, { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError(data?.error ?? "Nepodařilo se uložit dokument"); return; }
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
    } finally {
      setUploading(false);
    }
  };

  const deleteDocument = async (docId: string) => {
    await fetch(`/api/projects/${id}/documents/${docId}`, { method: "DELETE" });
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

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold">{project.name}</h1>
            {project.listingType && <Badge variant="outline">{project.listingType === "sale" ? "Prodej" : "Pronájem"}</Badge>}
            {project.archivedAt && <Badge variant="outline">Archivováno</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{project.address}</p>
        </div>
        <Button size="sm" variant="outline" onClick={archiveProject}>
          <Archive className="h-4 w-4 mr-1.5" /> {project.archivedAt ? "Vrátit z archivu" : "Archivovat"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Info o nemovitosti */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Info o nemovitosti</CardTitle>
          {!editingInfo && <Button size="xs" variant="ghost" onClick={() => setEditingInfo(true)}>Upravit</Button>}
        </CardHeader>
        <CardContent className="space-y-3">
          {editingInfo ? (
            <>
              <div className="flex gap-2">
                <Button size="sm" variant={infoListingType === "sale" ? "default" : "outline"} onClick={() => setInfoListingType("sale")}>Prodej</Button>
                <Button size="sm" variant={infoListingType === "rent" ? "default" : "outline"} onClick={() => setInfoListingType("rent")}>Pronájem</Button>
              </div>
              <Input placeholder="URL inzerátu" value={infoListingUrl} onChange={(e) => setInfoListingUrl(e.target.value)} />
              <Textarea placeholder="Info o bytě / nemovitosti" value={infoDescription} onChange={(e) => setInfoDescription(e.target.value)} />
              <div className="flex gap-2">
                <Button size="sm" disabled={savingInfo} onClick={saveInfo}>
                  {savingInfo ? <Loader2 className="h-4 w-4 animate-spin" /> : "Uložit"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingInfo(false)}>Zrušit</Button>
              </div>
            </>
          ) : (
            <>
              {project.listingUrl && (
                <a href={project.listingUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                  <Link2 className="h-3.5 w-3.5" /> {project.listingUrl}
                </a>
              )}
              {project.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.description}</p>}
              {!project.listingUrl && !project.description && <p className="text-sm text-muted-foreground">Zatím nevyplněno.</p>}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dokumenty / smlouvy */}
      <Card>
        <CardHeader><CardTitle className="text-base">Smlouvy a dokumenty</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {documents.length === 0 && <p className="text-sm text-muted-foreground">Zatím žádné dokumenty.</p>}
          {documents.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 text-sm">
              <a href={`/api/projects/${id}/documents/${d.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
                <FileText className="h-3.5 w-3.5" /> {d.fileName} <span className="text-muted-foreground">({docTypeLabels[d.type]})</span>
              </a>
              <Button size="xs" variant="ghost" onClick={() => deleteDocument(d.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={docType} onChange={(e) => setDocType(e.target.value as DocType)}>
              <option value="purchase_contract">Kupní smlouva</option>
              <option value="rental_contract">Nájemní smlouva</option>
              <option value="other">Ostatní</option>
            </select>
            <input ref={fileInputRef} type="file" className="text-sm" />
            <Button size="sm" disabled={uploading} onClick={uploadDocument}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4 mr-1.5" /> Uložit</>}
            </Button>
          </div>
        </CardContent>
      </Card>

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
        {leads.map((lead) => {
          const viewingPassed = new Date(lead.eventStart).getTime() < Date.now();
          return (
            <Card key={lead.id}>
              <CardContent className="flex flex-wrap items-start justify-between gap-3 py-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{lead.clientName}</span>
                    <Badge variant={lead.status}>{statusLabels[lead.status]}</Badge>
                    {lead.reaction === "interested" && <Badge variant="confirmed">Má zájem</Badge>}
                    {lead.reaction === "not_interested" && <Badge variant="cancelled">Nemá zájem</Badge>}
                  </div>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {lead.clientPhone}</p>
                  {lead.clientEmail && <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Mail className="h-3.5 w-3.5" /> {lead.clientEmail}</p>}
                  {lead.clientMessage && <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><MessageSquare className="h-3.5 w-3.5" /> {lead.clientMessage}</p>}
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" /> {new Date(lead.eventStart).toLocaleString("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {!lead.calendarEventId && <span className="text-xs">(nezapsáno do Google Kalendáře)</span>}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {lead.status !== "cancelled" && viewingPassed && (
                    <Button size="xs" variant="outline" disabled={lead.postViewingSmsSent} onClick={() => sendPostViewingSms(lead.id)}>
                      <Send className="h-3.5 w-3.5 mr-1" /> {lead.postViewingSmsSent ? "Dotaz odeslán" : "Poslat dotaz po prohlídce"}
                    </Button>
                  )}
                  {lead.status !== "cancelled" && viewingPassed && (
                    <div className="flex gap-1">
                      <Button size="xs" variant={lead.reaction === "interested" ? "default" : "ghost"} onClick={() => setReaction(lead.id, "interested")}>Má zájem</Button>
                      <Button size="xs" variant={lead.reaction === "not_interested" ? "default" : "ghost"} onClick={() => setReaction(lead.id, "not_interested")}>Nemá zájem</Button>
                    </div>
                  )}
                  {lead.status !== "cancelled" && (
                    <Button size="xs" variant="ghost" onClick={() => cancelLead(lead.id)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Zrušit
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
