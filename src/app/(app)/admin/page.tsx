"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  Loader2,
  ShieldCheck,
  MessageSquare,
  Phone,
  CheckCircle,
  XCircle,
  FlaskConical,
} from "lucide-react";

// ---------------------------------------------------------------------------
// TestPanel – stejný jako v settings
// ---------------------------------------------------------------------------

interface TestResult {
  ok: boolean;
  message: string;
}

interface TestPanelProps {
  onSend: (phone: string) => Promise<void>;
  onClose: () => void;
  buttonLabel: string;
  loadingLabel: string;
}

function TestPanel({ onSend, onClose, buttonLabel, loadingLabel }: TestPanelProps) {
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const handleSend = async () => {
    if (!phone.trim()) return;
    setSending(true);
    setResult(null);
    try {
      await onSend(phone.trim());
      setResult({ ok: true, message: "Odesláno úspěšně!" });
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : "Neznámá chyba" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-dashed border-border bg-muted/40 p-3 space-y-2">
      <p className="text-xs text-muted-foreground">Testovací číslo (formát: +420…)</p>
      <div className="flex gap-2">
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+420123456789"
          className="h-8 text-sm"
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSend}
          disabled={sending || !phone.trim()}
          className="shrink-0"
        >
          {sending ? (
            <><Loader2 className="h-3 w-3 animate-spin mr-1" />{loadingLabel}</>
          ) : buttonLabel}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} className="shrink-0">
          Zrušit
        </Button>
      </div>
      {result && (
        <p className={`text-xs flex items-center gap-1 ${result.ok ? "text-emerald-600" : "text-destructive"}`}>
          {result.ok ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {result.message}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AdminPage
// ---------------------------------------------------------------------------

interface ConfigForm {
  smsbranaLogin: string;
  smsbranaPassword: string;
  vapiApiKey: string;
  vapiAssistantId: string;
  vapiPhoneNumberId: string;
}

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [testingSms, setTestingSms] = useState(false);
  const [testingVapi, setTestingVapi] = useState(false);

  const [form, setForm] = useState<ConfigForm>({
    smsbranaLogin: "",
    smsbranaPassword: "",
    vapiApiKey: "",
    vapiAssistantId: "",
    vapiPhoneNumberId: "",
  });

  // Guard: přesměrovat nepřihlášené nebo non-admin uživatele
  useEffect(() => {
    if (!user) return;
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    if (adminEmail && user.email !== adminEmail) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  useEffect(() => {
    fetch("/api/admin/config")
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Record<string, string | null>) => {
        setForm({
          smsbranaLogin: data.smsbrana_login ?? "",
          smsbranaPassword: data.smsbrana_password ?? "",
          vapiApiKey: data.vapi_api_key ?? "",
          vapiAssistantId: data.vapi_assistant_id ?? "",
          vapiPhoneNumberId: data.vapi_phone_number_id ?? "",
        });
        setLoaded(true);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveOk(false);
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) setSaveOk(true);
    } finally {
      setSaving(false);
    }
  };

  const sendTestSms = async (phone: string) => {
    const res = await fetch("/api/test/sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        login: form.smsbranaLogin,
        password: form.smsbranaPassword,
        phone,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Chyba při odesílání");
  };

  const sendTestVapi = async (phone: string) => {
    const res = await fetch("/api/test/vapi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: form.vapiApiKey,
        assistantId: form.vapiAssistantId,
        phoneNumberId: form.vapiPhoneNumberId,
        phone,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Chyba při spouštění hovoru");
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-navy" />
      </div>
    );
  }

  const field = (key: keyof ConfigForm) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="h-6 w-6 text-navy" />
        <h1 className="text-2xl font-display font-semibold text-navy">
          Administrace
        </h1>
      </div>
      <p className="text-muted-foreground mb-6">
        Globální nastavení SMS brány a VAPI hovorů sdílených pro všechny uživatele.
      </p>

      <div className="space-y-6">
        {/* SMSbrána.cz */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              SMSbrána.cz
            </CardTitle>
            <CardDescription>
              Jedno číslo pro odesílání SMS všem klientům. Účet na{" "}
              <a href="https://www.smsbrana.cz" target="_blank" rel="noreferrer" className="underline">
                smsbrana.cz
              </a>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="smsbranaLogin">Login</Label>
              <Input
                id="smsbranaLogin"
                {...field("smsbranaLogin")}
                placeholder="vas_login"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="smsbranaPassword">Heslo / API klíč</Label>
              <Input
                id="smsbranaPassword"
                type="password"
                {...field("smsbranaPassword")}
                placeholder="••••••••"
                className="mt-1"
              />
            </div>
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTestingSms((v) => !v)}
                className="gap-1.5"
              >
                <FlaskConical className="h-3.5 w-3.5" />
                Testovat SMS
              </Button>
              {testingSms && (
                <TestPanel
                  onSend={sendTestSms}
                  onClose={() => setTestingSms(false)}
                  buttonLabel="Odeslat"
                  loadingLabel="Odesílám…"
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* VAPI */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              VAPI – automatické hovory
            </CardTitle>
            <CardDescription>
              AI hovor 30 minut před prohlídkou přes{" "}
              <a href="https://vapi.ai" target="_blank" rel="noreferrer" className="underline">
                vapi.ai
              </a>. Jedno číslo pro všechny uživatele.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="vapiApiKey">API Key</Label>
              <Input
                id="vapiApiKey"
                type="password"
                {...field("vapiApiKey")}
                placeholder="••••••••"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="vapiAssistantId">Assistant ID</Label>
              <Input
                id="vapiAssistantId"
                {...field("vapiAssistantId")}
                placeholder="asst_xxxxx"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="vapiPhoneNumberId">Phone Number ID</Label>
              <Input
                id="vapiPhoneNumberId"
                {...field("vapiPhoneNumberId")}
                placeholder="num_xxxxx"
                className="mt-1"
              />
            </div>
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTestingVapi((v) => !v)}
                className="gap-1.5"
              >
                <FlaskConical className="h-3.5 w-3.5" />
                Testovat hovor
              </Button>
              {testingVapi && (
                <TestPanel
                  onSend={sendTestVapi}
                  onClose={() => setTestingVapi(false)}
                  buttonLabel="Zavolat"
                  loadingLabel="Volám…"
                />
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button variant="navy" onClick={handleSave} disabled={saving}>
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Ukládám…</>
            ) : (
              "Uložit nastavení"
            )}
          </Button>
          {saveOk && (
            <p className="text-sm text-emerald-600 flex items-center gap-1">
              <CheckCircle className="h-4 w-4" /> Uloženo
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
