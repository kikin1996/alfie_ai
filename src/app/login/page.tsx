"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Calendar, AlertCircle } from "lucide-react";
// AlertCircle used only in dev

export default function LoginPage() {
  const router = useRouter();
  const { user, signInWithGoogle, loading } = useAuth();
  const configured = isSupabaseConfigured();

  if (user) {
    router.replace("/dashboard");
    return null;
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-navy p-4">
      {/* dekorativní pozadí */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-emerald/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "3rem 3rem",
        }}
      />

      <Card className="relative w-full max-w-md border-white/10 bg-card/95 shadow-lifted backdrop-blur-xl animate-fade-in">
        {!configured && process.env.NODE_ENV === "development" && (
          <div className="mx-6 mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Pro přihlášení přidejte do <code className="bg-amber-100 px-1 rounded">.env.local</code> proměnné{" "}
              <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> a{" "}
              <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> z Supabase Dashboard.
            </span>
          </div>
        )}
        <CardHeader className="text-center pt-8">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-navy text-white shadow-soft">
            <Calendar className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-display tracking-tight text-navy">
            Renote
          </CardTitle>
          <CardDescription>
            Přihlaste se přes Google pro přístup ke kalendáři a automatizaci
            prohlídek.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pb-8">
          <Button
            variant="navy"
            size="lg"
            className="w-full"
            onClick={signInWithGoogle}
            disabled={loading}
          >
            {loading ? "Načítám…" : "Přihlásit se přes Google"}
          </Button>
          {process.env.NODE_ENV === "development" && (
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              asChild
            >
              <a href="/api/dev-admin">Vstoupit jako admin (náhled)</a>
            </Button>
          )}
          <p className="text-center text-xs text-muted-foreground">
            Přihlášením přes Google se účet vytvoří automaticky, pokud ještě neexistuje.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
