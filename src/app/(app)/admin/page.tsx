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
import { createClient } from "@/lib/supabase";
import {
  Loader2,
  ShieldCheck,
  MessageSquare,
  Phone,
  CheckCircle,
  XCircle,
  FlaskConical,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  Send,
} from "lucide-react";

// ---------------------------------------------------------------------------
// SmsTestPanel
// ---------------------------------------------------------------------------

interface TestResult {
  ok: boolean;
  message: string;
}

function SmsTestPanel({ onSend, onClose }: { onSend: (phone: string) => Promise<string | void>; onClose: () => void }) {
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const handleSend = async () => {
    if (!phone.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const msg = await onSend(phone.trim());
      setResult({ ok: true, message: msg ?? "Odesláno úspěšně!" });
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
        <Button type="button" variant="outline" size="sm" onClick={handleSend} disabled={sending || !phone.trim()} className="shrink-0">
          {sending ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Odesílám…</> : "Odeslat"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} className="shrink-0">Zrušit</Button>
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
// VapiTestPanel – formulář s údaji prohlídky + výsledek hovoru
// ---------------------------------------------------------------------------

interface VapiTestData {
  phone: string;
  clientName: string;
  address: string;
  date: string;
  time: string;
}

interface CallResult {
  status: string;
  endedReason?: string;
  transcript?: string;
  summary?: string;
  clientResponse: "confirmed" | "cancelled" | "unknown";
  durationSeconds?: number;
}

function VapiTestPanel({
  onSend,
  onClose,
}: {
  onSend: (data: VapiTestData) => Promise<string | void>;
  onClose: () => void;
}) {
  const now = new Date();
  const defaultDate = now.toISOString().slice(0, 10);
  const defaultTime = new Date(now.getTime() + 60 * 60 * 1000).toTimeString().slice(0, 5);

  const [data, setData] = useState<VapiTestData>({
    phone: "",
    clientName: "",
    address: "",
    date: defaultDate,
    time: defaultTime,
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [callResult, setCallResult] = useState<CallResult | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const set = (k: keyof VapiTestData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setData((d) => ({ ...d, [k]: e.target.value }));

  const handleSend = async () => {
    if (!data.phone.trim()) return;
    setSending(true);
    setError(null);
    setCallId(null);
    setCallResult(null);
    try {
      const msg = await onSend(data);
      // extrahuj call ID z výsledné zprávy "✅ Hovor zahájen! Call ID: xxx"
      const match = typeof msg === "string" ? msg.match(/Call ID:\s*(\S+)/) : null;
      if (match) setCallId(match[1]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Neznámá chyba");
    } finally {
      setSending(false);
    }
  };

  const checkStatus = async () => {
    if (!callId) return;
    setCheckingStatus(true);
    try {
      const res = await fetch("/api/test/vapi/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Chyba");
      setCallResult(d as CallResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba při načítání výsledku");
    } finally {
      setCheckingStatus(false);
    }
  };

  const responseIcon = callResult?.clientResponse === "confirmed"
    ? <ThumbsUp className="h-4 w-4 text-emerald-600" />
    : callResult?.clientResponse === "cancelled"
    ? <ThumbsDown className="h-4 w-4 text-destructive" />
    : <HelpCircle className="h-4 w-4 text-amber-500" />;

  const responseLabel = callResult?.clientResponse === "confirmed"
    ? "Klient potvrdil příchod (ANO)"
    : callResult?.clientResponse === "cancelled"
    ? "Klient zrušil prohlídku (NE)"
    : "Odpověď klienta nejasná";

  return (
    <div className="mt-3 rounded-lg border border-dashed border-border bg-muted/40 p-4 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Údaje testovací prohlídky</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label className="text-xs">Jméno klienta</Label>
          <Input value={data.clientName} onChange={set("clientName")} placeholder="Jan Novák" className="h-8 text-sm mt-1" />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Adresa prohlídky</Label>
          <Input value={data.address} onChange={set("address")} placeholder="Václavské náměstí 1, Praha 1" className="h-8 text-sm mt-1" />
        </div>
        <div>
          <Label className="text-xs">Datum</Label>
          <Input type="date" value={data.date} onChange={set("date")} className="h-8 text-sm mt-1" />
        </div>
        <div>
          <Label className="text-xs">Čas</Label>
          <Input type="time" value={data.time} onChange={set("time")} className="h-8 text-sm mt-1" />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Testovací tel. číslo (kam zavolat)</Label>
          <Input value={data.phone} onChange={set("phone")} placeholder="+420123456789" className="h-8 text-sm mt-1" />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        {!callId ? (
          <Button type="button" variant="outline" size="sm" onClick={handleSend} disabled={sending || !data.phone.trim()} className="shrink-0">
            {sending ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Volám…</> : "Zahájit testovací hovor"}
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={handleSend} disabled={sending} className="shrink-0">
            {sending ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Volám…</> : "Zavolat znovu"}
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onClose} className="shrink-0">Zrušit</Button>
      </div>

      {error && (
        <p className="text-xs flex items-center gap-1 text-destructive">
          <XCircle className="h-3 w-3" />{error}
        </p>
      )}

      {/* Výsledek hovoru */}
      {callId && (
        <div className="rounded-lg border border-border bg-background p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-foreground">Hovor zahájen</p>
              <p className="text-[11px] text-muted-foreground font-mono">{callId}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={checkStatus} disabled={checkingStatus} className="h-7 text-xs gap-1">
              {checkingStatus ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Zkontrolovat výsledek
            </Button>
          </div>

          {callResult && (
            <div className="space-y-2 pt-1 border-t border-border">
              {/* Odpověď klienta */}
              <div className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
                callResult.clientResponse === "confirmed" ? "bg-emerald-50 text-emerald-700" :
                callResult.clientResponse === "cancelled" ? "bg-destructive/10 text-destructive" :
                "bg-amber-50 text-amber-700"
              }`}>
                {responseIcon}
                <span className="text-xs font-medium">{responseLabel}</span>
              </div>

              {/* Status + délka */}
              <div className="flex gap-4 text-[11px] text-muted-foreground">
                <span>Status: <span className="font-medium text-foreground">{callResult.status}</span></span>
                {callResult.endedReason && <span>Důvod ukončení: <span className="font-medium text-foreground">{callResult.endedReason}</span></span>}
                {callResult.durationSeconds != null && <span>Délka: <span className="font-medium text-foreground">{callResult.durationSeconds}s</span></span>}
              </div>

              {/* Shrnutí AI */}
              {callResult.summary && (
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">Shrnutí (AI)</p>
                  <p className="text-xs text-foreground leading-relaxed">{callResult.summary}</p>
                </div>
              )}

              {/* Přepis hovoru */}
              {callResult.transcript && (
                <details className="group">
                  <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">
                    Přepis hovoru ▸
                  </summary>
                  <pre className="mt-1 text-[11px] text-foreground leading-relaxed whitespace-pre-wrap font-sans bg-muted rounded p-2 max-h-48 overflow-y-auto">
                    {callResult.transcript}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
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
  vapiMinutesBefore: string;
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testingSms, setTestingSms] = useState(false);
  const [testingVapi, setTestingVapi] = useState(false);
  const [waTestState, setWaTestState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [waTestError, setWaTestError] = useState<string | null>(null);

  const [form, setForm] = useState<ConfigForm>({
    smsbranaLogin: "",
    smsbranaPassword: "",
    vapiApiKey: "",
    vapiAssistantId: "",
    vapiPhoneNumberId: "",
    vapiMinutesBefore: "30",
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
    if (authLoading) return;
    if (!user?.id) { setLoaded(true); return; }

    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const r = await fetch("/api/admin/config", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).catch((e: Error) => { throw new Error(`Síťová chyba: ${e.message}`); });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(`Chyba načítání (${r.status}): ${data.error ?? "Neznámá chyba"}`);
      setForm({
        smsbranaLogin: data.smsbrana_login ?? "",
        smsbranaPassword: data.smsbrana_password ?? "",
        vapiApiKey: data.vapi_api_key ?? "",
        vapiAssistantId: data.vapi_assistant_id ?? "",
        vapiPhoneNumberId: data.vapi_phone_number_id ?? "",
        vapiMinutesBefore: String(data.vapi_minutes_before ?? 30),
      });
    };

    load()
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoaded(true));
  }, [user?.id, authLoading]);

  const handleSave = async () => {
    setSaving(true);
    setSaveOk(false);
    setSaveError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setSaveOk(true);
      else setSaveError(`Chyba uložení (${res.status}): ${data.error ?? "Neznámá chyba"}`);
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

  const sendTestWhatsApp = async () => {
    setWaTestState("sending");
    setWaTestError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/test/whatsapp", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chyba odesílání");
      setWaTestState("ok");
    } catch (e) {
      setWaTestError(e instanceof Error ? e.message : "Chyba");
      setWaTestState("error");
    }
  };

  const sendTestVapi = async ({ phone, clientName, address, date, time }: VapiTestData) => {
    const startISO = date && time ? new Date(`${date}T${time}:00`).toISOString() : undefined;
    const res = await fetch("/api/test/vapi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: form.vapiApiKey,
        assistantId: form.vapiAssistantId,
        phoneNumberId: form.vapiPhoneNumberId,
        phone,
        clientName,
        address,
        startISO,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Chyba při spouštění hovoru");
    return `✅ Hovor zahájen! Call ID: ${data.callId}`;
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

      {loadError && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-destructive text-sm">
          <XCircle className="h-4 w-4 shrink-0" />
          {loadError}
        </div>
      )}

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
                <SmsTestPanel
                  onSend={sendTestSms}
                  onClose={() => setTestingSms(false)}
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
              <Label htmlFor="vapiMinutesBefore">Volat X minut před prohlídkou</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-1">
                AI asistent zavolá klientovi tolik minut před začátkem prohlídky. Výchozí: 30 minut.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  id="vapiMinutesBefore"
                  type="number"
                  min="5"
                  max="120"
                  {...field("vapiMinutesBefore")}
                  className="mt-1 w-24"
                />
                <span className="text-sm text-muted-foreground mt-1">minut</span>
              </div>
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
                <VapiTestPanel
                  onSend={sendTestVapi}
                  onClose={() => setTestingVapi(false)}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              WhatsApp notifikace – test
            </CardTitle>
            <CardDescription>
              Odešle testovací zprávu na číslo nastavené v sekci Nastavení. Ověřte, že CallMeBot funguje.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={sendTestWhatsApp}
                disabled={waTestState === "sending"}
                className="gap-1.5"
              >
                {waTestState === "sending" ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" />Odesílám…</>
                ) : (
                  <><FlaskConical className="h-3.5 w-3.5" />Odeslat testovací WhatsApp</>
                )}
              </Button>
              {waTestState === "ok" && (
                <p className="text-sm text-emerald-600 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" /> Zpráva odeslána – zkontrolujte WhatsApp
                </p>
              )}
              {waTestState === "error" && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <XCircle className="h-4 w-4" /> {waTestError}
                </p>
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
          {saveError && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <XCircle className="h-4 w-4" /> {saveError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
