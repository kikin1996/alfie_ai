"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Building2, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type ListingType = "sale" | "rent";

interface ProjectListItem {
  id: string;
  name: string;
  address: string;
  listingType?: ListingType | null;
  leadsCount: number;
}

const listingLabels: Record<ListingType, string> = { sale: "Prodej", rent: "Pronájem" };

export default function ProjectsPage() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [listingType, setListingType] = useState<ListingType | "">("");

  const load = async (which: "active" | "archived") => {
    setProjects(null);
    const res = await fetch(`/api/projects${which === "archived" ? "?archived=1" : ""}`);
    const data = await res.json().catch(() => null);
    if (!res.ok) { setError(data?.error ?? "Nepodařilo se načíst projekty"); return; }
    setProjects(data.projects);
  };

  useEffect(() => {
    if (!authLoading && user) load(tab);
  }, [authLoading, user, tab]);

  const createProject = async () => {
    if (!name.trim() || !address.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address, listingType: listingType || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError(data?.error ?? "Nepodařilo se vytvořit projekt"); return; }
      setName(""); setAddress(""); setListingType(""); setAdding(false);
      await load(tab);
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

      <div className="flex gap-2">
        <Button size="sm" variant={tab === "active" ? "default" : "ghost"} onClick={() => setTab("active")}>Aktivní</Button>
        <Button size="sm" variant={tab === "archived" ? "default" : "ghost"} onClick={() => setTab("archived")}>Archiv</Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {adding && (
        <Card>
          <CardHeader><CardTitle className="text-base">Nový projekt (nemovitost)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Název (např. Byt 2+kk Vinohrady)" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Adresa nemovitosti" value={address} onChange={(e) => setAddress(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" variant={listingType === "sale" ? "default" : "outline"} onClick={() => setListingType("sale")}>Prodej</Button>
              <Button size="sm" variant={listingType === "rent" ? "default" : "outline"} onClick={() => setListingType("rent")}>Pronájem</Button>
            </div>
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
        <p className="text-sm text-muted-foreground">
          {tab === "active" ? "Zatím žádné projekty. Vytvoř první nemovitost tlačítkem výše." : "Archiv je prázdný."}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`}>
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4 text-muted-foreground" /> {p.name}
                  {p.listingType && <Badge variant="outline">{listingLabels[p.listingType]}</Badge>}
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
