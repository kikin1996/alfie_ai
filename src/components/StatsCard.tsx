import type { LucideIcon } from "lucide-react";

interface StatsCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  accent?: "emerald" | "warning" | "primary" | "cancelled";
}

const accentMap = {
  emerald: "bg-emerald-bg text-emerald",
  warning: "bg-warning-bg text-warning",
  primary: "bg-secondary text-primary",
  cancelled: "bg-cancelled-bg text-cancelled",
};

export default function StatsCard({
  label,
  value,
  icon: Icon,
  accent = "primary",
}: StatsCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 font-display text-3xl font-bold text-foreground">
            {value}
          </p>
        </div>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${accentMap[accent]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
