"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, MessageSquare, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface HistoryEntry {
  viewingId: string;
  projectName: string | null;
  address: string;
  clientName: string;
  label: string;
  text: string;
  sentAt: string;
}

interface PendingEntry {
  viewingId: string;
  projectName: string | null;
  address: string;
  clientName: string;
  label: string;
  eventStart: string;
}

interface ProjectOption {
  id: string;
  name: string;
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function SmsHistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [pending, setPending] = useState<PendingEntry[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [projectId, setProjectId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");

  const load = async () => {
    const params = new URLSearchParams();
    if (projectId) params.set("projectId", projectId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (q) params.set("q", q);
    const res = await fetch(`/api/sms-log?${params.toString()}`);
    const data = await res.json().catch(() => null);
    if (!res.ok) { setError(data?.error ?? "Nepodařilo se načíst historii"); return; }
    setHistory(data.history);
    setPending(data.pending);
    setProjects(data.projects);
  };

  useEffect(() => {
    if (!authLoading && user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, projectId, from, to]);

  // Vyhledávání jménem necháme doběhnout bez okamžitého refetchu na každý znak
  useEffect(() => {
    if (!authLoading && user) {
      const t = setTimeout(load, 300);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  if (authLoading || history === null) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Historie SMS</h1>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Nemovitost</label>
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Všechny</option>
              <option value="none">Bez projektu</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Od data</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Do data</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Jméno klienta</label>
            <Input placeholder="Hledat jméno..." value={q} onChange={(e) => setQ(e.target.value)} className="h-9" />
          </div>
        </CardContent>
      </Card>

      {pending.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Ještě neodesláno ({pending.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {pending.map((p, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-2 text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
                <div>
                  <span className="font-medium">{p.clientName}</span>
                  <span className="text-muted-foreground"> — {p.projectName ?? p.address}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="pending">{p.label}</Badge>
                  <span className="text-xs text-muted-foreground">{fmt(p.eventStart)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Odeslané SMS ({history.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {history.length === 0 && <p className="text-sm text-muted-foreground">Žádné SMS podle filtru nenalezeny.</p>}
          {history.map((h, i) => (
            <div key={i} className="space-y-1 border-b border-border/50 pb-3 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{h.clientName}</span>
                  <Badge variant="confirmed">{h.label}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">{fmt(h.sentAt)}</span>
              </div>
              <p className="text-xs text-muted-foreground">{h.projectName ?? h.address}</p>
              <p className="text-sm">{h.text}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
