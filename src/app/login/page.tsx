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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-navy/20 shadow-lg">
        {!configured && process.env.NODE_ENV === "development" && (
          <div className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Pro přihlášení přidejte do <code className="bg-amber-100 px-1 rounded">.env.local</code> proměnné{" "}
              <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> a{" "}
              <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> z Supabase Dashboard.
            </span>
          </div>
        )}
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-navy text-white">
            <Calendar className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-display text-navy">
            Real Estate Viewing Automator
          </CardTitle>
          <CardDescription>
            Přihlaste se přes Google pro přístup ke kalendáři a automatizaci
            prohlídek.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
          <p className="text-center text-sm text-muted-foreground">
            Nemáte účet?{" "}
            <a href="/register" className="text-navy underline">
              Zaregistrujte se
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
