"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
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
import { createClient, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  Loader2,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  Send,
  User,
} from "lucide-react";
import Link from "next/link";

const schema = z.object({
  brokerName: z.string().optional(),
  agencyName: z.string().optional(),
  triggerKeyword: z.string().min(1, "Zadejte klíčové slovo"),
  smsTemplate: z.string().min(1, "Zadejte šablonu SMS"),
  whatsappPhone: z.string().optional(),
  whatsappApikey: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const defaultTemplate =
  "Dobrý den, potvrzujeme prohlídku na adrese {address} dnes v {time}. Odpovězte ANO pro potvrzení nebo NE pro zrušení.";

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const calendarStatus = searchParams?.get("calendar") ?? null;
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState<boolean | null>(null);
  const supabase = createClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      brokerName: "",
      agencyName: "",
      triggerKeyword: "#prohlidka",
      smsTemplate: defaultTemplate,
      whatsappPhone: "",
      whatsappApikey: "",
    },
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id || !isSupabaseConfigured()) {
      setLoaded(true);
      return;
    }
    const load = async () => {
      try {
        const [settingsRes, calendarRes] = await Promise.all([
          supabase
            .from("user_settings")
            .select("broker_name, agency_name, trigger_keyword, sms_template, whatsapp_phone, whatsapp_apikey")
            .eq("user_id", user.id)
            .maybeSingle(),
          fetch("/api/settings/calendar-connected").then((r) => r.ok ? r.json() : { connected: false }).catch(() => ({ connected: false })),
        ]);
        const data = settingsRes.data;
        if (data) {
          form.reset({
            brokerName: data.broker_name ?? "",
            agencyName: data.agency_name ?? "",
            triggerKeyword: data.trigger_keyword ?? "#prohlidka",
            smsTemplate: data.sms_template ?? defaultTemplate,
            whatsappPhone: data.whatsapp_phone ?? "",
            whatsappApikey: data.whatsapp_apikey ?? "",
          });
        }
        setCalendarConnected(calendarRes.connected ?? false);
      } finally {
        setLoaded(true);
      }
    };
    load();
  }, [user?.id, authLoading]);

  useEffect(() => {
    if (calendarStatus === "ok") setCalendarConnected(true);
  }, [calendarStatus]);

  const onSubmit = async (values: FormValues) => {
    if (!user?.id) return;
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      const { error } = await supabase.from("user_settings").upsert(
        {
          user_id: user.id,
          broker_name: values.brokerName || null,
          agency_name: values.agencyName || null,
          trigger_keyword: values.triggerKeyword,
          sms_template: values.smsTemplate,
          whatsapp_phone: values.whatsappPhone || null,
          whatsapp_apikey: values.whatsappApikey || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (error) {
        setSaveError(`Chyba uložení: ${error.message}`);
      } else {
        form.reset(values);
        setSaveOk(true);
        setTimeout(() => setSaveOk(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-navy" />
      </div>
    );
  }

  const calendarMessage = calendarStatus === "ok"
    ? { icon: CheckCircle, text: "Google Kalendář je propojen.", className: "text-emerald-600 bg-emerald-50 border-emerald-200" }
    : calendarStatus === "error"
    ? { icon: XCircle, text: "Propojení se nepovedlo. Zkuste to znovu.", className: "text-destructive bg-destructive/10 border-destructive/20" }
    : calendarStatus === "no_refresh"
    ? { icon: AlertCircle, text: 'Google nevrátil refresh token. Odhlaste se z Google a zkuste znovu s povolením "Offline access".', className: "text-amber-600 bg-amber-50 border-amber-200" }
    : calendarStatus === "config"
    ? { icon: AlertCircle, text: "Na serveru chybí GOOGLE_CLIENT_ID nebo GOOGLE_CLIENT_SECRET.", className: "text-amber-600 bg-amber-50 border-amber-200" }
    : null;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-display font-semibold text-navy mb-2">
        Nastavení
      </h1>
      <p className="text-muted-foreground mb-6">
        Kalendář, šablona SMS a WhatsApp notifikace.
      </p>

      {calendarMessage && (
        <div className={`mb-6 flex items-center gap-2 rounded-lg border p-3 ${calendarMessage.className}`}>
          <calendarMessage.icon className="h-5 w-5 shrink-0" />
          <p className="text-sm">{calendarMessage.text}</p>
        </div>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Profil makléře */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profil makléře
            </CardTitle>
            <CardDescription>
              Používá se v hlasových hovorech VAPI jako proměnné{" "}
              <code className="text-xs bg-muted px-1 rounded">{"{{brokerName}}"}</code> a{" "}
              <code className="text-xs bg-muted px-1 rounded">{"{{agencyName}}"}</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="brokerName">Jméno makléře</Label>
              <Input
                id="brokerName"
                {...form.register("brokerName")}
                placeholder="Jan Novák"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="agencyName">Název realitní kanceláře</Label>
              <Input
                id="agencyName"
                {...form.register("agencyName")}
                placeholder="Reality Praha"
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Kalendář */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Kalendář
            </CardTitle>
            <CardDescription>
              Události obsahující toto slovo budou považovány za prohlídky.
              Formát v popisu: Tel: +420… Adresa: …
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Propojení Google Kalendáře</Label>
              <p className="text-sm text-muted-foreground mt-1 mb-2">
                Prohlídky se načítají z událostí v Google Kalendáři.
              </p>
              {calendarConnected && (
                <p className="text-sm text-emerald-600 mb-2 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" /> Kalendář je propojen
                </p>
              )}
              <Button type="button" variant="outline" asChild>
                <Link href="/api/auth/google-calendar">
                  {calendarConnected ? "Znovu propojit Google Kalendář" : "Propojit Google Kalendář"}
                </Link>
              </Button>
            </div>
            <div>
              <Label htmlFor="triggerKeyword">
                Klíčové slovo (např. #prohlidka)
              </Label>
              <Input
                id="triggerKeyword"
                {...form.register("triggerKeyword")}
                placeholder="#prohlidka"
                className="mt-1"
              />
              {form.formState.errors.triggerKeyword && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.triggerKeyword.message}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Šablona SMS */}
        <Card>
          <CardHeader>
            <CardTitle>Šablona SMS (2h před)</CardTitle>
            <CardDescription>
              Placeholdery: {"{address}"}, {"{time}"}, {"{clientName}"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="smsTemplate">Text zprávy</Label>
              <Textarea
                id="smsTemplate"
                {...form.register("smsTemplate")}
                rows={4}
                className="mt-1"
              />
              {form.formState.errors.smsTemplate && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.smsTemplate.message}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              WhatsApp notifikace
            </CardTitle>
            <CardDescription>
              Dostanete WhatsApp zprávu při každé odeslané SMS nebo odpovědi klienta.
              Aktivace: přidejte <strong>+34 644 95 73 56</strong> do kontaktů a pošlete na toto číslo zprávu{" "}
              <em>„I allow callmebot to send me messages"</em>. API klíč dostanete odpovědí.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="whatsappPhone">Vaše telefonní číslo (s předvolbou)</Label>
              <Input
                id="whatsappPhone"
                {...form.register("whatsappPhone")}
                placeholder="+420777888999"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="whatsappApikey">CallMeBot API klíč</Label>
              <Input
                id="whatsappApikey"
                type="password"
                {...form.register("whatsappApikey")}
                placeholder="1234567"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                API klíč obdržíte jako WhatsApp odpověď od CallMeBot.
              </p>
            </div>
          </CardContent>
        </Card>

        {saveError && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
            {saveError}
          </p>
        )}
        {saveOk && (
          <p className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" /> Nastavení uloženo
          </p>
        )}
        <Button type="submit" variant="navy" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Ukládám…
            </>
          ) : (
            "Uložit nastavení"
          )}
        </Button>
      </form>
    </div>
  );
}
