"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase";
import CalendarView from "@/components/CalendarView";
import type { Viewing, ViewingStatus } from "@/types";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { Calendar, Loader2, List, CalendarDays } from "lucide-react";

const statusLabels: Record<ViewingStatus, string> = {
  pending: "Čeká",
  sms_sent: "SMS odeslána",
  confirmed: "Potvrzeno",
  cancelled: "Zrušeno",
};

const statusVariant: Record<
  ViewingStatus,
  "pending" | "sms_sent" | "confirmed" | "cancelled"
> = {
  pending: "pending",
  sms_sent: "sms_sent",
  confirmed: "confirmed",
  cancelled: "cancelled",
};

function ViewingCard({ viewing }: { viewing: Viewing }) {
  const start = new Date(viewing.eventStart);
  return (
    <Card className="border-navy/10">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{viewing.address}</CardTitle>
          <Badge variant={statusVariant[viewing.status]}>
            {statusLabels[viewing.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-1">
        <p>{format(start, "d. M. yyyy, HH:mm", { locale: cs })}</p>
        {viewing.clientName && <p>Klient: {viewing.clientName}</p>}
        {viewing.clientPhone && <p>Tel: {viewing.clientPhone}</p>}
      </CardContent>
    </Card>
  );
}

type ViewMode = "list" | "calendar";

export default function DashboardPage() {
  const { user } = useAuth();
  const [viewings, setViewings] = useState<Viewing[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const supabase = createClient();

  useEffect(() => {
    if (!user?.id) return;
    const fetchViewings = async () => {
      const { data } = await supabase
        .from("viewings")
        .select("*")
        .eq("user_id", user.id)
        .order("event_start", { ascending: true });
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
          createdAt: r.created_at as string,
          updatedAt: r.updated_at as string,
          userId: r.user_id as string,
        }))
      );
      setLoading(false);
    };
    fetchViewings();
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-navy" />
      </div>
    );
  }

  const upcoming = viewings.filter(
    (v) => new Date(v.eventStart) >= new Date() && v.status !== "cancelled"
  );
  const past = viewings.filter(
    (v) => new Date(v.eventStart) < new Date() || v.status === "cancelled"
  );

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-8 w-8 text-navy" />
          <div>
            <h1 className="text-2xl font-display font-semibold text-navy">
              Prohlídky
            </h1>
            <p className="text-muted-foreground text-sm">
              Přehled z kalendáře – načtěte události v Nastavení (sync z Google
              Calendar).
            </p>
          </div>
        </div>
        {viewings.length > 0 && (
          <div className="flex gap-1">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4 mr-1.5" />
              Seznam
            </Button>
            <Button
              variant={viewMode === "calendar" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("calendar")}
            >
              <CalendarDays className="h-4 w-4 mr-1.5" />
              Kalendář
            </Button>
          </div>
        )}
      </div>

      {viewings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Zatím nemáte žádné prohlídky. Přidejte do Google Kalendáře události s
            klíčovým slovem (např. #prohlidka) a formátem: Tel: +420… Adresa: …
            Poté spusťte synchronizaci (backend / Edge Function).
          </CardContent>
        </Card>
      ) : viewMode === "calendar" ? (
        <CalendarView viewings={viewings} />
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-lg font-medium text-navy mb-3">
                Nadcházející
              </h2>
              <div className="grid gap-3">
                {upcoming.map((v) => (
                  <ViewingCard key={v.id} viewing={v} />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="text-lg font-medium text-muted-foreground mb-3">
                Minulé / zrušené
              </h2>
              <div className="grid gap-3">
                {past.map((v) => (
                  <ViewingCard key={v.id} viewing={v} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
