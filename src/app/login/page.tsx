"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
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
import { AlertCircle } from "lucide-react";
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
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        {!configured && process.env.NODE_ENV === "development" && (
          <div className="mx-6 mt-6 rounded-xl border border-pending/30 bg-pending-bg p-3 text-sm text-pending flex gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Pro přihlášení přidejte do <code className="bg-pending-bg px-1 rounded">.env.local</code> proměnné{" "}
              <code className="bg-pending-bg px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> a{" "}
              <code className="bg-pending-bg px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> z Supabase Dashboard.
            </span>
          </div>
        )}
        <CardHeader className="text-center pt-8">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center">
            <Image src="/logo.png" alt="Renote" width={56} height={56} className="h-14 w-14" priority />
          </div>
          <CardTitle className="font-display text-3xl font-medium tracking-tight">
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
