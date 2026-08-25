"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase";
import type {
  SrealityLead,
  SrealityLeadStatus,
  SrealityLeadReaction,
  CrmContact,
} from "@/types";
import {
  Loader2,
  ArrowLeft,
  Users,
  Inbox,
  RefreshCw,
  CheckCircle,
  XCircle,
  Settings,
  Phone,
  Mail,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<SrealityLeadStatus, string> = {
  new: "Nové",
  scheduled: "Naplánováno",
  done: "Vyřízeno",
  archived: "Archivováno",
};

const STATUS_BADGE_VARIANT: Record<SrealityLeadStatus, "pending" | "sms_sent" | "confirmed" | "cancelled"> = {
  new: "pending",
  scheduled: "sms_sent",
  done: "confirmed",
  archived: "cancelled",
};

const REACTION_LABELS: Record<SrealityLeadReaction, string> = {
  interested: "Zájem",
  not_interested: "Bez zájmu",
  no_show: "Nedostavil se",
  thinking: "Přemýšlí",
};

async function authedFetch(path: string, options: RequestInit = {}) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Chyba (${res.status})`);
  return data;
}

// ---------------------------------------------------------------------------
// LeadDetailPanel
// ---------------------------------------------------------------------------

function LeadDetailPanel({
  lead,
  onSaved,
}: {
  lead: SrealityLead;
  onSaved: (updated: SrealityLead) => void;
}) {
  const [viewingAt, setViewingAt] = useState(
    lead.viewingAt ? lead.viewingAt.slice(0, 16) : ""
  );
  const [reaction, setReaction] = useState<SrealityLeadReaction | "">(lead.reaction ?? "");
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [convertedContactId, setConvertedContactId] = useState(lead.convertedContactId);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const status: SrealityLeadStatus = viewingAt
        ? (lead.status === "done" || lead.status === "archived" ? lead.status : "scheduled")
        : lead.status;
      const updated = await authedFetch(`/api/admin/sreality/leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          viewingAt: viewingAt ? new Date(viewingAt).toISOString() : null,
          reaction: reaction || null,
          notes,
          status,
        }),
      });
      onSaved(mapLead(updated));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba při ukládání");
    } finally {
      setSaving(false);
    }
  };

  const handlePromote = async () => {
    setPromoting(true);
    setError(null);
    try {
      const contact = await authedFetch(`/api/admin/sreality/leads/${lead.id}/promote`, {
        method: "POST",
      });
      setConvertedContactId(contact.id);
      onSaved({ ...lead, convertedContactId: contact.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba při ukládání kontaktu");
    } finally {
      setPromoting(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-4 space-y-4">
      {lead.message && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Zpráva klienta</p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{lead.message}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Termín prohlídky</Label>
          <Input
            type="datetime-local"
            value={viewingAt}
            onChange={(e) => setViewingAt(e.target.value)}
            className="h-8 text-sm mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Reakce klienta</Label>
          <select
            value={reaction}
            onChange={(e) => setReaction(e.target.value as SrealityLeadReaction | "")}
            className="mt-1 h-8 w-full rounded-xl border border-input bg-card px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <option value="">— nevyplněno —</option>
            {Object.entries(REACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Label className="text-xs">Poznámky</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Interní poznámky k poptávce…"
          className="mt-1 text-sm min-h-20"
        />
      </div>

      {error && (
        <p className="text-xs flex items-center gap-1 text-destructive">
          <XCircle className="h-3 w-3" />{error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="button" variant="navy" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Ukládám…</> : "Uložit"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePromote}
          disabled={promoting || !!convertedContactId}
          className="gap-1.5"
        >
          {promoting ? (
            <><Loader2 className="h-3 w-3 animate-spin" />Ukládám…</>
          ) : convertedContactId ? (
            <><CheckCircle className="h-3.5 w-3.5" />Již v kontaktech</>
          ) : (
            "Uložit do trvalých kontaktů"
          )}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// mapping (API returns snake_case DB rows)
// ---------------------------------------------------------------------------

function mapLead(row: Record<string, unknown>): SrealityLead {
  return {
    id: row.id as string,
    srealityInquiryId: row.sreality_inquiry_id as string,
    listingId: row.listing_id as string | undefined,
    listingTitle: row.listing_title as string | undefined,
    listingUrl: row.listing_url as string | undefined,
    listingType: row.listing_type as SrealityLead["listingType"],
    clientName: row.client_name as string | undefined,
    clientPhone: row.client_phone as string | undefined,
    clientEmail: row.client_email as string | undefined,
    message: row.message as string | undefined,
    status: row.status as SrealityLeadStatus,
    viewingAt: row.viewing_at as string | undefined,
    reaction: row.reaction as SrealityLeadReaction | undefined,
    notes: row.notes as string | undefined,
    convertedContactId: row.converted_contact_id as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    syncedAt: row.synced_at as string,
  };
}

function mapContact(row: Record<string, unknown>): CrmContact {
  return {
    id: row.id as string,
    name: row.name as string,
    phone: row.phone as string | undefined,
    email: row.email as string | undefined,
    notes: row.notes as string | undefined,
    sourceLeadId: row.source_lead_id as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ---------------------------------------------------------------------------
// LeadsTab
// ---------------------------------------------------------------------------

function LeadsTab() {
  const [leads, setLeads] = useState<SrealityLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SrealityLeadStatus | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const [config, setConfig] = useState({ apiKey: "", apiBaseUrl: "" });
  const [configSaving, setConfigSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const loadLeads = async (status: SrealityLeadStatus | "all") => {
    setLoading(true);
    setError(null);
    try {
      const qs = status !== "all" ? `?status=${status}` : "";
      const data = await authedFetch(`/api/admin/sreality/leads${qs}`);
      setLeads((data as Record<string, unknown>[]).map(mapLead));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba při načítání");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    authedFetch("/api/admin/sreality/config")
      .then((data) => setConfig({ apiKey: data.api_key ?? "", apiBaseUrl: data.api_base_url ?? "" }))
      .catch(() => {});
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await authedFetch("/api/admin/sreality/sync", { method: "POST" });
      setSyncMessage(`Staženo ${result.fetched}, nových ${result.created}, aktualizováno ${result.updated}`);
      await loadLeads(filter);
    } catch (e) {
      setSyncMessage(e instanceof Error ? e.message : "Chyba synchronizace");
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveConfig = async () => {
    setConfigSaving(true);
    setConfigSaved(false);
    try {
      await authedFetch("/api/admin/sreality/config", {
        method: "POST",
        body: JSON.stringify({ apiKey: config.apiKey, apiBaseUrl: config.apiBaseUrl, enabled: true }),
      });
      setConfigSaved(true);
    } finally {
      setConfigSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setShowConfig((v) => !v)}>
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            <span className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              S Reality API
            </span>
            {showConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CardTitle>
          <CardDescription>
            Bez vyplněného API klíče a URL běží synchronizace ve zkušebním (mock) režimu s ukázkovými poptávkami.
          </CardDescription>
        </CardHeader>
        {showConfig && (
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">API klíč</Label>
              <Input
                type="password"
                value={config.apiKey}
                onChange={(e) => setConfig((c) => ({ ...c, apiKey: e.target.value }))}
                placeholder="••••••••"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Base URL</Label>
              <Input
                value={config.apiBaseUrl}
                onChange={(e) => setConfig((c) => ({ ...c, apiBaseUrl: e.target.value }))}
                placeholder="https://api.sreality.cz/partner/v1"
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="navy" onClick={handleSaveConfig} disabled={configSaving}>
                {configSaving ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Ukládám…</> : "Uložit"}
              </Button>
              {configSaved && <CheckCircle className="h-4 w-4 text-emerald-600" />}
            </div>
          </CardContent>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "new", "scheduled", "done", "archived"] as const).map((s) => (
            <Button
              key={s}
              type="button"
              size="xs"
              variant={filter === s ? "navy" : "outline"}
              onClick={() => setFilter(s)}
            >
              {s === "all" ? "Vše" : STATUS_LABELS[s]}
            </Button>
          ))}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={handleSync} disabled={syncing} className="gap-1.5">
          {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Synchronizovat
        </Button>
      </div>

      {syncMessage && <p className="text-xs text-muted-foreground">{syncMessage}</p>}
      {error && (
        <p className="text-sm flex items-center gap-1 text-destructive">
          <XCircle className="h-4 w-4" />{error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-navy" />
        </div>
      ) : leads.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Žádné poptávky.</p>
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => (
            <Card key={lead.id}>
              <CardContent
                className="p-4 cursor-pointer"
                onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground">{lead.clientName || "Neznámý klient"}</p>
                      <Badge variant={STATUS_BADGE_VARIANT[lead.status]}>{STATUS_LABELS[lead.status]}</Badge>
                      {lead.reaction && (
                        <Badge variant="outline">{REACTION_LABELS[lead.reaction]}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                      {lead.listingType === "rent" ? "Pronájem" : lead.listingType === "sale" ? "Prodej" : ""}
                      {lead.listingTitle ? ` · ${lead.listingTitle}` : ""}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {lead.clientPhone && (
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.clientPhone}</span>
                      )}
                      {lead.clientEmail && (
                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{lead.clientEmail}</span>
                      )}
                      {lead.listingUrl && (
                        <a
                          href={lead.listingUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 underline hover:text-foreground"
                        >
                          <ExternalLink className="h-3 w-3" />inzerát
                        </a>
                      )}
                      {lead.viewingAt && (
                        <span>Prohlídka: {new Date(lead.viewingAt).toLocaleString("cs-CZ")}</span>
                      )}
                    </div>
                  </div>
                  {expandedId === lead.id ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                </div>
                {expandedId === lead.id && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <LeadDetailPanel
                      lead={lead}
                      onSaved={(updated) => setLeads((ls) => ls.map((l) => (l.id === updated.id ? updated : l)))}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContactsTab
// ---------------------------------------------------------------------------

function ContactsTab() {
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phone: "", email: "" });
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch("/api/admin/sreality/contacts");
      setContacts((data as Record<string, unknown>[]).map(mapContact));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba při načítání");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async () => {
    if (!newContact.name.trim()) return;
    setAdding(true);
    try {
      await authedFetch("/api/admin/sreality/contacts", {
        method: "POST",
        body: JSON.stringify(newContact),
      });
      setNewContact({ name: "", phone: "", email: "" });
      setShowAdd(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba při ukládání");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await authedFetch(`/api/admin/sreality/contacts/${id}`, { method: "DELETE" });
      setContacts((cs) => cs.filter((c) => c.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba při mazání");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Trvale uložení klienti nezávisle na poptávkách.</p>
        <Button type="button" size="sm" variant="outline" onClick={() => setShowAdd((v) => !v)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />Přidat kontakt
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="p-4 grid grid-cols-3 gap-3 items-end">
            <div>
              <Label className="text-xs">Jméno</Label>
              <Input
                value={newContact.name}
                onChange={(e) => setNewContact((c) => ({ ...c, name: e.target.value }))}
                className="h-8 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Telefon</Label>
              <Input
                value={newContact.phone}
                onChange={(e) => setNewContact((c) => ({ ...c, phone: e.target.value }))}
                className="h-8 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">E-mail</Label>
              <Input
                value={newContact.email}
                onChange={(e) => setNewContact((c) => ({ ...c, email: e.target.value }))}
                className="h-8 text-sm mt-1"
              />
            </div>
            <div className="col-span-3">
              <Button type="button" size="sm" variant="navy" onClick={handleAdd} disabled={adding || !newContact.name.trim()}>
                {adding ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Ukládám…</> : "Uložit kontakt"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <p className="text-sm flex items-center gap-1 text-destructive">
          <XCircle className="h-4 w-4" />{error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-navy" />
        </div>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Zatím žádné trvalé kontakty.</p>
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{c.name}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                    {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                  </div>
                  {c.notes && <p className="text-xs text-muted-foreground mt-1">{c.notes}</p>}
                </div>
                <Button type="button" size="xs" variant="ghost" onClick={() => handleDelete(c.id)} className="text-destructive hover:text-destructive shrink-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SrealityAdminPage
// ---------------------------------------------------------------------------

export default function SrealityAdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"leads" | "contacts">("leads");

  useEffect(() => {
    if (!user) return;
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    if (adminEmail && user.email !== adminEmail) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-navy" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" />Zpět na administraci
      </Link>

      <div className="flex items-center gap-2 mb-2">
        <Inbox className="h-6 w-6 text-navy" />
        <h1 className="text-2xl font-display font-semibold text-navy">S Reality CRM</h1>
      </div>
      <p className="text-muted-foreground mb-6">
        Poptávky klientů ze S Reality – plánování prohlídek, reakce klientů a trvalé kontakty.
      </p>

      <div className="flex gap-1.5 mb-4 border-b border-border pb-3">
        <Button type="button" size="sm" variant={tab === "leads" ? "navy" : "ghost"} onClick={() => setTab("leads")} className="gap-1.5">
          <Inbox className="h-4 w-4" />Poptávky
        </Button>
        <Button type="button" size="sm" variant={tab === "contacts" ? "navy" : "ghost"} onClick={() => setTab("contacts")} className="gap-1.5">
          <Users className="h-4 w-4" />Trvalé kontakty
        </Button>
      </div>

      {tab === "leads" ? <LeadsTab /> : <ContactsTab />}
    </div>
  );
}
