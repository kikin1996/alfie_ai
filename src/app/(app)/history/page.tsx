"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";
import type { Viewing, ViewingStatus } from "@/types";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { History, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

const statusLabels: Record<ViewingStatus, string> = {
  pending: "Minulá",
  sms_sent: "SMS odeslána",
  confirmed: "Potvrzeno",
  cancelled: "Zrušeno",
};

const statusVariant: Record<ViewingStatus, "pending" | "sms_sent" | "confirmed" | "cancelled"> = {
  pending: "pending",
  sms_sent: "sms_sent",
  confirmed: "confirmed",
  cancelled: "cancelled",
};

type SmsSettings = {
  smsTemplate: string;
  brokerName: string;
  brokerPhone: string;
  agencyName: string;
};

function buildSmsText(v: Viewing, s: SmsSettings): string {
  const timeStr = new Date(v.eventStart).toLocaleTimeString("cs-CZ", {
    timeZone: "Europe/Prague", hour: "2-digit", minute: "2-digit",
  });
  return s.smsTemplate
    .replace(/\{address\}/g, v.address || "")
    .replace(/\{time\}/g, timeStr)
    .replace(/\{clientName\}/g, v.clientName || "Klient")
    .replace(/\{brokerName\}/g, s.brokerName)
    .replace(/\{brokerPhone\}/g, s.brokerPhone)
    .replace(/\{agencyName\}/g, s.agencyName);
}

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const [viewings, setViewings] = useState<Viewing[]>([]);
  const [loading, setLoading] = useState(true);
  const [smsSettings, setSmsSettings] = useState<SmsSettings | null>(null);
  const supabase = createClient();

  const fetchHistory = useCallback(async () => {
    if (authLoading) return;
    if (!user?.id || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("viewings")
      .select("*")
      .eq("user_id", user.id)
      .or(`event_start.lt.${startOfToday.toISOString()},status.eq.cancelled`)
      .order("event_start", { ascending: false });

    const rows = (data as Record<string, unknown>[]) ?? [];
    setViewings(
      rows.map((r) => ({
        id: r.id as string,
        calendarEventId: r.calendar_event_id as string,
        address: r.address as string,
        clientPhone: r.client_phone as string,
        clientName: r.client_name as string,
        eventStart: r.event_start as string,
        eventEnd: r.event_end as string | undefined,
        status: r.status as Viewing["status"],
        smsSentAt: r.sms_sent_at as string | undefined,
        confirmedAt: r.confirmed_at as string | undefined,
        sms2hSent: (r.sms2h_sent as boolean) ?? false,
        sms1hSent: (r.sms1h_sent as boolean) ?? false,
        vapiCalled: (r.vapi_called as boolean) ?? false,
        sms2hEnabled: (r.sms2h_enabled as boolean) ?? true,
        sms1hEnabled: (r.sms1h_enabled as boolean) ?? true,
        vapiEnabled: (r.vapi_enabled as boolean) ?? true,
        extraNotifications: [],
        createdAt: r.created_at as string,
        updatedAt: r.updated_at as string,
        userId: r.user_id as string,
      }))
    );
    setLoading(false);
  }, [user?.id, authLoading, supabase]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured()) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("user_settings")
          .select("sms_template, broker_name, broker_phone, agency_name")
          .eq("user_id", user.id)
          .maybeSingle();
        if (data) setSmsSettings({
          smsTemplate: data.sms_template || "Dobrý den, připomínáme prohlídku na adrese {address} v {time}. Prosím potvrďte, zda přijdete. Děkujeme, {agencyName}",
          brokerName: data.broker_name || "",
          brokerPhone: data.broker_phone || "",
          agencyName: data.agency_name || "",
        });
      } catch { /* ignore */ }
    })();
  }, [user?.id, supabase]);

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Zpět
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <History className="h-7 w-7 text-navy" />
          <div>
            <h1 className="text-2xl font-display font-semibold text-navy">Minulé / zrušené</h1>
            <p className="text-muted-foreground text-sm">Přehled proběhlých a zrušených prohlídek.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : viewings.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-12">Žádné minulé prohlídky.</p>
      ) : (
        <div className="grid gap-3">
          {viewings.map((v) => {
            const start = new Date(v.eventStart);
            const smsSent = v.sms2hSent || v.sms1hSent || v.status === "cancelled" || v.status === "confirmed";
            return (
              <Card key={v.id} className="border-navy/10 opacity-80">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <CardTitle className="text-base">Klient: {v.clientName || "—"}</CardTitle>
                    <Badge variant={statusVariant[v.status]}>
                      {statusLabels[v.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1.5">
                  <p><span className="font-medium text-foreground">Adresa:</span> {v.address || "—"}</p>
                  <p><span className="font-medium text-foreground">Datum:</span> {format(start, "d. M. yyyy", { locale: cs })}</p>
                  <p><span className="font-medium text-foreground">Čas:</span> {start.toLocaleTimeString("cs-CZ", { timeZone: "Europe/Prague", hour: "2-digit", minute: "2-digit" })}</p>
                  {v.clientPhone && <p><span className="font-medium text-foreground">Tel.:</span> {v.clientPhone}</p>}
                  {v.status === "confirmed" && (
                    <p className="text-emerald-600 font-medium">
                      ✓ Potvrzeno po{" "}
                      {v.vapiCalled ? "hovoru" : v.sms1hSent ? "SMS 1h" : v.sms2hSent ? "SMS 2h" : "SMS"}
                    </p>
                  )}
                  {v.status === "cancelled" && (
                    <p className="text-destructive font-medium">✕ Klient odmítl schůzku</p>
                  )}
                  {smsSent && smsSettings && (
                    <div className="mt-0.5 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground border border-border/60">
                      <p className="font-semibold text-foreground/50 text-[10px] uppercase tracking-wide mb-1">Text odeslané SMS:</p>
                      <p>{buildSmsText(v, smsSettings)}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
