"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Building2, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface ProjectListItem {
  id: string;
  name: string;
  address: string;
  leadsCount: number;
}

export default function ProjectsPage() {
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  const load = async () => {
    const res = await fetch("/api/projects");
    const data = await res.json().catch(() => null);
    if (!res.ok) { setError(data?.error ?? "Nepodařilo se načíst projekty"); return; }
    setProjects(data.projects);
  };

  useEffect(() => {
    if (!authLoading && user) load();
  }, [authLoading, user]);

  const createProject = async () => {
    if (!name.trim() || !address.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError(data?.error ?? "Nepodařilo se vytvořit projekt"); return; }
      setName(""); setAddress(""); setAdding(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || projects === null) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Správa nemovitostí</h1>
        <Button size="sm" onClick={() => setAdding((v) => !v)}>
          <Plus className="h-4 w-4 mr-1.5" /> Nový projekt
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {adding && (
        <Card>
          <CardHeader><CardTitle className="text-base">Nový projekt (nemovitost)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Název (např. Byt 2+kk Vinohrady)" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Adresa nemovitosti" value={address} onChange={(e) => setAddress(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" disabled={saving} onClick={createProject}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Vytvořit"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Zrušit</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {projects.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">Zatím žádné projekty. Vytvoř první nemovitost tlačítkem výše.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`}>
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4 text-muted-foreground" /> {p.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <p className="text-sm text-muted-foreground">{p.address}</p>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> {p.leadsCount} zájemců
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
