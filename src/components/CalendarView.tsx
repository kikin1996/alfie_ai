"use client";

import { useState, useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";
import { cs } from "date-fns/locale";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import type { Viewing } from "@/types";
import StatusBadge from "./StatusBadge";

interface CalendarViewProps {
  viewings: Viewing[];
}

const WEEKDAYS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

export default function CalendarView({ viewings }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const start = startOfWeek(monthStart, { weekStartsOn: 1 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const viewingsByDate = useMemo(() => {
    const map = new Map<string, Viewing[]>();
    viewings.forEach((v) => {
      const key = format(new Date(v.eventStart), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    });
    return map;
  }, [viewings]);

  const selectedViewings = selectedDay
    ? viewingsByDate.get(format(selectedDay, "yyyy-MM-dd")) ?? []
    : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      {/* Calendar grid */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm animate-fade-in">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold capitalize text-foreground">
            {format(currentMonth, "LLLL yyyy", { locale: cs })}
          </h2>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mb-2 grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);
            const selected = selectedDay && isSameDay(day, selectedDay);
            const dayViewings = viewingsByDate.get(key) ?? [];
            const hasEvents = dayViewings.length > 0;

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`relative flex flex-col items-center justify-start rounded-lg py-2 text-sm transition-colors ${
                  !inMonth ? "text-muted-foreground/40" : ""
                } ${selected ? "bg-primary text-primary-foreground" : "hover:bg-muted"} ${
                  today && !selected ? "font-bold text-primary" : ""
                }`}
              >
                <span>{format(day, "d")}</span>
                {hasEvents && (
                  <div className="mt-0.5 flex gap-0.5">
                    {dayViewings.slice(0, 3).map((v) => (
                      <span
                        key={v.id}
                        className={`block h-1.5 w-1.5 rounded-full ${
                          selected
                            ? "bg-primary-foreground/70"
                            : v.status === "confirmed"
                              ? "bg-emerald"
                              : v.status === "cancelled"
                                ? "bg-cancelled"
                                : v.status === "sms_sent"
                                  ? "bg-warning"
                                  : "bg-muted-foreground"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day detail */}
      <div
        className="rounded-xl border border-border bg-card p-5 shadow-sm animate-fade-in"
        style={{ animationDelay: "100ms" }}
      >
        <h3 className="mb-4 font-display text-base font-semibold text-foreground">
          {selectedDay
            ? format(selectedDay, "EEEE d. MMMM", { locale: cs })
            : "Vyberte den"}
        </h3>

        {selectedViewings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Žádné prohlídky v tento den.
          </p>
        ) : (
          <div className="space-y-3">
            {selectedViewings.map((v) => (
              <div
                key={v.id}
                className="rounded-lg border border-border bg-background p-3.5 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-sm text-foreground">
                    {format(new Date(v.eventStart), "HH:mm", { locale: cs })}
                  </span>
                  <StatusBadge status={v.status} />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {v.clientName || "Klient"}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {v.address}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
