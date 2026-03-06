"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";
import CalendarView from "@/components/CalendarView";
import type { Viewing, ViewingStatus, ExtraNotification } from "@/types";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import {
  Calendar,
  Loader2,
  List,
  CalendarDays,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
  X,
  MessageSquare,
  Phone,
  CheckCircle,
} from "lucide-react";

const statusLabels: Record<ViewingStatus, string> = {
  pending: "Čeká",
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

// ---------------------------------------------------------------------------
// NotifFlag – interaktivní přepínač notifikace
// ---------------------------------------------------------------------------

interface NotifFlagProps {
  sent: boolean;
  enabled: boolean;
  label: string;
  onToggle: () => Promise<void>;
}

function NotifFlag({ sent, enabled, label, onToggle }: NotifFlagProps) {
  const [localEnabled, setLocalEnabled] = useState(enabled);
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (sent || busy) return;
    setBusy(true);
    const next = !localEnabled;
    setLocalEnabled(next);
    try {
      await onToggle();
    } catch {
      setLocalEnabled(!next);
    } finally {
      setBusy(false);
    }
  };

  const stateClasses = sent
    ? "bg-emerald-bg text-emerald border-emerald/20 cursor-default"
    : localEnabled
    ? "bg-muted text-muted-foreground border-border cursor-pointer hover:border-muted-foreground/40 hover:bg-muted/80"
    : "bg-red-50 text-red-500 border-red-200 cursor-pointer hover:bg-red-100";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={sent || busy}
      title={
        sent
          ? "Odesláno"
          : localEnabled
          ? "Klikněte pro vypnutí"
          : "Klikněte pro zapnutí"
      }
      className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-all ${stateClasses}`}
    >
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : sent ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : localEnabled ? (
        <Clock className="h-3 w-3" />
      ) : (
        <XCircle className="h-3 w-3" />
      )}
      <span className={!localEnabled && !sent ? "line-through" : ""}>{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// AddNotifPanel – přidání vlastní notifikace
// ---------------------------------------------------------------------------

interface AddNotifPanelProps {
  onAdd: (notif: ExtraNotification) => Promise<void>;
  onClose: () => void;
}

function AddNotifPanel({ onAdd, onClose }: AddNotifPanelProps) {
  const [type, setType] = useState<"sms" | "vapi">("sms");
  const [minutes, setMinutes] = useState(240);
  const [label, setLabel] = useState("SMS 4h");
  const [saving, setSaving] = useState(false);

  const autoLabel = (t: "sms" | "vapi", min: number) => {
    const prefix = t === "sms" ? "SMS" : "Hovor";
    if (min < 60) return `${prefix} ${min}min`;
    const h = Math.round(min / 60);
    return `${prefix} ${h}h`;
  };

  const handleTypeChange = (t: "sms" | "vapi") => {
    setType(t);
    setLabel(autoLabel(t, minutes));
  };

  const handleMinutesChange = (val: number) => {
    setMinutes(val);
    setLabel(autoLabel(type, val));
  };

  const handleSubmit = async () => {
    if (!label.trim() || minutes <= 0) return;
    setSaving(true);
    try {
      await onAdd({
        id: crypto.randomUUID(),
        type,
        minutesBefore: minutes,
        label: label.trim(),
        sent: false,
        enabled: true,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 rounded-lg border border-dashed border-border bg-muted/40 p-3">
      <div className="flex flex-wrap items-end gap-2">
        {/* Typ */}
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => handleTypeChange("sms")}
            className={`text-[11px] px-2 py-0.5 rounded-full border transition-all ${
              type === "sms"
                ? "bg-navy text-white border-navy"
                : "bg-muted text-muted-foreground border-border hover:border-muted-foreground/40"
            }`}
          >
            SMS
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange("vapi")}
            className={`text-[11px] px-2 py-0.5 rounded-full border transition-all ${
              type === "vapi"
                ? "bg-navy text-white border-navy"
                : "bg-muted text-muted-foreground border-border hover:border-muted-foreground/40"
            }`}
          >
            Hovor
          </button>
        </div>

        {/* Čas */}
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={5}
            max={2880}
            value={minutes}
            onChange={(e) => handleMinutesChange(Number(e.target.value))}
            className="h-6 w-16 text-[11px] px-2 py-0"
          />
          <span className="text-[11px] text-muted-foreground">min</span>
        </div>

        {/* Název */}
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Název"
          className="h-6 w-20 text-[11px] px-2 py-0"
        />

        {/* Tlačítka */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || !label.trim() || minutes <= 0}
          className="text-[11px] px-2 py-0.5 rounded-full border bg-navy text-white border-navy hover:bg-navy/90 disabled:opacity-50 transition-all"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Přidat"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border hover:border-muted-foreground/40 transition-all"
        >
          Zrušit
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ViewingCard – stateful karta prohlídky
// ---------------------------------------------------------------------------

function ViewingCard({ viewing: initial, isAdmin }: { viewing: Viewing; isAdmin: boolean }) {
  const [viewing, setViewing] = useState<Viewing>(initial);
  const [addingNotif, setAddingNotif] = useState(false);
  const [triggerState, setTriggerState] = useState<Record<string, "idle" | "busy" | "ok" | "err">>({});

  const trigger = async (action: "sms" | "vapi") => {
    setTriggerState((s) => ({ ...s, [action]: "busy" }));
    try {
      const res = await fetch(`/api/admin/viewings/${viewing.id}/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      setTriggerState((s) => ({ ...s, [action]: res.ok ? "ok" : "err" }));
      setTimeout(() => setTriggerState((s) => ({ ...s, [action]: "idle" })), 3000);
    } catch {
      setTriggerState((s) => ({ ...s, [action]: "err" }));
      setTimeout(() => setTriggerState((s) => ({ ...s, [action]: "idle" })), 3000);
    }
  };

  const patchNotification = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch(`/api/viewings/${viewing.id}/notifications`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("patch failed");
    },
    [viewing.id]
  );

  const toggleBuiltIn = useCallback(
    async (
      field: "sms2h_enabled" | "sms1h_enabled" | "vapi_enabled",
      camelKey: "sms2hEnabled" | "sms1hEnabled" | "vapiEnabled"
    ) => {
      const next = !viewing[camelKey];
      setViewing((v) => ({ ...v, [camelKey]: next }));
      try {
        await patchNotification({ field, value: next });
      } catch {
        setViewing((v) => ({ ...v, [camelKey]: !next }));
      }
    },
    [viewing, patchNotification]
  );

  const updateExtra = useCallback(
    async (extras: ExtraNotification[]) => {
      const prev = viewing.extraNotifications;
      setViewing((v) => ({ ...v, extraNotifications: extras }));
      try {
        await patchNotification({ extraNotifications: extras });
      } catch {
        setViewing((v) => ({ ...v, extraNotifications: prev }));
      }
    },
    [viewing, patchNotification]
  );

  const handleAddNotif = async (notif: ExtraNotification) => {
    await updateExtra([...viewing.extraNotifications, notif]);
    setAddingNotif(false);
  };

  const handleToggleExtra = async (id: string) => {
    const updated = viewing.extraNotifications.map((n) =>
      n.id === id ? { ...n, enabled: !n.enabled } : n
    );
    await updateExtra(updated);
  };

  const handleRemoveExtra = async (id: string) => {
    await updateExtra(viewing.extraNotifications.filter((n) => n.id !== id));
  };

  const start = new Date(viewing.eventStart);

  return (
    <Card className="border-navy/10">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Místo: {viewing.address}</CardTitle>
          </div>
          <Badge variant={statusVariant[viewing.status]}>
            {statusLabels[viewing.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-2">
        <p>
          <span className="font-medium text-foreground">Čas:</span>{" "}
          {format(start, "d. M. yyyy, HH:mm", { locale: cs })}
        </p>
        {viewing.clientName && <p>Klient: {viewing.clientName}</p>}
        {viewing.clientPhone && <p>Tel: {viewing.clientPhone}</p>}

        {/* Notifikace */}
        <div className="pt-1">
          <div className="flex flex-wrap items-center gap-1">
            <NotifFlag
              sent={viewing.sms2hSent}
              enabled={viewing.sms2hEnabled}
              label="SMS 2h"
              onToggle={() => toggleBuiltIn("sms2h_enabled", "sms2hEnabled")}
            />
            <NotifFlag
              sent={viewing.sms1hSent}
              enabled={viewing.sms1hEnabled}
              label="SMS 1h"
              onToggle={() => toggleBuiltIn("sms1h_enabled", "sms1hEnabled")}
            />
            <NotifFlag
              sent={viewing.vapiCalled}
              enabled={viewing.vapiEnabled}
              label="Hovor 30min"
              onToggle={() => toggleBuiltIn("vapi_enabled", "vapiEnabled")}
            />

            {/* Extra notifikace */}
            {viewing.extraNotifications.map((notif) => (
              <div key={notif.id} className="flex items-center gap-0.5">
                <NotifFlag
                  sent={notif.sent}
                  enabled={notif.enabled}
                  label={notif.label}
                  onToggle={() => handleToggleExtra(notif.id)}
                />
                {!notif.sent && (
                  <button
                    type="button"
                    onClick={() => handleRemoveExtra(notif.id)}
                    title="Odebrat"
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}

            {/* Přidat notifikaci */}
            {!addingNotif && (
              <button
                type="button"
                onClick={() => setAddingNotif(true)}
                title="Přidat notifikaci"
                className="inline-flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-full border border-dashed border-border text-muted-foreground hover:border-muted-foreground/60 hover:text-foreground transition-all"
              >
                <Plus className="h-3 w-3" />
              </button>
            )}
          </div>

          {addingNotif && (
            <AddNotifPanel
              onAdd={handleAddNotif}
              onClose={() => setAddingNotif(false)}
            />
          )}
        </div>

        {/* Admin: manuální spuštění */}
        {isAdmin && (
          <div className="pt-2 border-t border-border/50 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => trigger("sms")}
              disabled={triggerState.sms === "busy"}
              className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-all ${
                triggerState.sms === "ok"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : triggerState.sms === "err"
                  ? "bg-destructive/10 text-destructive border-destructive/20"
                  : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
              }`}
            >
              {triggerState.sms === "busy" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : triggerState.sms === "ok" ? (
                <CheckCircle className="h-3 w-3" />
              ) : (
                <MessageSquare className="h-3 w-3" />
              )}
              {triggerState.sms === "ok" ? "SMS odeslána" : triggerState.sms === "err" ? "Chyba SMS" : "Test SMS 1h"}
            </button>

            <button
              type="button"
              onClick={() => trigger("vapi")}
              disabled={triggerState.vapi === "busy"}
              className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-all ${
                triggerState.vapi === "ok"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : triggerState.vapi === "err"
                  ? "bg-destructive/10 text-destructive border-destructive/20"
                  : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
              }`}
            >
              {triggerState.vapi === "busy" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : triggerState.vapi === "ok" ? (
                <CheckCircle className="h-3 w-3" />
              ) : (
                <Phone className="h-3 w-3" />
              )}
              {triggerState.vapi === "ok" ? "Hovor zahájen" : triggerState.vapi === "err" ? "Chyba hovoru" : "Test volání 30min"}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// DashboardPage
// ---------------------------------------------------------------------------

type ViewMode = "list" | "calendar";

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = !!process.env.NEXT_PUBLIC_ADMIN_EMAIL && user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  const [viewings, setViewings] = useState<Viewing[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const supabase = createClient();

  const fetchViewings = useCallback(async () => {
    if (authLoading) return;
    if (!user?.id || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
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
        sms2hSent: (r.sms2h_sent as boolean) ?? false,
        sms1hSent: (r.sms1h_sent as boolean) ?? false,
        vapiCalled: (r.vapi_called as boolean) ?? false,
        sms2hEnabled: (r.sms2h_enabled as boolean) ?? true,
        sms1hEnabled: (r.sms1h_enabled as boolean) ?? true,
        vapiEnabled: (r.vapi_enabled as boolean) ?? true,
        extraNotifications: (r.extra_notifications as ExtraNotification[]) ?? [],
        createdAt: r.created_at as string,
        updatedAt: r.updated_at as string,
        userId: r.user_id as string,
      }))
    );
    setLoading(false);
  }, [user?.id, authLoading, supabase]);

  useEffect(() => {
    fetchViewings();
  }, [fetchViewings]);

  const syncCalendar = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/sync-calendar", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSyncMessage({ type: "err", text: data.error ?? "Synchronizace se nezdařila." });
        return;
      }
      setSyncMessage({
        type: "ok",
        text:
          data.synced === 0
            ? "Žádné nové události s klíčovým slovem."
            : `Načteno ${data.synced} prohlídek z kalendáře.`,
      });
      await fetchViewings();
    } catch {
      setSyncMessage({ type: "err", text: "Synchronizace se nezdařila." });
    } finally {
      setSyncing(false);
    }
  };

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
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-8 w-8 text-navy" />
          <div>
            <h1 className="text-2xl font-display font-semibold text-navy">Prohlídky</h1>
            <p className="text-muted-foreground text-sm">
              Přehled prohlídek z Google Kalendáře.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {syncMessage && (
            <p
              className={
                syncMessage.type === "ok"
                  ? "text-sm text-emerald-600"
                  : "text-sm text-destructive"
              }
            >
              {syncMessage.text}
            </p>
          )}
          <Button variant="outline" size="sm" onClick={syncCalendar} disabled={syncing}>
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Aktualizovat události
          </Button>
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
      </div>

      {viewings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Zatím nemáte žádné prohlídky. Přidejte do Google Kalendáře události s klíčovým
            slovem (např. #prohlidka) a formátem: Tel: +420… Adresa: … Poté klikněte na
            „Aktualizovat události".
          </CardContent>
        </Card>
      ) : viewMode === "calendar" ? (
        <CalendarView viewings={viewings} />
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-lg font-medium text-navy mb-3">Nadcházející</h2>
              <div className="grid gap-3">
                {upcoming.map((v) => (
                  <ViewingCard key={v.id} viewing={v} isAdmin={isAdmin} />
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
                  <ViewingCard key={v.id} viewing={v} isAdmin={isAdmin} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
