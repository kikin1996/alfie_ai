"use client";

import { Badge } from "@/components/ui/badge";
import type { ViewingStatus } from "@/types";

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

interface StatusBadgeProps {
  status: ViewingStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge variant={statusVariant[status]}>{statusLabels[status]}</Badge>
  );
}
